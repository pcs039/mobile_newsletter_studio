import type { FontAsset } from "@/lib/newsletter-repository";
import { getFontAssetById, getSelectableFontAssets } from "@/lib/font-css";

export type FontPickerFamily = {
  id: string;
  label: string;
  representativeId: string;
  fonts: FontAsset[];
  searchText: string;
  preferred: boolean;
};

const searchable = (value: string) => value.normalize("NFC").toLocaleLowerCase("en").replace(/\s+/g, "");

// Database family identity only: similarly named legacy standalone files stay separate.
export function getFontPickerFamilies(fonts: FontAsset[], preferredIds: string[] = []): FontPickerFamily[] {
  const groups = new Map<string, FontAsset[]>();
  for (const font of fonts) {
    if (!getFontAssetById([font], font.id)) continue;
    const id = font.familyId ? `family:${font.familyId}` : `asset:${font.id}`;
    const group = groups.get(id) ?? [];
    group.push(font);
    groups.set(id, group);
  }
  return [...groups].map(([id, members]) => {
    const representative = getSelectableFontAssets(members)[0];
    return {
      id,
      label: representative.familyDisplayName || representative.family || representative.name,
      representativeId: representative.id,
      fonts: members,
      searchText: searchable(members.flatMap(font => [font.familyDisplayName, font.family, font.name, font.cssFamily, font.sourceFileName]).join(" ")),
      preferred: members.some(font => preferredIds.includes(font.id)),
    };
  }).sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.label.localeCompare(b.label, "ko") || a.id.localeCompare(b.id));
}

export function searchFontPickerFamilies(groups: FontPickerFamily[], query: string) {
  const term = searchable(query.trim());
  return groups.filter(group => group.searchText.includes(term));
}

export function getFontPickerFaces(group: FontPickerFamily) {
  return [...new Set(group.fonts.map(font => `${font.weight || "400"} / ${font.style || "normal"}`))]
    .sort((a, b) => Number(a.split(" / ")[0]) - Number(b.split(" / ")[0]) || a.localeCompare(b));
}
