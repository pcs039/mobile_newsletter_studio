import type { FontAsset } from "@/lib/newsletter-repository";
import { getSelectableFontAssets } from "@/lib/font-css";

// Keep an existing face ID even if family grouping chooses Regular, the library
// is unavailable, or a face/family has since been deactivated. This does not
// enable an inactive face for rendering or offer other inactive faces for selection.
export function getProjectFontOptions(fonts: FontAsset[], currentId?: string) {
  const choices = getSelectableFontAssets(fonts).map(font => ({ id: font.id, label: font.name }));
  if (currentId && !choices.some(font => font.id === currentId)) {
    const current = fonts.find(font => font.id === currentId);
    choices.unshift({ id: currentId, label: current
      ? `${current.name} · ${current.weight} · 기존 선택 유지`
      : "기존 선택 유지 · 목록에서 확인 불가" });
  }
  return choices;
}

export function projectFontFormValue(form: FormData, key: string, currentId?: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : currentId ?? "";
}
