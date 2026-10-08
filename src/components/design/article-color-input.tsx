"use client";

import { useSyncExternalStore, useState } from "react";
import { articleColorContrast, isArticleHexColor } from "@/lib/article-text-colors";

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };

const subscribeToSupport = () => () => {};
const readSupport = () => typeof (window as EyeDropperWindow).EyeDropper === "function";
const readServerSupport = () => false;

export function ArticleColorInput({ label, value, surface, disabled, onChange }: {
  label: string; value: string; surface?: string; disabled: boolean; onChange: (color: string) => void;
}) {
  const [input, setInput] = useState({ source: value, draft: value });
  const draft = input.source === value ? input.draft : value;
  const supported = useSyncExternalStore(subscribeToSupport, readSupport, readServerSupport);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState("");
  const ratio = surface ? articleColorContrast(value, surface) : null;

  function accept(color: string) {
    setInput({ source: value, draft: color });
    if (!isArticleHexColor(color)) return;
    setMessage("");
    onChange(color.toUpperCase());
  }
  async function pickColor() {
    const EyeDropper = (window as EyeDropperWindow).EyeDropper;
    if (!EyeDropper || picking) return;
    setPicking(true);
    try {
      const result = await new EyeDropper().open();
      if (isArticleHexColor(result.sRGBHex)) accept(result.sRGBHex);
      else setMessage("선택한 색상을 확인해 주세요.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("색상을 선택하지 못했습니다. 컬러피커나 HEX 입력을 사용해 주세요.");
    } finally { setPicking(false); }
  }
  return <fieldset className="min-w-0">
    <legend className="text-xs font-black text-slate-700">{label}</legend>
    <div className="mt-2 flex min-w-0 flex-wrap gap-2">
      <input type="color" aria-label={`${label} 컬러피커`} value={value} disabled={disabled || picking}
        onChange={(event) => accept(event.currentTarget.value)} className="h-10 w-11 shrink-0 rounded border border-slate-300 bg-white" />
      <input type="text" aria-label={`${label} HEX`} value={draft} maxLength={7} spellCheck={false}
        disabled={disabled || picking} aria-invalid={!isArticleHexColor(draft)}
        onChange={(event) => accept(event.currentTarget.value)}
        className="h-10 min-w-0 flex-1 basis-24 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900" />
      <button type="button" aria-label={`${label} 스포이드`} disabled={disabled || !supported || picking}
        title={supported ? "화면에서 색상 선택" : "이 브라우저는 스포이드를 지원하지 않습니다."}
        onClick={pickColor} className="h-10 rounded border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">
        {picking ? "선택 중" : "스포이드"}
      </button>
    </div>
    {!isArticleHexColor(draft) ? <p role="alert" className="mt-1 text-xs text-rose-700">#RRGGBB 형식으로 입력해 주세요. 저장되지 않았습니다.</p> : null}
    {message ? <p role="status" className="mt-1 text-xs text-slate-600">{message}</p> : null}
    {ratio !== null ? <p className={`mt-1 text-xs font-semibold ${ratio < 4.5 ? "text-amber-800" : "text-emerald-800"}`}>
      {ratio < 4.5 ? "대비 낮음" : "대비 양호"} · {ratio.toFixed(2)}:1 · 프레임 배경 기준 4.5:1
    </p> : null}
  </fieldset>;
}
