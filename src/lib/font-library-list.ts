import type { FontAsset } from "@/lib/newsletter-repository";
import { getFontAssetById } from "@/lib/font-css";

export type FontLibraryGroup = { id: string; label: string; fonts: FontAsset[]; available: number; created: string; search: string };
const normalize = (value: string) => value.normalize("NFC").toLocaleLowerCase("en").replace(/\s+/g, "");
export function groupFontLibrary(fonts: FontAsset[]): FontLibraryGroup[] {
  const groups = new Map<string, FontAsset[]>();
  for (const font of fonts) {
    const id = font.familyId ? `family:${font.familyId}` : `asset:${font.id}`;
    groups.set(id, [...(groups.get(id) ?? []), font]);
  }
  return [...groups].map(([id, members]) => ({
    id, label: members[0].familyDisplayName || members[0].family || members[0].name,
    fonts: [...members].sort((a, b) => Number(a.weight) - Number(b.weight) || a.style.localeCompare(b.style) || a.id.localeCompare(b.id)),
    available: members.filter(font => getFontAssetById([font], font.id)).length,
    created: members.map(font => font.created).filter(value => value && value !== "-").sort().at(-1) ?? "",
    search: normalize(members.flatMap(font => [font.name, font.familyDisplayName, font.family, font.sourceFileName]).join(" ")),
  }));
}
export function filterFontLibrary(groups: FontLibraryGroup[], query: string, status: string, order: string) {
  return groups.filter(group => group.search.includes(normalize(query)) &&
    (status === "all" || (status === "active" ? group.available > 0 : group.available === 0)))
    .sort((a, b) => (order === "recent" ? b.created.localeCompare(a.created) : 0) || a.label.localeCompare(b.label, "ko") || a.id.localeCompare(b.id));
}
