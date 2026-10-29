import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { authorizeRequest } from "@/lib/authorization";

export async function GET() {
  const auth = await authorizeRequest(["ADMIN", "OPERATOR"]);
  if (auth.response) return auth.response;

  try {
    const [identity, objects, tables, embeddings] = await Promise.all([
      pool.query(`
        SELECT
          current_database() AS database_name,
          version() AS postgres_version,
          pg_postmaster_start_time() AS server_started_at
      `),

      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE')::int AS table_count,
          (SELECT COUNT(*) FROM information_schema.views
            WHERE table_schema = 'public')::int AS view_count,
          (SELECT COUNT(*) FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND NOT t.tgisinternal)::int AS trigger_count,
          (SELECT COUNT(*) FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.prokind IN ('f', 'p')
              AND NOT EXISTS (
                SELECT 1
                FROM pg_depend d
                WHERE d.classid = 'pg_proc'::regclass
                  AND d.objid = p.oid
                  AND d.deptype = 'e'
              ))::int AS routine_count,
          EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'vector'
          ) AS vector_extension,
          (SELECT COUNT(*) FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname ILIKE '%hnsw%')::int AS vector_index_count
      `),

      pool.query(`
        SELECT 'aircraft'::text AS table_name, COUNT(*)::int AS row_count FROM aircraft
        UNION ALL SELECT 'airport', COUNT(*)::int FROM airport
        UNION ALL SELECT 'app_user', COUNT(*)::int FROM app_user
        UNION ALL SELECT 'conflict_event', COUNT(*)::int FROM conflict_event
        UNION ALL SELECT 'flight', COUNT(*)::int FROM flight
        UNION ALL SELECT 'flight_position', COUNT(*)::int FROM flight_position
        UNION ALL SELECT 'flight_waypoint', COUNT(*)::int FROM flight_waypoint
        UNION ALL SELECT 'incident', COUNT(*)::int FROM incident
        UNION ALL SELECT 'notam', COUNT(*)::int FROM notam
        UNION ALL SELECT 'restricted_airspace', COUNT(*)::int FROM restricted_airspace
        UNION ALL SELECT 'role', COUNT(*)::int FROM role
        UNION ALL SELECT 'waypoint', COUNT(*)::int FROM waypoint
        ORDER BY table_name
      `),

      pool.query(`
        SELECT
          'NOTAM'::text AS source,
          COUNT(*)::int AS total_records,
          COUNT(embedding)::int AS embedded_records,
          MIN(vector_dims(embedding))::int AS min_dimensions,
          MAX(vector_dims(embedding))::int AS max_dimensions
        FROM notam

        UNION ALL

        SELECT
          'INCIDENT',
          COUNT(*)::int,
          COUNT(embedding)::int,
          MIN(vector_dims(embedding))::int,
          MAX(vector_dims(embedding))::int
        FROM incident
      `),
    ]);

    return NextResponse.json({
      ok: true,
      identity: identity.rows[0],
      objects: objects.rows[0],
      tables: tables.rows,
      embeddings: embeddings.rows,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database status query failed:", error);
    return NextResponse.json(
      { ok: false, message: "Unable to retrieve database status." },
      { status: 500 }
    );
  }
}
