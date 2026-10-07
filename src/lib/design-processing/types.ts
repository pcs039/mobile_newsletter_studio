export const designProcessingProviders = [
  "adobe_illustrator",
  "adobe_photoshop",
  "adobe_express",
  "canva",
  "ai",
] as const;

export type DesignProcessingProvider = (typeof designProcessingProviders)[number];

export const designProcessingOperations = [
  "adobe_illustrator_rendition",
  "adobe_illustrator_trace",
  "adobe_photoshop_rendition",
  "adobe_photoshop_remove_background",
  "adobe_express_edit",
  "canva_design",
  "canva_export",
  "ai_generate_asset",
] as const;

export type DesignProcessingOperation = (typeof designProcessingOperations)[number];

export const designProcessingJobStatuses = ["queued", "processing", "succeeded", "failed", "cancelled"] as const;

export type DesignProcessingJobStatus = (typeof designProcessingJobStatuses)[number];

export type DesignProcessingJsonValue =
  | boolean
  | number
  | string
  | null
  | DesignProcessingJsonValue[]
  | { [key: string]: DesignProcessingJsonValue };

export type DesignProcessingPayload = Record<string, DesignProcessingJsonValue>;

export type DesignProcessingJob = {
  completedAt: string;
  createdAt: string;
  errorCode: string;
  errorMessage: string;
  externalJobId: string;
  id: string;
  inputAssetId: string;
  operation: DesignProcessingOperation;
  projectId: string;
  provider: DesignProcessingProvider;
  requestPayload: DesignProcessingPayload;
  resultPayload: DesignProcessingPayload;
  startedAt: string;
  status: DesignProcessingJobStatus;
  statusUrl: string;
  updatedAt: string;
};

export type DesignProcessingJobSummary = Pick<
  DesignProcessingJob,
  | "completedAt"
  | "createdAt"
  | "errorCode"
  | "errorMessage"
  | "externalJobId"
  | "id"
  | "inputAssetId"
  | "operation"
  | "provider"
  | "startedAt"
  | "status"
  | "updatedAt"
> & {
  hasStatusUrl: boolean;
};

const allowedStatusTransitions: Record<DesignProcessingJobStatus, readonly DesignProcessingJobStatus[]> = {
  queued: ["processing", "failed", "cancelled"],
  processing: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function isDesignProcessingProvider(value: unknown): value is DesignProcessingProvider {
  return typeof value === "string" && designProcessingProviders.includes(value as DesignProcessingProvider);
}

export function isDesignProcessingOperation(value: unknown): value is DesignProcessingOperation {
  return typeof value === "string" && designProcessingOperations.includes(value as DesignProcessingOperation);
}

export function isDesignProcessingJobStatus(value: unknown): value is DesignProcessingJobStatus {
  return typeof value === "string" && designProcessingJobStatuses.includes(value as DesignProcessingJobStatus);
}

export function canTransitionDesignProcessingJobStatus(
  current: DesignProcessingJobStatus,
  next: DesignProcessingJobStatus,
) {
  return allowedStatusTransitions[current].includes(next);
}
