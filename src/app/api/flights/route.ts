
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pool from "@/lib/db";
import { authorizeRequest } from "@/lib/authorization";

const flightStatus = z.enum([
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
]);

const createFlightSchema = z
  .object({
    flightNumber: z.string().trim().min(2).max(20),
    aircraftId: z.number().int().positive(),
    departureAirportId: z.number().int().positive(),
    arrivalAirportId: z.number().int().positive(),
    scheduledDeparture: z.string().min(16).max(25),
    scheduledArrival: z.string().min(16).max(25),
    status: flightStatus.default("SCHEDULED"),
  })
  .superRefine((value, context) => {
    const departure = Date.parse(value.scheduledDeparture);
    const arrival = Date.parse(value.scheduledArrival);

    if (Number.isNaN(departure)) {
      context.addIssue({
        code: "custom",
        path: ["scheduledDeparture"],
        message: "Enter a valid departure date and time.",
      });
    }

    if (Number.isNaN(arrival)) {
      context.addIssue({
        code: "custom",
        path: ["scheduledArrival"],
        message: "Enter a valid arrival date and time.",
      });
    }

    if (
      Number.isFinite(departure) &&
      Number.isFinite(arrival) &&
      arrival <= departure
    ) {
      context.addIssue({
        code: "custom",
        path: ["scheduledArrival"],
        message: "Arrival must be later than departure.",
      });
    }

    if (value.departureAirportId === value.arrivalAirportId) {
      context.addIssue({
        code: "custom",
        path: ["arrivalAirportId"],
        message: "Departure and arrival airports must differ.",
      });
    }
  });

const updateFlightSchema = z.object({
  flightId: z.number().int().positive(),
  status: flightStatus,
});

const deleteFlightSchema = z.object({
  flightId: z.number().int().positive(),
});

function validationError(message: string) {
  return NextResponse.json(
    { ok: false, message },
    { status: 400 }
  );
}

function postgresCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: unknown }).code);
  }

  return "";
}

export async function GET() {
  const authorization = await authorizeRequest(["ADMIN", "OPERATOR"]);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const [flights, aircraft, airports] = await Promise.all([
      pool.query(`
        SELECT
          f.flight_id,
          f.flight_number,
          f.aircraft_id,
          f.departure_airport,
          f.arrival_airport,
          to_char(f.scheduled_departure, 'YYYY-MM-DD"T"HH24:MI')
            AS scheduled_departure,
          to_char(f.scheduled_arrival, 'YYYY-MM-DD"T"HH24:MI')
            AS scheduled_arrival,
          f.status,
          ac.registration_no,
          ac.aircraft_type,
          dep.airport_name AS departure_name,
          dep.iata_code AS departure_iata,
          dep.icao_code AS departure_icao,
          arr.airport_name AS arrival_name,
          arr.iata_code AS arrival_iata,
          arr.icao_code AS arrival_icao
        FROM flight f
        JOIN aircraft ac ON ac.aircraft_id = f.aircraft_id
        JOIN airport dep ON dep.airport_id = f.departure_airport
        JOIN airport arr ON arr.airport_id = f.arrival_airport
        ORDER BY f.scheduled_departure DESC, f.flight_id DESC
      `),

      pool.query(`
        SELECT aircraft_id, registration_no, aircraft_type
        FROM aircraft
        ORDER BY registration_no
      `),

      pool.query(`
        SELECT
          airport_id,
          airport_name,
          iata_code,
          icao_code
        FROM airport
        ORDER BY airport_name
      `),
    ]);

    return NextResponse.json({
      ok: true,
      user: {
        fullName: authorization.user?.fullName,
        role: authorization.user?.role,
      },
      flights: flights.rows,
      aircraft: aircraft.rows,
      airports: airports.rows,
    });
  } catch (error) {
    console.error("Flight list API failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to load flight records." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeRequest(["ADMIN"]);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const body = await request.json();
    const parsed = createFlightSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(
        parsed.error.issues[0]?.message || "Invalid flight information."
      );
    }

    const flight = parsed.data;

    const result = await pool.query(
      `
      INSERT INTO flight (
        flight_number,
        aircraft_id,
        departure_airport,
        arrival_airport,
        scheduled_departure,
        scheduled_arrival,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING flight_id, flight_number, status
      `,
      [
        flight.flightNumber,
        flight.aircraftId,
        flight.departureAirportId,
        flight.arrivalAirportId,
        flight.scheduledDeparture,
        flight.scheduledArrival,
        flight.status,
      ]
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Flight created successfully.",
        flight: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    const code = postgresCode(error);

    if (code === "23505") {
      return NextResponse.json(
        {
          ok: false,
          message: "A conflicting unique value already exists.",
        },
        { status: 409 }
      );
    }

    if (code === "23503") {
      return validationError(
        "Select an aircraft and airports that exist in the database."
      );
    }

    if (code === "23514" || code === "23502") {
      return validationError(
        "The flight violates a database constraint. Check the supplied values."
      );
    }

    console.error("Create flight API failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to create the flight." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeRequest(["ADMIN"]);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const body = await request.json();
    const parsed = updateFlightSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(
        parsed.error.issues[0]?.message || "Invalid update request."
      );
    }

    const result = await pool.query(
      `
      UPDATE flight
      SET status = $1
      WHERE flight_id = $2
      RETURNING flight_id, flight_number, status
      `,
      [parsed.data.status, parsed.data.flightId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { ok: false, message: "Flight not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Flight status updated.",
      flight: result.rows[0],
    });
  } catch (error) {
    if (postgresCode(error) === "23514") {
      return validationError("The new status violates a database constraint.");
    }

    console.error("Update flight API failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to update the flight." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = await authorizeRequest(["ADMIN"]);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const body = await request.json();
    const parsed = deleteFlightSchema.safeParse(body);

    if (!parsed.success) {
      return validationError("A valid flight ID is required.");
    }

    const result = await pool.query(
      `
      DELETE FROM flight
      WHERE flight_id = $1
      RETURNING flight_id, flight_number
      `,
      [parsed.data.flightId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { ok: false, message: "Flight not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Flight deleted.",
      flight: result.rows[0],
    });
  } catch (error) {
    if (postgresCode(error) === "23503") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This flight has linked records, such as positions, incidents, waypoints or conflicts. The database prevents deleting it.",
        },
        { status: 409 }
      );
    }

    console.error("Delete flight API failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to delete the flight." },
      { status: 500 }
    );
  }
}
