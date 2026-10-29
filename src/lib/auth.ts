
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "airspace_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export type SessionUser = {
  userId: number;
  fullName: string;
  email: string;
  role: "ADMIN" | "OPERATOR";
};

type DatabaseUser = {
  user_id: number;
  full_name: string;
  email: string;
  role_name: "ADMIN" | "OPERATOR";
};

function getSecret() {
  const value = process.env.AUTH_SECRET;

  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Check .env.local."
    );
  }

  return new TextEncoder().encode(value);
}

export async function createSessionToken(
  user: DatabaseUser
): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.full_name,
    role: user.role_name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.user_id))
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (
      !payload.sub ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      !["ADMIN", "OPERATOR"].includes(String(payload.role))
    ) {
      return null;
    }

    return {
      userId: Number(payload.sub),
      fullName: payload.name,
      email: payload.email,
      role: payload.role as "ADMIN" | "OPERATOR",
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function sessionCookieName() {
  return COOKIE_NAME;
}
