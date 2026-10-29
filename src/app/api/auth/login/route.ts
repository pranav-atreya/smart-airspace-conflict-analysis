
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import pool from "@/lib/db";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().email().max(150),
  password: z.string().min(1).max(256),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const password = parsed.data.password;

    const result = await pool.query(
      `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.password_hash,
        r.role_name
      FROM app_user u
      JOIN role r ON r.role_id = u.role_id
      WHERE lower(u.email) = $1
        AND u.is_active = TRUE
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json(
        { ok: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (!["ADMIN", "OPERATOR"].includes(user.role_name)) {
      return NextResponse.json(
        { ok: false, message: "This account has no permitted role." },
        { status: 403 }
      );
    }

    const token = await createSessionToken(user);

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.user_id,
        name: user.full_name,
        email: user.email,
        role: user.role_name,
      },
    });

    response.cookies.set(
      sessionCookieName(),
      token,
      sessionCookieOptions()
    );

    return response;
  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      { ok: false, message: "Login failed due to a server error." },
      { status: 500 }
    );
  }
}
