import { getFontFaceCss } from "@/lib/font-css";
import type { FontAsset } from "@/lib/newsletter-repository";

export function PublicFontFaceStyle({ fonts }: { fonts: FontAsset[] }) {
  const css = getFontFaceCss(fonts);

  if (!css) {
    return null;
  }

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
