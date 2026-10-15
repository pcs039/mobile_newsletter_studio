import type { ProjectDesignAsset } from "@/lib/newsletter-repository";
import type { useCompositionSaveState, DesignSaveStatus } from "@/components/design/use-composition-save-state";

export const designSaveLabels: Record<DesignSaveStatus, string> = {
  dirty: "변경사항 있음 — 저장 필요", saving: "저장 중", saved: "저장 완료", error: "저장 실패 — 재시도 필요",
};
const slotLabels = { hero_background: "배경판", hero_illustration: "상단 이미지·장식", title_icon: "제목 옆 아이콘", body_decoration: "본문 주변 장식", footer_banner: "하단 이미지·배너" };
export function DesignSaveSummary({ state, assets }: {
  state: ReturnType<typeof useCompositionSaveState>; assets: ProjectDesignAsset[];
}) {
  const saved = state.saved;
  return <section aria-label="디자인 저장 및 공개 표시 상태" className="mt-4 min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm [overflow-wrap:anywhere]">
    <div role="status" aria-live="polite">
      <p><strong>텍스트 디자인:</strong> {designSaveLabels[state.textStatus]} · 버튼으로 저장</p>
      <p className="mt-1"><strong>배치·표시 설정:</strong> {designSaveLabels[state.layoutStatus]} · 항목별 자동 저장</p>
      {state.error ? <p className="mt-2 text-rose-800">{state.error} 로컬 입력은 유지됩니다. 추가·삭제·복사 결과가 불확실하면 저장본을 다시 확인하세요.</p> : null}
    </div>
    {state.canRetryLayout ? <button type="button" disabled={state.busy} onClick={state.retryLayout} className="dd-btn dd-btn-secondary mt-2">실패한 디자인 설정 다시 저장</button> : null}
    <p className="mt-2">저장본 구성: {saved?.status === "ready" ? "준비 완료" : "작성 중 · 독자 화면 미반영"}. 기사 공개·기관 검토 권한 조건은 별도로 적용됩니다.</p>
    <details className="mt-2">
      <summary className="cursor-pointer font-bold">독자 화면 표시 조건 확인</summary>
      <p className="mt-2">준비 완료 구성의 승인·활성 자산 중 표시한 배경판과 상단 이미지·장식만 독자 화면에 반영됩니다.</p>
      <p className="mt-1 text-amber-900">제목 옆 아이콘·본문 주변 장식·하단 이미지·배너는 편집·저장할 수 있지만 현재 공개·검토 화면에는 반영되지 않습니다.</p>
      <ul className="mt-2 space-y-1">
        {saved?.assets.map(p => {
          const asset = assets.find(a => a.id === p.assetId);
          const reasons = [
            ...(!["hero_background", "hero_illustration"].includes(p.slot) ? ["미지원 슬롯"] : []),
            ...(saved.status !== "ready" ? ["구성 작성 중"] : []), ...(!p.isVisible ? ["숨김"] : []),
            ...(!asset ? ["자산 없음"] : [...(asset.approvalStatus !== "approved" ? ["자산 미승인"] : []), ...(!asset.isActive ? ["자산 비활성"] : [])]),
          ];
          return <li key={p.id}>{slotLabels[p.slot]} · {asset?.name ?? "연결된 자산"}: {reasons.length ? reasons.join(" · ") : "기본 표시 조건 충족 · 저장본 미리보기에서 확인"}</li>;
        })}
      </ul>
    </details>
  </section>;
}
