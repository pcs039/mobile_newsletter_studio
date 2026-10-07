import type {
  ProjectDesignAssetApprovalStatus,
  ProjectDesignAssetUsageRole,
  ProjectDesignProductionAssetType,
} from "@/lib/newsletter-repository";

export const productionAssetTypes: ProjectDesignProductionAssetType[] = [
  "background",
  "illustration",
  "icon",
  "card_frame",
  "banner",
  "pattern",
  "decoration",
];

export const productionAssetLabels: Record<ProjectDesignProductionAssetType, string> = {
  background: "배경",
  illustration: "일러스트",
  icon: "아이콘",
  card_frame: "카드",
  banner: "배너",
  pattern: "패턴",
  decoration: "장식",
};

export const usageRoleLabels: Record<ProjectDesignAssetUsageRole, string> = {
  header: "헤더",
  section: "섹션",
  card: "카드",
  article: "기사",
  footer: "푸터",
  general: "공통",
};

export const approvalStatusLabels: Record<ProjectDesignAssetApprovalStatus, string> = {
  draft: "검토 중",
  approved: "승인",
  archived: "보관",
};
