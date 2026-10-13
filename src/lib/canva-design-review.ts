// Client-only review acknowledgement, never a publishing or asset approval.
export type CanvaDesignReviewStatus = "not_created" | "created" | "reviewing" | "approved" | "needs_revision";
export type CanvaDesignReview = {
  designId: string;
  editUrl: string;
  status: Exclude<CanvaDesignReviewStatus, "not_created">;
  completedAt: string;
};
export function receiveCanvaDesign(previous: CanvaDesignReview | null, designId: string, editUrl: string, completedAt: string): CanvaDesignReview {
  // A duplicate of the same design retains the operator's review decision.
  return previous?.designId === designId ? { ...previous, editUrl } : { designId, editUrl, completedAt, status: "created" };
}
export function reviewCanvaDesign(previous: CanvaDesignReview, action: "approve" | "open" | "revise" | "cancel"): CanvaDesignReview {
  return { ...previous, status: action === "approve" ? "approved" : action === "revise" ? "needs_revision" : action === "cancel" ? "created" : previous.status === "created" ? "reviewing" : previous.status };
}
export function restoreCanvaReview(value: unknown, context: string): CanvaDesignReview | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (entry.context !== context || !entry.review || typeof entry.review !== "object") return null;
  const review = entry.review as Record<string, unknown>;
  if (typeof review.designId !== "string" || !review.designId || typeof review.editUrl !== "string" || typeof review.completedAt !== "string" || !["created", "reviewing", "approved", "needs_revision"].includes(String(review.status))) return null;
  return review as CanvaDesignReview;
}
