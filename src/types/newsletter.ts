export type NewsletterPage = {
  number: number;
  title: string;
  status: string;
  isVisible?: boolean;
  backgroundAssetId?: string;
  pcEbookSpread?: "single" | "double";
  links?: NewsletterPageLink[];
};

export type NewsletterPageLink = {
  id: string;
  label: string;
  type: "url" | "phone" | "map" | "email" | "internal_page" | "download";
  value: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type NewsletterTocItem = {
  id: string;
  order: number;
  title: string;
  targetType: "page" | "article" | "external_url";
  targetId: string;
  isVisible: boolean;
};

export type NewsletterArticle = {
  id: string;
  page: string;
  title: string;
  status: string;
  summary: string;
  body: string;
  imageTone: string;
  audioStatus: string;
  audioDuration: string;
  buttons: string[];
};

export type NewsletterProject = {
  slug: string;
  title: string;
  issue: string;
  organization: string;
  publishDate: string;
  description: string;
  previewTitle: string;
  previewDescription: string;
  popupNotice?: string;
  pcEbookPageCount: 1 | 2;
  publicUrl: string;
  ebookUrl: string;
  pages: NewsletterPage[];
  tocItems: NewsletterTocItem[];
  articles: NewsletterArticle[];
};

export type DashboardProject = {
  title: string;
  organization: string;
  issue: string;
  status: string;
  pages: string;
  reading: string;
  audio: string;
  updated: string;
};

export type ImageAsset = {
  id?: string;
  name: string;
  source: string;
  rights: string;
  quality: string;
  usage: string;
  review: string;
  tone: string;
  altText?: string;
  publicGalleryEnabled?: boolean;
};

export type GalleryItem = {
  id: string;
  title: string;
  assetId: string;
  caption: string;
  linkUrl?: string;
  isVisible: boolean;
};

export type AudioTrack = {
  page: string;
  title: string;
  status: string;
  file: string;
  duration: string;
  script: string;
};

export type RecipientGroup = {
  id: string;
  name: string;
  description: string;
};

export type Recipient = {
  id: string;
  groupId: string;
  name: string;
  phone?: string;
  email?: string;
  kakaoAllowed: boolean;
  smsAllowed: boolean;
  emailAllowed: boolean;
};

export type SendCampaign = {
  id: string;
  projectSlug: string;
  channel: "kakao" | "sms" | "email";
  targetGroupId: string;
  status: "draft" | "ready" | "sent" | "failed";
  sentAt?: string;
};

export type SurveyQuestion = {
  id: string;
  order: number;
  title: string;
  type: "single_choice" | "multiple_choice" | "short_text" | "long_text" | "scale";
  options: string[];
  isRequired: boolean;
};

export type Survey = {
  id: string;
  projectSlug: string;
  title: string;
  description: string;
  status: "draft" | "open" | "closed";
  questions: SurveyQuestion[];
};

export type SurveyResponseSummary = {
  surveyId: string;
  totalResponses: number;
  lastSubmittedAt: string;
  exportStatus: "ready" | "preparing" | "restricted";
};

export type LabelValue = {
  label: string;
  value: string;
};

export type LabelStatus = {
  label: string;
  status: string;
};

export type LabelStatusDetail = LabelStatus & {
  detail: string;
};
