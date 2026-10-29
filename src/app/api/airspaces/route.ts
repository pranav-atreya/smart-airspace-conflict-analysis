
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pool from "@/lib/db";
import { authorizeRequest } from "@/lib/authorization";

const fields = {
  airspaceCode: z.string().trim().min(2).max(30),
  airspaceName: z.string().trim().min(3).max(150),
  restrictionType: z.enum(["RESTRICTED", "PROHIBITED", "DANGER"]),
  centerLatitude: z.number().finite().min(-90).max(90),
  centerLongitude: z.number().finite().min(-180).max(180),
  radiusNm: z.number().finite().positive().max(1000),
  lowerAltitudeFt: z.number().int().min(0).max(100000),
  upperAltitudeFt: z.number().int().min(0).max(100000),
  validFrom: z.string().min(16).max(30),
  validTo: z.string().min(16).max(30),
};

function validateAirspace(
  value: z.infer<z.ZodObject<typeof fields>>,
  context: z.RefinementCtx
) {
  if (value.upperAltitudeFt < value.lowerAltitudeFt) {
    context.addIssue({
      code: "custom",
      path: ["upperAltitudeFt"],
      message: "Upper altitude must be greater than or equal to lower altitude.",
    });
  }

  const from = Date.parse(value.validFrom);
  const to = Date.parse(value.validTo);

  if (!Number.isFinite(from)) {
    context.addIssue({
      code: "custom",
      path: ["validFrom"],
      message: "Enter a valid start date and time.",
    });
  }

  if (!Number.isFinite(to)) {
    context.addIssue({
      code: "custom",
      path: ["validTo"],
      message: "Enter a valid end date and time.",
    });
  }

  if (Number.isFinite(from) && Number.isFinite(to) && to <= from) {
    context.addIssue({
      code: "custom",
      path: ["validTo"],
      message: "The end of the validity period must follow its start.",
    });
  }
}

const airspaceSchema = z.object(fields).superRefine(validateAirspace);

const updateSchema = z
  .object({
    airspaceId: z.number().int().positive(),
    ...fields,
  })
  .superRefine((value, context) => {
    validateAirspace(value, context);
  });

const deleteSchema = z.object({
  airspaceId: z.number().int().positive(),
});

function badRequest(message: string) {
  return NextResponse.json(
    { ok: false, message },
    { status: 400 }
  );
}

function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: unknown }).code);
  }

  return "";
}

const selection = `
  SELECT
    airspace_id,
    airspace_code,
    airspace_name,
    restriction_type,
    center_latitude,
    center_longitude,
    radius_nm,
    lower_altitude_ft,
    upper_altitude_ft,
    to_char(valid_from, 'YYYY-MM-DD"T"HH24:MI') AS valid_from,
    to_char(valid_to, 'YYYY-MM-DD"T"HH24:MI') AS valid_to
  FROM restricted_airspace
`;

export async function GET() {
  const authorization = await authorizeRequest(["ADMIN", "OPERATOR"]);

  if (authorization.response) return authorization.response;

  try {
    const result = await pool.query(
      `${selection} ORDER BY airspace_name`
    );

    return NextResponse.json({
      ok: true,
      role: authorization.user?.role,
      airspaces: result.rows,
    });
  } catch (error) {
    console.error("Airspace list failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to load restricted airspace records." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeRequest(["ADMIN"]);

  if (authorization.response) return authorization.response;

  try {
    const body = await request.json();
    const parsed = airspaceSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message || "Invalid airspace information."
      );
    }

    const a = parsed.data;

    const result = await pool.query(
      `
      INSERT INTO restricted_airspace (
        airspace_code,
        airspace_name,
        restriction_type,
        center_latitude,
        center_longitude,
        radius_nm,
        lower_altitude_ft,
        upper_altitude_ft,
        valid_from,
        valid_to
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING airspace_id, airspace_code, airspace_name
      `,
      [
        a.airspaceCode,
        a.airspaceName,
        a.restrictionType,
        a.centerLatitude,
        a.centerLongitude,
        a.radiusNm,
        a.lowerAltitudeFt,
        a.upperAltitudeFt,
        a.validFrom,
        a.validTo,
      ]
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Restricted airspace created successfully.",
        airspace: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    const code = errorCode(error);

    if (code === "23505") {
      return NextResponse.json(
        { ok: false, message: "That airspace code already exists." },
        { status: 409 }
      );
    }

    if (code === "23514" || code === "23502" || code === "22P02") {
      return badRequest(
        "The airspace values violate a database constraint. Check the supplied values."
      );
    }

    console.error("Airspace creation failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to create restricted airspace." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeRequest(["ADMIN"]);

  if (authorization.response) return authorization.response;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message || "Invalid airspace update."
      );
    }

    const a = parsed.data;

    const result = await pool.query(
      `
      UPDATE restricted_airspace
      SET
        airspace_code = $1,
        airspace_name = $2,
        restriction_type = $3,
        center_latitude = $4,
        center_longitude = $5,
        radius_nm = $6,
        lower_altitude_ft = $7,
        upper_altitude_ft = $8,
        valid_from = $9,
        valid_to = $10
      WHERE airspace_id = $11
      RETURNING airspace_id, airspace_code, airspace_name, restriction_type
      `,
      [
        a.airspaceCode,
        a.airspaceName,
        a.restrictionType,
        a.centerLatitude,
        a.centerLongitude,
        a.radiusNm,
        a.lowerAltitudeFt,
        a.upperAltitudeFt,
        a.validFrom,
        a.validTo,
        a.airspaceId,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { ok: false, message: "Restricted airspace not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Restricted airspace updated successfully.",
      airspace: result.rows[0],
    });
  } catch (error) {
    const code = errorCode(error);

    if (code === "23505") {
      return NextResponse.json(
        { ok: false, message: "That airspace code already exists." },
        { status: 409 }
      );
    }

    if (code === "23514" || code === "23502" || code === "22P02") {
      return badRequest("The updated values violate a database constraint.");
    }

    console.error("Airspace update failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to update restricted airspace." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = await authorizeRequest(["ADMIN"]);

  if (authorization.response) return authorization.response;

  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest("A valid airspace ID is required.");
    }

    const result = await pool.query(
      `
      DELETE FROM restricted_airspace
      WHERE airspace_id = $1
      RETURNING airspace_id, airspace_code, airspace_name
      `,
      [parsed.data.airspaceId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { ok: false, message: "Restricted airspace not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Restricted airspace deleted.",
      airspace: result.rows[0],
    });
  } catch (error) {
    if (errorCode(error) === "23503") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This airspace has linked records. The database prevents deleting it while those references exist.",
        },
        { status: 409 }
      );
    }

    console.error("Airspace deletion failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to delete restricted airspace." },
      { status: 500 }
    );
  }
}
