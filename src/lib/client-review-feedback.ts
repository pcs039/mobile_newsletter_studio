export const CLIENT_REVIEW_FEEDBACK_MAX_LENGTH = 2000;

export function getClientReviewFeedbackLength(value: string) {
  // PostgreSQL char_length counts Unicode code points, including emoji as one character.
  return Array.from(value).length;
}

export function normalizeClientReviewFeedback(value: string | null | undefined) {
  return value?.replace(/\r\n?/g, "\n").trim() || null;
}
