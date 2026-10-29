
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "airspace_session";

async function hasValidSession(token?: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret || secret.length < 32) {
    return false;
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );

    return (
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      typeof payload.email === "string" &&
      ["ADMIN", "OPERATOR"].includes(String(payload.role))
    );
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const authenticated = await hasValidSession(token);

  // Authentication endpoints must remain accessible as appropriate.
  const publicAuthEndpoints = [
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/logout",
  ];

  if (publicAuthEndpoints.includes(pathname)) {
    return NextResponse.next();
  }

  // API requests should receive JSON errors, not page redirects.
  if (pathname.startsWith("/api/")) {
    if (!authenticated) {
      return NextResponse.json(
        { ok: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // Let unauthenticated users access the login screen.
  if (pathname === "/login") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  // Protect dashboard and other application pages.
  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      pathname + request.nextUrl.search
    );

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
