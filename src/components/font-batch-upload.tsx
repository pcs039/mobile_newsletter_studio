"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import type { FontClassification } from "@/lib/font-batch";

type Row = {
  id: number; file: File; path: string; hash: string; font: FontClassification | null;
  selected: boolean; confirmed: boolean; status: "ready" | "uploading" | "success" | "error" | "excluded";
  message: string; token?: string; assetId?: string;
};
type Result = { ok: boolean; message?: string; token?: string; uploadUrl?: string; status?: string; duplicate?: boolean; assetId?: string };
const inputClass = "min-w-0 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm";
async function api(body: object): Promise<Result> {
  const response = await fetch("/api/font-batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.message || "등록 결과를 확인하지 못했습니다. 다시 확인하세요.");
  return result;
}
export function FontBatchUpload() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [unprocessedCount, setUnprocessedCount] = useState(0);
  const [rights, setRights] = useState({ webfontAllowed: false, commercialAllowed: false, active: false });
  const lock = useRef(false);
  function update(id: number, patch: Partial<Row>) { setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row)); }
  function changeRights(next: typeof rights) {
    setRights(next);
    setRows((current) => current.map((row) => row.status === "success" ? row : { ...row, token: undefined }));
  }

  async function choose(files: FileList | null) {
    if (!files || lock.current) return;
    setUnprocessedCount(Math.max(0, files.length - 500));
    lock.current = true; setBusy(true); setMessage("선택한 파일을 분석하는 중입니다.");
    try {
      const { classifyFont, defaultFontSelection, fontFormat, normalizeFontPath, MAX_BATCH_FONT_BYTES } = await import("@/lib/font-batch");
      const next: Row[] = [];
      for (const file of Array.from(files).slice(0, 500)) {
        const path = normalizeFontPath(file.webkitRelativePath || file.name);
        if (!fontFormat(path)) {
          next.push({ id: next.length, file, path, hash: "", font: null, selected: false, confirmed: false, status: "excluded", message: /\.ttc$/i.test(path) ? "TTC는 이번 등록에서 제외합니다." : "폰트 등록 대상이 아닙니다." });
          continue;
        }
        try {
          if (file.size > MAX_BATCH_FONT_BYTES) throw new Error("파일당 16MiB를 초과합니다.");
          const bytes = await file.arrayBuffer();
          const font = classifyFont(new Uint8Array(bytes), path);
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
          next.push({ id: next.length, file, path, hash, font, selected: true, confirmed: !font.needsConfirmation, status: "ready", message: font.reason });
        } catch (error) {
          next.push({ id: next.length, file, path, hash: "", font: null, selected: false, confirmed: false, status: "excluded", message: error instanceof Error ? error.message : "폰트 분석 실패" });
        }
      }
      const valid = next.filter((row) => row.font);
      const selected = defaultFontSelection(valid.map((row) => row.font!));
      valid.forEach((row, index) => {
        row.selected = selected.has(index);
        if (!row.selected) row.message = "동일 글꼴의 대체 형식 후보 — 기본 선택 제외";
      });
      setRows(next);
      setMessage(`${next.length}개 분석 · ${valid.filter((row) => row.selected).length}개 기본 선택`);
    } catch { setMessage("파일 분석을 완료하지 못했습니다. 파일을 다시 선택하세요."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function register() {
    if (lock.current) return;
    const targets = rows.filter((row) => row.selected && row.font && row.confirmed && row.status !== "success");
    if (!targets.length) return;
    lock.current = true; setBusy(true);
    let success = 0;
    try {
      for (const row of targets) {
        update(row.id, { status: "uploading", message: "업로드·서버 검증 중" });
        try {
          let result: Result | null = null;
          // A failed/lost final response is resolved first; never blindly upload again.
          if (row.token) result = await api({ action: "complete", token: row.token }).catch(() => null);
          if (!result) {
            const prepared = await api({ action: "prepare", name: row.path, size: row.file.size, hash: row.hash, ...row.font, confirmed: row.confirmed, ...rights });
            if (prepared.status === "success") result = prepared;
            else {
              if (!prepared.token || !prepared.uploadUrl) throw new Error("업로드 주소를 확인하지 못했습니다.");
              update(row.id, { token: prepared.token });
              // Storage can report an existing immutable object after a lost response.
              // Finalization validates the actual bytes regardless of upload response status.
              await fetch(prepared.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: row.file }).catch(() => null);
              result = await api({ action: "complete", token: prepared.token });
            }
          }
          update(row.id, { status: "success", assetId: result.assetId, message: result.duplicate ? "기존 등록 파일 재사용" : "등록 완료" });
          success++;
        } catch (error) { update(row.id, { status: "error", message: error instanceof Error ? error.message : "등록 실패 — 다시 확인하세요." }); }
      }
      setMessage(`${success}개 등록 확인 · 실패 파일은 선택 상태를 유지한 채 다시 시도할 수 있습니다.`);
      router.refresh();
    } finally { lock.current = false; setBusy(false); }
  }
  const eligible = rows.filter((row) => row.selected && row.font && row.confirmed && row.status !== "success").length;
  return <section className="min-w-0 rounded-lg border border-sky-200 bg-sky-50/40 p-5">
    <h2 className="text-xl font-black text-[#092046]">폰트 일괄 등록</h2>
    <p className="mt-2 text-sm text-slate-600">ZIP을 컴퓨터에서 해제한 뒤 파일이나 폴더를 선택하세요. 파일당 최대 16MiB이며, 가변 폰트와 TTC는 제외합니다.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <label className="dd-btn dd-btn-secondary cursor-pointer">폰트 파일 선택<input aria-label="폰트 파일 선택" className="sr-only" type="file" multiple accept=".ttf,.otf,.woff,.woff2" disabled={busy} onChange={(event) => void choose(event.target.files)} /></label>
      <label className="dd-btn dd-btn-secondary cursor-pointer">폴더 선택<input aria-label="폰트 폴더 선택" className="sr-only" type="file" multiple {...({ webkitdirectory: "" } as InputHTMLAttributes<HTMLInputElement>)} disabled={busy} onChange={(event) => void choose(event.target.files)} /></label>
    </div>
    <p className="mt-2 text-xs text-slate-500">폴더 선택을 지원하지 않는 브라우저에서는 파일 선택을 이용하세요. 같은 글꼴은 WOFF2 → WOFF → TTF → OTF 순으로 하나를 기본 선택합니다.</p>
    {unprocessedCount > 0 && <p role="alert" className="mt-3 break-words text-sm font-semibold text-amber-800">처음 500개 파일만 분석했습니다. 나머지 {unprocessedCount}개 파일은 분석·등록 대상에 포함되지 않았습니다. 해당 파일은 500개 이하로 나누어 다시 선택하세요.</p>}
    {rows.length > 0 && <>
      <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
        {rows.map((row) => <div key={row.id} className="min-w-0 rounded border border-slate-200 bg-white p-3">
          <label className="flex items-start gap-2 text-sm font-bold"><input type="checkbox" className="mt-1 shrink-0" checked={row.selected} disabled={busy || !row.font || row.status === "success"} onChange={(event) => update(row.id, { selected: event.target.checked })} /><span className="min-w-0 break-all">{row.path}</span></label>
          {row.font && <p className="mt-1 text-xs text-slate-600">{row.font.family} · {row.font.weight} · {row.font.style} · {row.font.format.toUpperCase()}</p>}
          <p className={`mt-1 break-words text-xs ${row.status === "error" ? "text-red-700" : "text-slate-600"}`}>{row.message}</p>
          {row.font?.needsConfirmation && row.status !== "success" && <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="min-w-0 text-xs">패밀리<input aria-label={`${row.path} 패밀리`} className={inputClass} disabled={busy} value={row.font.family} onChange={(event) => update(row.id, { font: { ...row.font!, family: event.target.value }, confirmed: false, token: undefined })} /></label>
            <label className="min-w-0 text-xs">굵기<input aria-label={`${row.path} 굵기`} className={inputClass} type="number" min="1" max="1000" disabled={busy} value={row.font.weight} onChange={(event) => update(row.id, { font: { ...row.font!, weight: event.target.value }, confirmed: false, token: undefined })} /></label>
            <label className="min-w-0 text-xs">스타일<select className={inputClass} disabled={busy} value={row.font.style} onChange={(event) => update(row.id, { font: { ...row.font!, style: event.target.value as "normal" | "italic" }, confirmed: false, token: undefined })}><option value="normal">보통</option><option value="italic">기울임</option></select></label>
            <label className="flex gap-2 text-xs sm:col-span-3"><input type="checkbox" checked={row.confirmed} disabled={busy} onChange={(event) => update(row.id, { confirmed: event.target.checked, token: undefined })} />분류를 확인했습니다.</label>
          </div>}
        </div>)}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={rights.webfontAllowed} onChange={(event) => changeRights({ ...rights, webfontAllowed: event.target.checked, active: rights.active && event.target.checked })} />기존 사용 조건: 웹폰트 사용 허용</label>
        <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={rights.commercialAllowed} onChange={(event) => changeRights({ ...rights, commercialAllowed: event.target.checked })} />상업/납품 사용 허용</label>
        <label className="flex gap-2"><input type="checkbox" disabled={busy || !rights.webfontAllowed} checked={rights.active} onChange={(event) => changeRights({ ...rights, active: event.target.checked })} />등록 후 활성화</label>
      </div>
      <button type="button" disabled={busy || eligible === 0} onClick={() => void register()} className="dd-btn dd-btn-primary mt-4 w-full">{busy ? "처리 중" : `선택한 ${eligible}개 등록 / 실패 파일 재시도`}</button>
    </>}
    <p role="status" aria-live="polite" className="mt-3 break-words text-sm text-slate-600">{message}</p>
  </section>;
}
