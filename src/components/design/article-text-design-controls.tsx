import { readArticleTextDesign, type ArticleTextDesign } from "@/lib/article-text-design";

export function ArticleTextDesignControls({ value, disabled, onChange, onSave }: {
  value: unknown; disabled: boolean; onChange: (value: ArticleTextDesign) => void; onSave: () => void;
}) {
  const settings = { ...readArticleTextDesign(value), ...(value as ArticleTextDesign | undefined) };
  const change = (patch: Partial<ArticleTextDesign>) => onChange({ ...settings, ...patch });
  return <fieldset disabled={disabled} className="mt-5 min-w-0 rounded-lg border border-slate-200 p-4">
    <legend className="px-2 font-black text-[#092046]">텍스트 디자인 요소</legend>
    <p className="mb-4 text-sm text-slate-600">실제 글자로 표시됩니다. 입력 후 저장하면 준비 완료 기사에 반영됩니다.</p>
    <div className="grid min-w-0 gap-5 md:grid-cols-3">
      <div className="min-w-0">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={settings.subtitleEnabled ?? false} onChange={(e) => change({ subtitleEnabled: e.target.checked })} />소제목 사용</label>
        {settings.subtitleEnabled ? <label className="mt-3 block text-sm">소제목 텍스트<textarea maxLength={300} value={settings.subtitle ?? ""} onChange={(e) => change({ subtitle: e.target.value })} className="mt-1 w-full min-w-0 rounded border border-slate-300 p-2" /></label> : null}
      </div>
      <div className="min-w-0">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={settings.numberEnabled ?? false} onChange={(e) => change({ numberEnabled: e.target.checked })} />번호 배지 사용</label>
        {settings.numberEnabled ? <div className="mt-3 grid gap-3">
          <label className="text-sm">번호 표시 텍스트<input inputMode="numeric" maxLength={3} pattern="[0-9]{1,3}" value={settings.number ?? ""} onChange={(e) => { if (/^\d{0,3}$/.test(e.target.value)) change({ number: e.target.value }); }} className="mt-1 w-full min-w-0 rounded border border-slate-300 p-2" /></label>
          <label className="text-sm">번호 모양<select value={settings.numberShape ?? "circle"} onChange={(e) => change({ numberShape: e.target.value as ArticleTextDesign["numberShape"] })} className="mt-1 w-full min-w-0 rounded border border-slate-300 p-2"><option value="circle">원형</option><option value="rounded">둥근 네모</option><option value="square">네모</option></select></label>
        </div> : null}
      </div>
      <div className="min-w-0">
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={settings.labelEnabled ?? false} onChange={(e) => change({ labelEnabled: e.target.checked })} />라벨 사용</label>
        {settings.labelEnabled ? <label className="mt-3 block text-sm">라벨 표시 텍스트<input maxLength={80} value={settings.label ?? ""} onChange={(e) => change({ label: e.target.value })} className="mt-1 w-full min-w-0 rounded border border-slate-300 p-2" /></label> : null}
      </div>
    </div>
    <button type="button" onClick={onSave} className="dd-btn dd-btn-primary mt-4">텍스트 디자인 저장</button>
  </fieldset>;
}
