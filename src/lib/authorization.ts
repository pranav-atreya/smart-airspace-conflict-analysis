
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export type AppRole = "ADMIN" | "OPERATOR";

type AuthorizationResult = {
  user: SessionUser | null;
  response: NextResponse | null;
};

export async function authorizeRequest(
  allowedRoles: AppRole[] = ["ADMIN", "OPERATOR"]
): Promise<AuthorizationResult> {
  const session = await getSessionUser();

  if (!session) {
    return {
      user: null,
      response: NextResponse.json(
        { ok: false, message: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  const result = await pool.query(
    `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.is_active,
      r.role_name
    FROM app_user u
    JOIN role r ON r.role_id = u.role_id
    WHERE u.user_id = $1
    LIMIT 1
    `,
    [session.userId]
  );

  if (result.rows.length === 0 || !result.rows[0].is_active) {
    return {
      user: null,
      response: NextResponse.json(
        { ok: false, message: "Account is inactive or unavailable." },
        { status: 401 }
      ),
    };
  }

  const row = result.rows[0];
  const role = row.role_name as AppRole;

  if (!allowedRoles.includes(role)) {
    return {
      user: null,
      response: NextResponse.json(
        { ok: false, message: "Insufficient permissions." },
        { status: 403 }
      ),
    };
  }

  return {
    user: {
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      role,
    },
    response: null,
  };
}
