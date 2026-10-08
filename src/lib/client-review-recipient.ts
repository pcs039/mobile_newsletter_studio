export const CLIENT_REVIEW_EMAIL_MAX_LENGTH = 254;

export function parseClientReviewRecipientEmail(value: unknown): { ok: true; email: string | null } | { ok: false } {
  if (value === null) return { ok: true, email: null };
  if (typeof value !== "string") return { ok: false };
  const email = value.trim();
  if (!email) return { ok: true, email: null };
  const parts = email.split("@");
  const local = parts[0];
  const domain = parts[1];
  if (email.length > CLIENT_REVIEW_EMAIL_MAX_LENGTH || parts.length !== 2 || !local || local.length > 64
    || local.startsWith(".") || local.endsWith(".") || local.includes("..")
    || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    || !domain || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(domain)) return { ok: false };
  return { ok: true, email };
}
