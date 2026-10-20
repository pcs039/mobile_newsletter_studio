"use client";

import { createContext, useContext } from "react";

type ArticleFontSettingsWorkspaceState = {
  compositionUnsettled?: boolean;
  articleSaving?: boolean;
  articleError?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onInvalidArticle?: () => void;
};

// RSC slots may be deferred React nodes, so share client state without cloning them.
export const ArticleFontSettingsContext = createContext<ArticleFontSettingsWorkspaceState>({});

export function useArticleFontSettingsWorkspace() {
  return useContext(ArticleFontSettingsContext);
}
