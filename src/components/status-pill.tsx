const statusTones: Record<string, string> = {
  "완료": "bg-emerald-100 text-emerald-800",
  "변환 완료": "bg-emerald-100 text-emerald-800",
  "이미지 등록 완료": "bg-emerald-100 text-emerald-800",
  "업로드 완료": "bg-emerald-100 text-emerald-800",
  "검수 완료": "bg-emerald-100 text-emerald-800",
  "사용 가능": "bg-emerald-100 text-emerald-800",
  "원본 고화질": "bg-emerald-100 text-emerald-800",
  "대본 확인 완료": "bg-emerald-100 text-emerald-800",
  "검수 중": "bg-sky-100 text-sky-800",
  "검수 대기": "bg-sky-100 text-sky-800",
  "편집 중": "bg-sky-100 text-sky-800",
  "제작 중": "bg-sky-100 text-sky-800",
  "저장소 연동 전 UI": "bg-sky-100 text-sky-800",
  "환경변수 준비": "bg-emerald-100 text-emerald-800",
  "설정 필요": "bg-amber-100 text-amber-800",
  "초안": "bg-indigo-100 text-indigo-800",
  "기획안": "bg-indigo-100 text-indigo-800",
  "샘플 검토": "bg-amber-100 text-amber-800",
  "검수 필요": "bg-amber-100 text-amber-800",
  "확인 필요": "bg-amber-100 text-amber-800",
  "제목 입력 필요": "bg-amber-100 text-amber-800",
  "보완 필요": "bg-amber-100 text-amber-800",
  "교체 필요": "bg-amber-100 text-amber-800",
  "행사명 발음 확인": "bg-amber-100 text-amber-800",
  "대본 수정 필요": "bg-amber-100 text-amber-800",
  "실제 업로드 연동 전": "bg-amber-100 text-amber-800",
  "저화질 주의": "bg-rose-100 text-rose-800",
  "교체 권장": "bg-rose-100 text-rose-800",
  "미등록": "bg-rose-100 text-rose-800",
};

export function StatusPill({ value }: { value: string }) {
  const tone = statusTones[value] ?? "bg-slate-100 text-slate-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{value}</span>;
}
