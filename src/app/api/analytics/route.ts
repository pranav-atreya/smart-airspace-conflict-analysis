import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { authorizeRequest } from "@/lib/authorization";

export async function GET() {
  const auth = await authorizeRequest(["ADMIN", "OPERATOR"]);
  if (auth.response) return auth.response;

  try {
    const [
      summary,
      flightsByStatus,
      conflictsBySeverity,
      airspacesByType,
      notamsByStatus,
      conflictsByAirspace,
    ] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM flight) AS total_flights,
          (SELECT COUNT(*)::int FROM flight WHERE status = 'ACTIVE') AS active_flights,
          (SELECT COUNT(*)::int FROM flight WHERE status = 'SCHEDULED') AS scheduled_flights,
          (SELECT COUNT(*)::int FROM flight WHERE status = 'COMPLETED') AS completed_flights,
          (SELECT COUNT(*)::int FROM conflict_event) AS total_conflicts,
          (SELECT COUNT(*)::int FROM conflict_event WHERE resolved = FALSE) AS open_conflicts,
          (SELECT COUNT(*)::int FROM conflict_event
            WHERE resolved = FALSE AND severity IN ('HIGH', 'CRITICAL')) AS high_priority_conflicts,
          (SELECT COUNT(*)::int FROM restricted_airspace) AS total_airspaces,
          (SELECT COUNT(*)::int FROM notam) AS total_notams,
          (SELECT COUNT(*)::int FROM incident) AS total_incidents,
          (SELECT COUNT(*)::int FROM flight_position) AS recorded_positions
      `),

      pool.query(`
        SELECT status AS label, COUNT(*)::int AS value
        FROM flight GROUP BY status ORDER BY status
      `),

      pool.query(`
        SELECT
          severity AS label,
          COUNT(*)::int AS value,
          COUNT(*) FILTER (WHERE resolved = FALSE)::int AS open_count,
          COUNT(*) FILTER (WHERE resolved = TRUE)::int AS resolved_count
        FROM conflict_event
        GROUP BY severity
        ORDER BY CASE severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END
      `),

      pool.query(`
        SELECT restriction_type AS label, COUNT(*)::int AS value
        FROM restricted_airspace
        GROUP BY restriction_type ORDER BY restriction_type
      `),

      pool.query(`
        SELECT status AS label, COUNT(*)::int AS value
        FROM notam GROUP BY status ORDER BY status
      `),

      pool.query(`
        SELECT
          a.airspace_name AS label,
          COUNT(c.conflict_id)::int AS value,
          COUNT(c.conflict_id) FILTER (
            WHERE c.resolved = FALSE
          )::int AS open_count
        FROM restricted_airspace a
        LEFT JOIN conflict_event c ON c.airspace_id = a.airspace_id
        GROUP BY a.airspace_id, a.airspace_name
        ORDER BY value DESC, a.airspace_name
        LIMIT 8
      `),
    ]);

    return NextResponse.json({
      ok: true,
      summary: summary.rows[0],
      flightsByStatus: flightsByStatus.rows,
      conflictsBySeverity: conflictsBySeverity.rows,
      airspacesByType: airspacesByType.rows,
      notamsByStatus: notamsByStatus.rows,
      conflictsByAirspace: conflictsByAirspace.rows,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analytics query failed:", error);
    return NextResponse.json(
      { ok: false, message: "Unable to retrieve analytics." },
      { status: 500 }
    );
  }
}
