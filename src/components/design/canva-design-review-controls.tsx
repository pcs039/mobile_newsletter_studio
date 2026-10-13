"use client";
import type { CanvaDesignReview } from "@/lib/canva-design-review";
export function CanvaDesignReviewControls({ review, templateName, disabled, onAction, onChooseAnother }: {
  review: CanvaDesignReview; templateName: string; disabled: boolean;
  onAction: (action: "approve" | "open" | "revise" | "cancel") => void;
  onChooseAnother: () => void;
}) {
  const approved = review.status === "approved";
  return <section aria-label="Canva 디자인 결과 검토" className="mt-3 min-w-0 rounded-lg border border-sky-200 bg-sky-50 p-3 [overflow-wrap:anywhere]">
    <p role="status" className="text-sm font-bold">{approved ? "이 디자인을 사용하기로 했습니다." : "Canva 디자인 생성 완료"}</p>
    <p className="mt-2 text-sm">{templateName}</p>
    <p className="mt-1 text-xs text-slate-600">디자인 ID: {review.designId} · 제작 완료</p>
    <p className="mt-2 text-sm">{approved ? "Canva에서 다시 수정할 수 있습니다." : review.status === "needs_revision" ? "수정 내용을 Canva에서 확인한 뒤 다시 승인하세요." : "생성 결과를 확인한 뒤 사용할 디자인을 결정하세요."}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <a className="dd-btn dd-btn-secondary max-w-full" style={{ whiteSpace: "normal" }} href={review.editUrl} target="_blank" rel="noopener noreferrer" onClick={() => onAction("open")}>{approved ? "Canva에서 열기" : "Canva에서 확인"}</a>
      {approved ? <button type="button" disabled={disabled} className="dd-btn dd-btn-secondary max-w-full" onClick={() => onAction("cancel")}>선택 취소</button> : <>
        <button type="button" disabled={disabled} className="dd-btn dd-btn-primary max-w-full" onClick={() => onAction("approve")}>이 디자인 사용</button>
        <a className="dd-btn dd-btn-secondary max-w-full" style={{ whiteSpace: "normal" }} href={review.editUrl} target="_blank" rel="noopener noreferrer" onClick={() => onAction("revise")}>Canva에서 수정</a>
      </>}
      <button type="button" disabled={disabled} className="dd-btn dd-btn-secondary max-w-full" onClick={onChooseAnother}>다른 디자인 선택</button>
    </div>
    <p className="mt-2 text-xs text-slate-600">검토 선택만 기록합니다. 기사 이미지 적용이나 공개 발행은 진행하지 않습니다. Canva 수정 완료 여부는 직접 확인해 주세요.</p>
  </section>;
}
