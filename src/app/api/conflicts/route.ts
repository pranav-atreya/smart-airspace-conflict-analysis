
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        c.conflict_id,
        c.primary_flight_id,
        c.secondary_flight_id,
        c.airspace_id,
        c.detected_at,
        c.conflict_type,
        c.severity,
        c.description,
        c.minimum_distance_nm,
        c.altitude_difference_ft,
        c.resolved,
        c.resolved_at,
        pf.flight_number AS primary_flight_number,
        sf.flight_number AS secondary_flight_number,
        a.airspace_code,
        a.airspace_name
      FROM conflict_event c
      LEFT JOIN flight pf
        ON pf.flight_id = c.primary_flight_id
      LEFT JOIN flight sf
        ON sf.flight_id = c.secondary_flight_id
      LEFT JOIN restricted_airspace a
        ON a.airspace_id = c.airspace_id
      ORDER BY
        c.resolved ASC,
        CASE c.severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          ELSE 4
        END,
        c.detected_at DESC
    `);

    return NextResponse.json({
      ok: true,
      total: result.rows.length,
      events: result.rows,
    });
  } catch (error) {
    console.error("Conflict events API error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Unable to retrieve conflict events.",
      },
      { status: 500 }
    );
  }
}
