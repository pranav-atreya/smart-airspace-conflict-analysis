import { NextResponse } from "next/server";
import pool from "@/lib/db";

type Position = {
  position_id: number;
  flight_id: number;
  flight_number: string;
  recorded_at: Date;
  latitude: number;
  longitude: number;
  altitude_ft: number;
};

type Airspace = {
  airspace_id: number;
  airspace_name: string;
  restriction_type: string;
  center_latitude: number;
  center_longitude: number;
  radius_nm: number;
  lower_altitude_ft: number;
  upper_altitude_ft: number;
  valid_from: Date;
  valid_to: Date;
};

type Candidate = {
  primaryFlightId: number;
  secondaryFlightId: number | null;
  airspaceId: number | null;
  detectedAt: Date;
  conflictType: string;
  severity: string;
  description: string;
  distanceNm: number | null;
  altitudeDifferenceFt: number | null;
};

function distanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusNm = 3440.065;

  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    earthRadiusNm *
    Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
  );
}

function severityForAirspace(restrictionType: string) {
  switch (restrictionType.toUpperCase()) {
    case "PROHIBITED":
      return "CRITICAL";
    case "RESTRICTED":
      return "HIGH";
    default:
      return "MEDIUM";
  }
}

export async function POST() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const positionResult = await client.query<Position>(`
      SELECT
        fp.position_id,
        fp.flight_id,
        f.flight_number,
        fp.recorded_at,
        fp.latitude::float8 AS latitude,
        fp.longitude::float8 AS longitude,
        fp.altitude_ft
      FROM flight_position fp
      JOIN flight f ON f.flight_id = fp.flight_id
      ORDER BY fp.recorded_at, fp.position_id
    `);

    const airspaceResult = await client.query<Airspace>(`
      SELECT
        airspace_id,
        airspace_name,
        restriction_type,
        center_latitude::float8 AS center_latitude,
        center_longitude::float8 AS center_longitude,
        radius_nm::float8 AS radius_nm,
        lower_altitude_ft,
        upper_altitude_ft,
        valid_from,
        valid_to
      FROM restricted_airspace
      ORDER BY airspace_id
    `);

    const positions = positionResult.rows;
    const airspaces = airspaceResult.rows;
    const candidates: Candidate[] = [];

    // Analyse each recorded aircraft position against each airspace.
    for (const position of positions) {
      const recordedTime = new Date(position.recorded_at).getTime();

      for (const zone of airspaces) {
        const validFrom = new Date(zone.valid_from).getTime();
        const validTo = new Date(zone.valid_to).getTime();

        if (recordedTime < validFrom || recordedTime > validTo) {
          continue;
        }

        const distance = distanceNm(
          position.latitude,
          position.longitude,
          zone.center_latitude,
          zone.center_longitude
        );

        if (distance > Number(zone.radius_nm)) {
          continue;
        }

        const withinAltitudeBand =
          position.altitude_ft >= zone.lower_altitude_ft &&
          position.altitude_ft <= zone.upper_altitude_ft;

        if (withinAltitudeBand) {
          candidates.push({
            primaryFlightId: position.flight_id,
            secondaryFlightId: null,
            airspaceId: zone.airspace_id,
            detectedAt: position.recorded_at,
            conflictType: "RESTRICTED_AIRSPACE_ENTRY",
            severity: severityForAirspace(zone.restriction_type),
            description:
              `Flight ${position.flight_number} has a recorded position ` +
              `within the configured horizontal radius and altitude band ` +
              `of ${zone.airspace_name}. Distance from zone centre: ` +
              `${distance.toFixed(2)} NM.`,
            distanceNm: distance,
            altitudeDifferenceFt: null,
          });
        } else {
          const altitudeDeviation =
            position.altitude_ft < zone.lower_altitude_ft
              ? zone.lower_altitude_ft - position.altitude_ft
              : position.altitude_ft - zone.upper_altitude_ft;

          candidates.push({
            primaryFlightId: position.flight_id,
            secondaryFlightId: null,
            airspaceId: zone.airspace_id,
            detectedAt: position.recorded_at,
            conflictType: "ALTITUDE_VIOLATION",
            severity: altitudeDeviation > 3000 ? "HIGH" : "MEDIUM",
            description:
              `Flight ${position.flight_number} is horizontally within ` +
              `${zone.airspace_name}, but its recorded altitude is outside ` +
              `the configured altitude band by ${altitudeDeviation} ft.`,
            distanceNm: distance,
            altitudeDifferenceFt: altitudeDeviation,
          });
        }
      }
    }

    // Simplified proximity screening: different flights, positions no more
    // than five minutes apart, horizontal separation <= 5 NM, and altitude
    // separation <= 1,000 ft.
    const handledFlightPairs = new Set<string>();

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const first = positions[i];
        const second = positions[j];

        if (first.flight_id === second.flight_id) continue;

        const timeDifference = Math.abs(
          new Date(first.recorded_at).getTime() -
            new Date(second.recorded_at).getTime()
        );

        if (timeDifference > 5 * 60 * 1000) continue;

        const distance = distanceNm(
          first.latitude,
          first.longitude,
          second.latitude,
          second.longitude
        );

        const altitudeDifference = Math.abs(
          first.altitude_ft - second.altitude_ft
        );

        if (distance > 5 || altitudeDifference > 1000) continue;

        const lowId = Math.min(first.flight_id, second.flight_id);
        const highId = Math.max(first.flight_id, second.flight_id);
        const pairKey = `${lowId}:${highId}`;

        if (handledFlightPairs.has(pairKey)) continue;
        handledFlightPairs.add(pairKey);

        const severity =
          distance <= 2 && altitudeDifference <= 500
            ? "CRITICAL"
            : distance <= 3 && altitudeDifference <= 1000
              ? "HIGH"
              : "MEDIUM";

        const detectedAt =
          new Date(first.recorded_at).getTime() >=
          new Date(second.recorded_at).getTime()
            ? first.recorded_at
            : second.recorded_at;

        candidates.push({
          primaryFlightId: lowId,
          secondaryFlightId: highId,
          airspaceId: null,
          detectedAt,
          conflictType: "AIRCRAFT_PROXIMITY",
          severity,
          description:
            `Recorded positions for flights ${first.flight_number} and ` +
            `${second.flight_number} are ${distance.toFixed(2)} NM apart, ` +
            `with an altitude difference of ${altitudeDifference} ft. ` +
            `The positions are within five minutes of one another.`,
          distanceNm: distance,
          altitudeDifferenceFt: altitudeDifference,
        });
      }
    }

    // Insert only events not already stored with the same identifying fields.
    let insertedEvents = 0;

    for (const event of candidates) {
      const result = await client.query(
        `
        INSERT INTO conflict_event (
          primary_flight_id,
          secondary_flight_id,
          airspace_id,
          detected_at,
          conflict_type,
          severity,
          description,
          minimum_distance_nm,
          altitude_difference_ft,
          resolved
        )
        SELECT
          $1, $2, $3, $4, $5::varchar(40), $6, $7, $8, $9, FALSE
        WHERE NOT EXISTS (
          SELECT 1
          FROM conflict_event existing
          WHERE existing.primary_flight_id = $1
            AND existing.secondary_flight_id
                IS NOT DISTINCT FROM $2
            AND existing.airspace_id IS NOT DISTINCT FROM $3
            AND existing.detected_at = $4
            AND existing.conflict_type = $5::varchar(40)
        )
        `,
        [
          event.primaryFlightId,
          event.secondaryFlightId,
          event.airspaceId,
          event.detectedAt,
          event.conflictType,
          event.severity,
          event.description,
          event.distanceNm,
          event.altitudeDifferenceFt,
        ]
      );

      insertedEvents += result.rowCount ?? 0;
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      message: "Conflict analysis completed.",
      model: {
        airspace: "Recorded position against configured circular zones, altitude bands and validity intervals",
        proximity:
          "Different flights, positions within 5 minutes, <= 5 NM apart and <= 1000 ft vertically",
        note: "Academic screening model; not certified operational aviation guidance.",
      },
      analysedPositions: positions.length,
      checkedAirspaces: airspaces.length,
      candidateEvents: candidates.length,
      insertedEvents,
      alreadyRecorded: candidates.length - insertedEvents,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Conflict analysis failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Conflict analysis failed. Check the Next.js terminal.",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}