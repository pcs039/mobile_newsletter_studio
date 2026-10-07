import "server-only";

import type {
  DesignProcessingOperation,
  DesignProcessingProvider,
} from "@/lib/design-processing/types";

export type DesignProcessingProviderAdapter = {
  provider: DesignProcessingProvider;
  supportedOperations: readonly DesignProcessingOperation[];
};

const providerAdapters: Record<DesignProcessingProvider, DesignProcessingProviderAdapter> = {
  adobe_illustrator: {
    provider: "adobe_illustrator",
    supportedOperations: ["adobe_illustrator_rendition", "adobe_illustrator_trace"],
  },
  adobe_photoshop: {
    provider: "adobe_photoshop",
    supportedOperations: ["adobe_photoshop_rendition", "adobe_photoshop_remove_background"],
  },
  adobe_express: {
    provider: "adobe_express",
    supportedOperations: ["adobe_express_edit"],
  },
  canva: {
    provider: "canva",
    supportedOperations: ["canva_design", "canva_export"],
  },
  ai: {
    provider: "ai",
    supportedOperations: ["ai_generate_asset"],
  },
};

export function getDesignProcessingProviderAdapter(provider: DesignProcessingProvider) {
  return providerAdapters[provider];
}

export function providerSupportsDesignProcessingOperation(
  provider: DesignProcessingProvider,
  operation: DesignProcessingOperation,
) {
  return providerAdapters[provider].supportedOperations.includes(operation);
}
