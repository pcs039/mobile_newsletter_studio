import type { FontAsset } from "@/lib/newsletter-repository";

const fontFormatMap: Record<string, string> = {
  otf: "opentype",
  ttf: "truetype",
  woff: "woff",
  woff2: "woff2",
};

function escapeCssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "");
}

export function getFontFamilyValue(font: FontAsset | null | undefined) {
  return font ? `"${escapeCssString(font.cssFamily)}", var(--font-app-sans, system-ui, sans-serif)` : undefined;
}

export function getFontAssetById(fonts: FontAsset[], id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return fonts.find((font) => font.id === id && font.isActive && font.webfontAllowed && font.fileUrl) ?? null;
}

export function getFontFaceCss(fonts: FontAsset[]) {
  return fonts
    .filter((font) => font.isActive && font.webfontAllowed && font.fileUrl)
    .map((font) => {
      const format = fontFormatMap[font.fileFormat] ?? font.fileFormat;

      return [
        "@font-face {",
        `  font-family: "${escapeCssString(font.cssFamily)}";`,
        `  src: url("${escapeCssString(font.fileUrl)}") format("${escapeCssString(format)}");`,
        `  font-weight: ${font.weight || "400"};`,
        `  font-style: ${font.style || "normal"};`,
        "  font-display: swap;",
        "}",
      ].join("\n");
    })
    .join("\n\n");
}
