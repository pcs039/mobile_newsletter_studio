import "server-only";

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const CLIENT_REVIEW_COOKIE_PREFIX = "datadiction_client_review_";
const clientReviewTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createClientReviewToken() {
  return randomBytes(32).toString("base64url");
}

export function isClientReviewToken(value: string) {
  return clientReviewTokenPattern.test(value);
}

export function hashClientReviewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getClientReviewCookieName(projectSlug: string) {
  const projectKey = createHash("sha256").update(projectSlug.trim()).digest("hex").slice(0, 20);
  return `${CLIENT_REVIEW_COOKIE_PREFIX}${projectKey}`;
}

export async function getClientReviewCookieToken(projectSlug: string) {
  const cookieStore = await cookies();
  return cookieStore.get(getClientReviewCookieName(projectSlug))?.value ?? "";
}

export function setClientReviewCookie(
  response: NextResponse,
  projectSlug: string,
  token: string,
  expiresAt: string,
) {
  response.cookies.set(getClientReviewCookieName(projectSlug), token, {
    expires: new Date(expiresAt),
    httpOnly: true,
    path: "/",
    priority: "high",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearClientReviewCookie(response: NextResponse, projectSlug: string) {
  response.cookies.set(getClientReviewCookieName(projectSlug), "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}
