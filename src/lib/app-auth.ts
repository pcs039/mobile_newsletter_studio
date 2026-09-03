import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "datadiction_newsletter_session";
export const AUTH_SESSION_MAX_AGE = 60 * 60 * 12;

export type AppUserRole = "admin" | "user";

export type AppUser = {
  id: string;
  name: string;
  role: AppUserRole;
};

type ConfiguredAppUser = AppUser & {
  password: string;
};

type ProjectAccessLike = {
  assigneeName?: string | null;
};

type SessionPayload = AppUser & {
  exp: number;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeConfiguredUser(value: unknown): ConfiguredAppUser | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const password = typeof record.password === "string" ? record.password : "";
  const name = typeof record.name === "string" ? record.name.trim() : id;
  const role = record.role === "admin" ? "admin" : record.role === "user" ? "user" : null;

  if (!id || !password || !name || !role) {
    return null;
  }

  return { id, password, name, role };
}

export function getConfiguredAppUsers() {
  const rawUsers = process.env.NEWSLETTER_AUTH_USERS?.trim();

  if (!rawUsers && process.env.NODE_ENV !== "production") {
    return [
      { id: "admin", password: "admin1234", name: "관리자", role: "admin" },
      { id: "user1", password: "user1234", name: "작업자1", role: "user" },
    ] satisfies ConfiguredAppUser[];
  }

  if (!rawUsers) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawUsers);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeConfiguredUser).filter((user): user is ConfiguredAppUser => user !== null);
  } catch {
    return [];
  }
}

export function isAuthConfigured() {
  return getConfiguredAppUsers().length > 0;
}

function getAuthSecret() {
  return process.env.NEWSLETTER_AUTH_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "local-dev-session-secret";
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createSessionValue(user: AppUser) {
  const payload: SessionPayload = {
    id: user.id,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + AUTH_SESSION_MAX_AGE,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function readSessionValue(value?: string | null): AppUser | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature || !safeCompare(signPayload(encodedPayload), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SessionPayload>;

    if (!payload.id || !payload.name || (payload.role !== "admin" && payload.role !== "user") || !payload.exp) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();

  return readSessionValue(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export async function requireAppUser(nextPath = "/") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(getSafeNextPath(nextPath))}`);
  }

  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return user;
}

export function unauthorizedJsonResponse() {
  return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
}

export function authenticateAppUser(id: string, password: string): AppUser | null {
  const normalizedId = id.trim();
  const user = getConfiguredAppUsers().find((candidate) => candidate.id === normalizedId);

  if (!user || !safeCompare(user.password, password)) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    role: user.role,
  };
}

export function getSafeNextPath(value: unknown) {
  if (typeof value !== "string") {
    return "/";
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\n") || trimmed.includes("\r")) {
    return "/";
  }

  return trimmed;
}

export function canAccessProject(user: AppUser, project: ProjectAccessLike | null | undefined) {
  if (user.role === "admin") {
    return true;
  }

  const assigneeName = project?.assigneeName?.trim();

  if (!assigneeName) {
    return false;
  }

  const normalizedAssignee = normalizeText(assigneeName);

  return normalizedAssignee === normalizeText(user.name) || normalizedAssignee === normalizeText(user.id);
}

export function filterProjectsForUser<T extends ProjectAccessLike>(projects: T[], user: AppUser) {
  return user.role === "admin" ? projects : projects.filter((project) => canAccessProject(user, project));
}
