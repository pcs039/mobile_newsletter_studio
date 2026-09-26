import { NextResponse } from "next/server";
import { canAccessProject, requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import {
  getProjectDesignKit,
  upsertProjectDesignKit,
  type ProjectDesignKit,
  type ProjectDesignKitInput,
} from "@/lib/newsletter-repository";

export const dynamic = "force-dynamic";

const buttonStyles = ["solid", "outline", "soft"] as const;
const iconStyles = ["outline", "filled", "illustration"] as const;
const imageStyles = ["photo", "illustration", "mixed"] as const;

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function getProjectSlugFromUrl(request: Request) {
  const url = new URL(request.url);

  return url.searchParams.get("projectSlug")?.trim() || url.searchParams.get("projectId")?.trim() || "";
}

type ReadDesignKitInputResult =
  | { ok: true; input: ProjectDesignKitInput }
  | { ok: false; message: string };
type DesignKitInputError = Extract<ReadDesignKitInputResult, { ok: false }>;

function hasOwn(payload: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

function readOptionalText(payload: Record<string, unknown>, key: string, currentValue: string) {
  return hasOwn(payload, key) ? asText(payload[key]) : currentValue;
}

function readHexColor(payload: Record<string, unknown>, key: string, label: string, currentValue: string): DesignKitInputError | string {
  if (!hasOwn(payload, key)) {
    return currentValue;
  }

  const value = payload[key];

  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return { ok: false, message: `${label}은 #092046 형식의 6자리 HEX 색상으로 입력하세요.` };
  }

  return value.trim();
}

function readIntegerInRange(
  payload: Record<string, unknown>,
  key: string,
  label: string,
  currentValue: number,
  min: number,
  max: number,
): DesignKitInputError | number {
  if (!hasOwn(payload, key)) {
    return currentValue;
  }

  const value = payload[key];
  const numberValue = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;

  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    return { ok: false, message: `${label}은 ${min}~${max} 사이의 정수로 입력하세요.` };
  }

  return numberValue;
}

function readEnumValue<T extends readonly string[]>(
  payload: Record<string, unknown>,
  key: string,
  label: string,
  values: T,
  currentValue: T[number],
): DesignKitInputError | T[number] {
  if (!hasOwn(payload, key)) {
    return currentValue;
  }

  if (!isOneOf(payload[key], values)) {
    return { ok: false, message: `${label} 값이 올바르지 않습니다.` };
  }

  return payload[key];
}

function isInputError(value: unknown): value is DesignKitInputError {
  return Boolean(value && typeof value === "object" && "ok" in value && (value as { ok?: unknown }).ok === false);
}

function readDesignKitInput(payload: Record<string, unknown>, current: ProjectDesignKit): ReadDesignKitInputResult {
  const primaryColor = readHexColor(payload, "primaryColor", "대표 색상", current.primaryColor);
  if (isInputError(primaryColor)) return primaryColor;

  const secondaryColor = readHexColor(payload, "secondaryColor", "보조 색상", current.secondaryColor);
  if (isInputError(secondaryColor)) return secondaryColor;

  const accentColor = readHexColor(payload, "accentColor", "강조 색상", current.accentColor);
  if (isInputError(accentColor)) return accentColor;

  const backgroundColor = readHexColor(payload, "backgroundColor", "배경 색상", current.backgroundColor);
  if (isInputError(backgroundColor)) return backgroundColor;

  const textColor = readHexColor(payload, "textColor", "기본 글자 색상", current.textColor);
  if (isInputError(textColor)) return textColor;

  const buttonRadius = readIntegerInRange(payload, "buttonRadius", "버튼 모서리", current.buttonRadius, 0, 40);
  if (isInputError(buttonRadius)) return buttonRadius;

  const cardRadius = readIntegerInRange(payload, "cardRadius", "카드 모서리", current.cardRadius, 0, 48);
  if (isInputError(cardRadius)) return cardRadius;

  const buttonStyle = readEnumValue(payload, "buttonStyle", "버튼 스타일", buttonStyles, current.buttonStyle);
  if (isInputError(buttonStyle)) return buttonStyle;

  const iconStyle = readEnumValue(payload, "iconStyle", "아이콘 스타일", iconStyles, current.iconStyle);
  if (isInputError(iconStyle)) return iconStyle;

  const imageStyle = readEnumValue(payload, "imageStyle", "이미지 스타일", imageStyles, current.imageStyle);
  if (isInputError(imageStyle)) return imageStyle;

  return {
    ok: true,
    input: {
      logoUrl: readOptionalText(payload, "logoUrl", current.logoUrl),
      logoAlt: readOptionalText(payload, "logoAlt", current.logoAlt),
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      textColor,
      headingFontFamily: readOptionalText(payload, "headingFontFamily", current.headingFontFamily),
      bodyFontFamily: readOptionalText(payload, "bodyFontFamily", current.bodyFontFamily),
      buttonRadius,
      cardRadius,
      buttonStyle,
      iconStyle,
      imageStyle,
      templateNotes: readOptionalText(payload, "templateNotes", current.templateNotes),
      designTokens: current.designTokens,
    },
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

  const result = await getProjectDesignKit(projectSlug);

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.httpStatus ?? (result.source === "unconfigured" ? 503 : 500),
    });
  }

  if (!canAccessProject(user, result.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 Design Kit을 열 권한이 없습니다." }, { status: 403 });
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
    return NextResponse.json({ ok: false, message: "Design Kit 저장 요청 데이터를 확인하지 못했습니다." }, { status: 400 });
  }

  const projectSlug = asText(payload.projectSlug) || asText(payload.projectId);

  if (!projectSlug) {
    return NextResponse.json({ ok: false, message: "프로젝트 ID를 확인하지 못했습니다." }, { status: 400 });
  }

  const current = await getProjectDesignKit(projectSlug);

  if (!current.ok) {
    return NextResponse.json(current, {
      status: current.httpStatus ?? (current.source === "unconfigured" ? 503 : 500),
    });
  }

  if (!canAccessProject(user, current.project)) {
    return NextResponse.json({ ok: false, message: "이 프로젝트의 Design Kit을 수정할 권한이 없습니다." }, { status: 403 });
  }

  const input = readDesignKitInput(payload, current.designKit);

  if (!input.ok) {
    return NextResponse.json({ ok: false, message: input.message }, { status: 400 });
  }

  const result = await upsertProjectDesignKit(projectSlug, input.input);

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.httpStatus ?? (result.status === "not_configured" ? 503 : result.status === "not_found" ? 404 : 500),
    });
  }

  return NextResponse.json(result);
}
