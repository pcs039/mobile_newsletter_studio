import type { CSSProperties } from "react";
import type { FontAsset } from "@/lib/newsletter-repository";
import { getFontAssetById, getFontFaceFamilyValue } from "@/lib/font-css";

export const articleFontRoles = ["title", "summary", "body", "subheading", "caption", "button"] as const;
export type ArticleFontRole = typeof articleFontRoles[number];
// A face ID identifies both an existing family and its actual registered weight/style.
export type ArticleFontDesign = Partial<Record<ArticleFontRole, string>>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateArticleFontDesign(value: unknown): ArticleFontDesign | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !articleFontRoles.includes(key as ArticleFontRole))) return null;
  const result: ArticleFontDesign = {};
  for (const role of articleFontRoles) {
    if (!(role in input)) continue;
    if (typeof input[role] !== "string" || (input[role] !== "" && !uuid.test(input[role]))) return null;
    if (input[role]) result[role] = input[role];
  }
  return result;
}

export function articleFontDesignStyle(design: ArticleFontDesign | undefined, fonts: FontAsset[]) {
  const result: Record<string, string> = {};
  for (const role of articleFontRoles) {
    const font = getFontAssetById(fonts, design?.[role]);
    if (!font) continue; // Missing/disallowed file retains the template/system fallback.
    result[`--article-${role}-family`] = getFontFaceFamilyValue(font)!;
    result[`--article-${role}-weight`] = font.weight || "400";
    result[`--article-${role}-style`] = font.style || "normal";
  }
  return result as CSSProperties;
}

export function articleFontDesignRoles(design: ArticleFontDesign | undefined, fonts: FontAsset[]) {
  return articleFontRoles.filter(role => getFontAssetById(fonts, design?.[role])).join(" ");
}
