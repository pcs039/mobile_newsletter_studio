import { canvaEventFitCalibration, type CanvaContentFitReview as Review } from "@/lib/canva-content-fit";
import { canvaFieldLabels } from "@/lib/canva-recommendation-execution";
import { getCanonicalCanvaTemplate } from "@/lib/canva-template-registry";

export function CanvaContentFitReview({ templateId, review, checking = false }: { templateId: string; review?: Review; checking?: boolean }) {
  const template = getCanonicalCanvaTemplate(templateId);
  const supported = template?.id === "event_festival_02" && template.canvaBrandTemplateId === "EAHXxCyfpSI";
  const current = !checking && review?.templateId === templateId && review.supported === supported ? review : undefined;
  return <section aria-label="Canva 제작 전 디자인 점검" className="mt-3 min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 [overflow-wrap:anywhere]">
    <h5 className="font-bold text-[#092046]">제작 전 디자인 점검</h5>
    <p className="mt-1">{supported ? "행사형 02 · 실제 관찰한 안전 입력 범위로 확인합니다. Canva의 자동 줄바꿈이나 최종 결과를 보장하는 최대 용량은 아닙니다." : "이 템플릿은 필드별 길이·줄수와 이미지 영역 규격의 관찰 근거가 없어 디자인 적합성 미검증입니다. 행사형 기준을 대신 적용하지 않습니다."}</p>
    {supported ? <>
      <p className="mt-2 font-semibold">{checking ? "저장된 기사 재확인 중…" : current ? "저장된 기사 입력 검토 결과" : "현재 기사 입력 미검사 · 아래는 검증 기준입니다. 실제 입력 검사는 고정 Staging에서 수행합니다."}</p>
      <ul className="mt-1 space-y-1">
        {Object.values(canvaEventFitCalibration).map(limit => {
          const value = current?.fields.find(field => field.field === limit.field);
          return <li key={limit.field}><strong>{canvaFieldLabels[limit.field]}:</strong> {value ? `${value.characterCount}자 · 명시적 ${value.explicitLines}줄 / ${value.fitStatus === "overflow" ? "안전 범위 밖 또는 입력 누락 · 수정 후 재확인" : value.fitStatus === "adjusted" ? "줄바꿈 형식 정규화 · 최종 검토 필요" : "관찰 안전 범위 안 · 최종 검토 필요"}` : "현재 입력 미검사"} <span className="text-slate-600">(관찰 기준 {limit.safeChars}자·{limit.safeLines}줄 이내)</span></li>;
        })}
      </ul>
      <p className="mt-2">공백·특수문자·줄바꿈도 글자 수에 포함합니다. 부제·본문 전용 영역은 이 프로필에 없으며, 요약 영역만 검사합니다. 원문은 자동 축약하지 않습니다.</p>
    </> : <details className="mt-2"><summary className="cursor-pointer font-semibold">등록 필드 확인</summary><p className="mt-2">등록 필드: {template?.requiredFields?.join(", ") || "검증된 필드 목록 없음"}. 필드 등록 완료와 디자인 품질 검증은 별개입니다.</p></details>}
    <details className="mt-2">
      <summary className="cursor-pointer font-semibold">이미지 비율·해상도·잘림 확인 · 적합성 미확인</summary>
      <p className="mt-2">{current?.image.sourceWidth && current.image.sourceHeight ? `확인된 원본: ${current.image.sourceWidth} × ${current.image.sourceHeight}px · ${current.image.sourceRatioAccepted ? "기존 3:4 입력 비율 충족" : "기존 3:4 입력 비율 불일치"}.` : "검증된 원본 이미지 크기 없음."} 기존 Canva 배경 경로는 승인된 3:4 PNG를 받습니다. 이는 템플릿 이미지 영역의 비율을 뜻하지 않습니다.</p>
      <p className="mt-1">템플릿 이미지 영역의 실제 폭·높이·채우기 방식과 최소 해상도가 미확인입니다. 가로·세로 이미지의 잘림이나 저해상도 선명도를 통과로 판정하지 않습니다. Canva 결과에서 주요 피사체·가장자리·확대 선명도를 직접 확인하세요. 이미지는 자동 변경하지 않습니다.</p>
    </details>
    <p className="mt-2">‘제작 가능’은 기존 데이터·글자·연결 조건을 충족했다는 뜻이며, 이미지의 최종 검수를 대신하지 않습니다.</p>
    <p className="mt-2">글자·이미지를 수정했다면 기사 저장 후 다시 확인하세요. 이 점검은 생성·승인·PNG 가져오기·기사 적용을 실행하지 않습니다.</p>
  </section>;
}
