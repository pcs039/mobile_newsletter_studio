import { NextResponse } from "next/server";
import { canAccessProject, requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import {
  getProjectHomeSettings,
  upsertProjectHomeSettings,
  type ProjectHomeSettings,
  type ProjectHomeSettingsInput,
  type PublicHomeSectionKey,
} from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

const sectionKeys: PublicHomeSectionKey[] = ["must_know", "support", "local", "life", "event"];

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown) {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,，\n]/)
      : [];
  const seen = new Set<string>();

  return rawList
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    })
    .slice(0, 24);
}

function getProjectSlugFromUrl(request: Request) {
  const url = new URL(request.url);

  return url.searchParams.get("projectSlug")?.trim() || url.searchParams.get("projectId")?.trim() || "";
}

function readHomeSettingsInput(payload: Record<string, unknown>, current: ProjectHomeSettings): ProjectHomeSettingsInput {
  const incomingSections = Array.isArray(payload.sectionSettings) ? payload.sectionSettings : [];
  const inputSectionMap = new Map<string, Record<string, unknown>>();

  incomingSections.forEach((section) => {
    if (!section || typeof section !== "object") {
      return;
    }

    const record = section as Record<string, unknown>;
    const key = asText(record.key);

    if (sectionKeys.includes(key as PublicHomeSectionKey)) {
      inputSectionMap.set(key, record);
    }
  });

  return {
    isEnabled: Boolean(payload.isEnabled),
    regions: asStringList(payload.regions),
    sectionSettings: current.sectionSettings.map((section) => {
      const incoming = inputSectionMap.get(section.key);
      const order = Number(incoming?.order);

      return {
        key: section.key,
        label: asText(incoming?.label) || section.label,
        enabled: typeof incoming?.enabled === "boolean" ? incoming.enabled : section.enabled,
        order: Number.isFinite(order) ? order : section.order,
      };
    }),
  };
}

export async function GET(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const projectSlug = getProjectSlugFromUrl(request);

  if (!projectSlug) {
    return NextResponse.json({ ok: false, message: "프로젝트 ID를 확인하지 못했습니다." }, { status: 400 });
  }

  const result = await getProjectHomeSettings(projectSlug);

  if (!result.project || !canAccessProject(user, result.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 첫 화면 설정을 열 권한이 없습니다." }, { status: 403 });
  }

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.httpStatus ?? (result.source === "unconfigured" ? 503 : 500),
    });
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!payload) {
    return NextResponse.json({ ok: false, message: "첫 화면 설정 저장 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const projectSlug = asText(payload.projectSlug) || asText(payload.projectId);

  if (!projectSlug) {
    return NextResponse.json({ ok: false, message: "프로젝트 ID를 확인하지 못했습니다." }, { status: 400 });
  }

  const current = await getProjectHomeSettings(projectSlug);

  if (!current.project || !canAccessProject(user, current.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 첫 화면 설정을 수정할 권한이 없습니다." }, { status: 403 });
  }

  if (!current.settings) {
    return NextResponse.json(current, {
      status: current.ok ? 500 : current.httpStatus ?? (current.source === "unconfigured" ? 503 : 500),
    });
  }

  const result = await upsertProjectHomeSettings(projectSlug, readHomeSettingsInput(payload, current.settings));

  if (!result.ok) {
    return NextResponse.json(result, {
      status:
        result.status === "not_configured"
          ? 503
          : result.status === "not_found"
            ? 404
            : result.status === "invalid_input"
              ? 400
              : result.httpStatus ?? 500,
    });
  }

  return NextResponse.json(result);
}
