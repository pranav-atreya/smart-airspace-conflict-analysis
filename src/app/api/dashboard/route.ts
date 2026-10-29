import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [
      summary,
      recentFlights,
      recentConflicts,
      airspaces,
    ] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM flight) AS total_flights,
          (SELECT COUNT(*)::int FROM flight
            WHERE status = 'ACTIVE') AS active_flights,
          (SELECT COUNT(*)::int FROM conflict_event
            WHERE resolved = FALSE) AS open_conflicts,
          (SELECT COUNT(*)::int FROM conflict_event
            WHERE resolved = FALSE
              AND severity IN ('HIGH', 'CRITICAL')) AS high_priority,
          (SELECT COUNT(*)::int FROM restricted_airspace) AS total_airspaces,
          (SELECT COUNT(*)::int FROM notam) AS total_notams,
          (SELECT COUNT(*)::int FROM incident) AS total_incidents
      `),

      pool.query(`
        SELECT
          flight_id,
          flight_number,
          registration_no,
          aircraft_type,
          departure_airport,
          arrival_airport,
          scheduled_departure,
          scheduled_arrival,
          status
        FROM active_flight_summary
        ORDER BY scheduled_departure DESC
        LIMIT 6
      `),

      pool.query(`
        SELECT
          c.conflict_id,
          c.detected_at,
          c.conflict_type,
          c.severity,
          c.description,
          c.resolved,
          f.flight_number,
          a.airspace_name
        FROM conflict_event c
        LEFT JOIN flight f
          ON c.primary_flight_id = f.flight_id
        LEFT JOIN restricted_airspace a
          ON c.airspace_id = a.airspace_id
        ORDER BY c.detected_at DESC
        LIMIT 6
      `),

      pool.query(`
        SELECT
          airspace_id,
          airspace_code,
          airspace_name,
          restriction_type,
          lower_altitude_ft,
          upper_altitude_ft,
          radius_nm,
          valid_from,
          valid_to
        FROM restricted_airspace
        ORDER BY airspace_name
        LIMIT 8
      `),
    ]);

    return NextResponse.json({
      ok: true,
      summary: summary.rows[0],
      recentFlights: recentFlights.rows,
      recentConflicts: recentConflicts.rows,
      airspaces: airspaces.rows,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to load dashboard data." },
      { status: 500 }
    );
  }
}