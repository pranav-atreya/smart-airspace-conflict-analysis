
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { authorizeRequest } from "@/lib/authorization";

export async function GET() {
  const authorization = await authorizeRequest(["ADMIN"]);

  if (authorization.response) {
    return authorization.response;
  }

  try {
    const result = await pool.query(`
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        r.role_name,
        u.is_active,
        u.created_at
      FROM app_user u
      JOIN role r ON r.role_id = u.role_id
      ORDER BY u.user_id
    `);

    return NextResponse.json({
      ok: true,
      requestedBy: authorization.user?.email,
      users: result.rows,
    });
  } catch (error) {
    console.error("Admin user API failed:", error);

    return NextResponse.json(
      { ok: false, message: "Unable to retrieve user records." },
      { status: 500 }
    );
  }
}
