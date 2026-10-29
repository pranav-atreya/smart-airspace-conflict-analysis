import { NextResponse } from "next/server";
import pool from "@/lib/db";


export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS db_user,
        (SELECT COUNT(*)::int FROM aircraft) AS aircraft_count,
        (SELECT COUNT(*)::int FROM airport) AS airport_count,
        (SELECT COUNT(*)::int FROM flight) AS flight_count,
        (SELECT COUNT(*)::int FROM notam) AS notam_count,
        (SELECT COUNT(*)::int FROM conflict_event) AS conflict_count,
        (SELECT COUNT(*)::int FROM incident) AS incident_count
    `);

    return NextResponse.json({
      ok: true,
      message: "PostgreSQL connection successful",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Database connection failed. Check the server terminal.",
      },
      { status: 500 }
    );
  }
}