import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE,
  authenticateAppUser,
  createSessionValue,
  getSafeNextPath,
  isAuthConfigured,
} from "@/lib/app-auth";

export const dynamic = "force-dynamic";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!isAuthConfigured()) {
    return NextResponse.json(
      { ok: false, message: "로그인 사용자 환경변수 NEWSLETTER_AUTH_USERS 설정이 필요합니다." },
      { status: 503 },
    );
  }

  if (!payload) {
    return NextResponse.json({ ok: false, message: "로그인 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const user = authenticateAppUser(asText(payload.id), String(payload.password ?? ""));

  if (!user) {
    return NextResponse.json({ ok: false, message: "아이디 또는 비밀번호를 확인해 주세요." }, { status: 401 });
  }

  const nextPath = getSafeNextPath(payload.nextPath);
  const response = NextResponse.json({ ok: true, nextPath });

  response.cookies.set(AUTH_COOKIE_NAME, createSessionValue(user), {
    httpOnly: true,
    maxAge: AUTH_SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
