"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ProjectArticleComposition } from "@/lib/article-composition";
import type { ProjectDesignAsset } from "@/lib/newsletter-repository";
import { institutionAssetPlacementSlots, institutionPlacementLabels, isInstitutionPlacementSlot, type InstitutionPlacementSlot } from "@/lib/institution-asset-placement";

type Props = {
  assetId: string; assets: ProjectDesignAsset[]; composition: ProjectArticleComposition; disabled: boolean;
  onApply: (slot: InstitutionPlacementSlot, assetId: string) => Promise<boolean>; onClose: () => void;
};
export function InstitutionAssetPlacementConfirm({ assetId, assets, composition, disabled, onApply, onClose }: Props) {
  const [slot, setSlot] = useState("");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const pending = useRef(false), section = useRef<HTMLElement | null>(null);
  useEffect(() => { section.current?.scrollIntoView({ block: "nearest" }); }, []);
  const asset = assets.find(a => a.id === assetId);
  const slots = institutionAssetPlacementSlots(asset, composition.projectId);
  const validSlot = isInstitutionPlacementSlot(slot) && slots.includes(slot) ? slot : null;
  const existing = composition.assets.find(p => p.slot === validSlot);
  const same = existing?.assetId === assetId;
  const previous = assets.find(a => a.id === existing?.assetId);
  const replacing = !!existing && !same;
  async function apply() {
    if (pending.current || disabled || !validSlot || !asset || same || status === "error" || (replacing && !replaceConfirmed)) return;
    pending.current = true; setStatus("saving");
    try { setStatus(await onApply(validSlot, assetId) ? "success" : "error"); }
    catch { setStatus("error"); }
    finally { pending.current = false; }
  }
  return <section ref={section} aria-label="기관 자산 배치 확인" className="mt-4 min-w-0 rounded-lg border border-sky-300 bg-sky-50 p-4 [overflow-wrap:anywhere]">
    <h4 className="font-black text-[#092046]">기관 자산 배치 확인</h4>
    <p className="mt-1 text-sm">후보 선택만으로 저장하지 않습니다. 사용할 위치와 교체 여부를 확인하세요.</p>
    <p className="mt-2 font-bold">{asset?.name ?? "선택한 자산을 확인할 수 없습니다."}</p>
    {asset && slots.length ? <>
      {asset.previewHref ? <Image unoptimized src={`/api/project-files/preview?${new URLSearchParams({ institutionAssetId: asset.id, projectId: composition.projectId })}`} alt={asset.altText || asset.name} width={360} height={240} className="mt-3 max-h-48 w-full object-contain" /> : null}
      <p className="mt-2 text-sm">{asset.approvalStatus === "approved" ? "Approved · 승인됨" : "Draft · 미승인 — 관리자 편집용으로 배치 가능"}</p>
      <label className="mt-3 block text-sm font-bold">적용할 배치 영역
        <select value={slot} disabled={disabled || status === "saving" || status === "error"} onChange={e => { setSlot(e.target.value); setReplaceConfirmed(false); setStatus("idle"); }} className="mt-1 block w-full min-w-0 rounded border border-slate-300 bg-white p-2">
          <option value="">배치 위치를 선택하세요</option>
          {slots.map(s => <option key={s} value={s}>{institutionPlacementLabels[s]}</option>)}
        </select>
      </label>
      {validSlot ? <p className="mt-2 text-sm">{same ? `이미 ${institutionPlacementLabels[validSlot]}에 배치되어 있습니다. 새로 저장하지 않습니다.` : replacing ? `현재 ${institutionPlacementLabels[validSlot]}의 “${previous?.name ?? "기존 자산"}”을 교체합니다. 새 자산은 기본 위치·크기·투명도로 배치되며 기존 자산 파일은 유지됩니다.` : `${institutionPlacementLabels[validSlot]}에 새로 배치합니다.`}</p> : null}
      {replacing ? <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={replaceConfirmed} disabled={disabled || status === "saving" || status === "error"} onChange={e => setReplaceConfirmed(e.target.checked)} />기존 배치를 이 자산으로 교체하겠습니다.</label> : null}
      <p className="mt-2 text-xs">배경판은 일부가 잘릴 수 있으며 상단 이미지는 제한된 높이에 표시됩니다. 주요 사진·포스터 전체를 보여주는 본문 이미지 삽입 기능과는 다릅니다.</p>
      <p className="mt-2 text-xs">적용은 편집 배치 저장입니다. 자동 승인·발행하지 않으며, 독자 화면에는 자산 승인·활성, 구성 준비 완료·표시 및 기사 공개 조건이 별도로 적용됩니다.</p>
      <div role="status" aria-live="polite" className="mt-2 text-sm font-bold">
        {same && existing?.isVisible === false ? "현재 배치는 숨김 상태입니다. 세부 디자인 조정에서 표시 여부를 확인하세요." : status === "saving" ? "기관 자산 배치를 저장하고 있습니다." : status === "error" ? "저장 결과를 확인하지 못했습니다. 선택은 유지됩니다. 자동 재시도하지 않으며, 새로고침해 현재 배치를 확인한 뒤 다시 선택하세요." : status === "success" || same ? "현재 배치를 사용합니다. 즉시 미리보기에서 확인하세요." : null}
      </div>
      <button type="button" disabled={disabled || !validSlot || same || status === "saving" || status === "error" || (replacing && !replaceConfirmed)} onClick={() => void apply()} className="dd-btn dd-btn-primary mt-3 max-w-full whitespace-normal">{status === "saving" ? "배치 저장 중" : "확인한 위치에 적용"}</button>
    </> : <p role="status" className="mt-2 text-sm text-amber-900">현재 자산은 이 경로로 배치할 수 없습니다. 프로젝트·활성 상태·웹용 형식과 지원 위치를 자산 관리에서 확인하세요. 로고·원본은 연결하지 않습니다.</p>}
    <button type="button" disabled={status === "saving"} onClick={onClose} className="dd-btn dd-btn-secondary ml-2 mt-3 max-w-full whitespace-normal">{status === "success" || same ? "확인 닫기" : "선택 취소"}</button>
  </section>;
}
