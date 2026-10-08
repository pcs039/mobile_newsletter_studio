import type { ArticleCompositionPlacementSettings } from "@/lib/article-composition";

// Only this payload crosses the server/client boundary. No design management metadata.
export type ArticleHeroBackground = {
  url: string;
  settings: ArticleCompositionPlacementSettings;
  visible: boolean;
};
