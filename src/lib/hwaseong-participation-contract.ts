import type { ProjectSurveyItem } from "@/lib/newsletter-repository";

export const participationKinds = ["private", "comment", "survey"] as const;
export type ParticipationKind = typeof participationKinds[number];
export type ParticipationEntry = { id: string; article_id: string; kind: ParticipationKind; body: string | null; answers: Record<string, string | string[]>; survey_id: string | null; state: "private" | "pending" | "approved" | "rejected" | "recorded"; created_at: string };
export type ParticipationData = { commentsEnabled: boolean; survey: ProjectSurveyItem | null; comments: Pick<ParticipationEntry, "id" | "body" | "created_at">[]; token: string; isAdmin: boolean };
export const participationUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// This PoC collects no names, contact details or account identifiers in submitted text.
export function safeParticipationText(value: unknown, limit: number) {
  if (typeof value !== "string") throw Error("내용을 입력해 주세요.");
  const text = value.replace(/\r\n?/g, "\n").normalize("NFC").trim();
  if (!text || Array.from(text).length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw Error(`내용은 1~${limit}자로 입력해 주세요.`);
  if (/<[^>]*>|https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\d[\s().-]*){7,}/i.test(text)) throw Error("연락처·계좌번호·링크·HTML은 입력하지 마세요.");
  return text;
}
