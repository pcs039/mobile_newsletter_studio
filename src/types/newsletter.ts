export type NewsletterPage = {
  number: number;
  title: string;
  status: string;
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
  publicUrl: string;
  ebookUrl: string;
  pages: NewsletterPage[];
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
  name: string;
  source: string;
  rights: string;
  quality: string;
  usage: string;
  review: string;
  tone: string;
};

export type AudioTrack = {
  page: string;
  title: string;
  status: string;
  file: string;
  duration: string;
  script: string;
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
