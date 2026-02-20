import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

const encoder = new TextEncoder();

export type SessionPayload = {
  sub: string;
  email: string;
};

function secretKey() {
  return encoder.encode(env().AUTH_SECRET);
}

export function authCookieName() {
  return env().AUTH_COOKIE_NAME;
}

function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  try {
    const verified = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    const sub = verified.payload.sub;
    const email = verified.payload.email;
    if (!sub || typeof email !== "string") {
      return null;
    }
    return { sub, email } satisfies SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(authCookieName(), token, authCookieOptions());
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(authCookieName(), "", {
    ...authCookieOptions(),
    maxAge: 0,
  });
}

export async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(authCookieName())?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export async function getSessionFromServerCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName())?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export async function requireUserFromRequest(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Login required");
  }

  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid session");
  }

  return user;
}

export async function requireUserFromCookies() {
  const session = await getSessionFromServerCookies();
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Login required");
  }

  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid session");
  }

  return user;
}
