"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { QuestionInput } from "@/components/public-survey-response-form";
import type { ParticipationData, ParticipationKind } from "@/lib/hwaseong-participation-contract";

const button = "min-h-11 rounded-xl border border-[#125e7c] bg-[#125e7c] px-4 py-3 text-sm font-bold text-white disabled:bg-slate-400 disabled:border-slate-400";
const api = (slug: string) => `/api/projects/${encodeURIComponent(slug)}/sample-participation`;
type Result = { message: string; phase: "idle" | "saving" | "done" | "unknown" };
function ParticipationForm({ slug, articleId, kind, data, onSubmitted }: { slug: string; articleId: string; kind: ParticipationKind; data: ParticipationData; onSubmitted: () => void }) {
  const [result, setResult] = useState<Result>({ phase: "idle", message: "" });
  const busy = useRef(false), requestId = useRef<string | null>(null);
  const storageKey = `sample-participation:${slug}:${articleId}:${kind}`;
  function remember(id: string | null) { requestId.current = id; try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); } catch { /* The in-memory click lock still applies. */ } }
  async function status(id = requestId.current) {
    if (!id || busy.current) return;
    busy.current = true;
    try {
      const r = await fetch(`${api(slug)}?${new URLSearchParams({ articleId, requestId: id })}`, { cache: "no-store" });
      const value = await r.json();
      if (r.ok && value.ok && value.receipt) { setResult({ phase: "done", message: kind === "comment" ? "댓글을 접수했습니다. 관리자 승인 후 시연 화면에 표시됩니다." : "접수가 확인됐습니다. 감사합니다." }); onSubmitted(); }
      else setResult({ phase: "unknown", message: "아직 접수 여부를 확인할 수 없습니다. 다시 제출하지 말고 잠시 후 저장 상태만 확인해 주세요." });
    } catch { setResult({ phase: "unknown", message: "저장 상태를 확인하지 못했습니다. 자동 재제출하지 않습니다." }); }
    finally { busy.current = false; }
  }
  useEffect(() => {
    let cancelled = false;
    try {
      const id = sessionStorage.getItem(storageKey);
      if (id) {
        requestId.current = id;
        void fetch(`${api(slug)}?${new URLSearchParams({ articleId, requestId: id })}`, { cache: "no-store" }).then(async r => {
          const value = await r.json(); if (!cancelled) setResult({ phase: r.ok && value.ok && value.receipt ? "done" : "unknown", message: value.receipt ? "이 화면에서 제출한 참여가 접수됐습니다." : "이전 요청의 결과 확인이 필요합니다. 자동 재제출하지 않습니다." });
        }).catch(() => { if (!cancelled) setResult({ phase: "unknown", message: "이전 요청의 저장 상태를 확인해 주세요." }); });
      }
    } catch { /* Browser storage can be disabled. */ }
    return () => { cancelled = true; };
  }, [storageKey, articleId, slug]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current || result.phase !== "idle") return;
    if (requestId.current) { setResult({ phase: "unknown", message: "이전 요청의 저장 상태를 먼저 확인해 주세요." }); void status(); return; }
    busy.current = true; const form = event.currentTarget, fields = new FormData(form);
    const id = crypto.randomUUID(); remember(id); setResult({ phase: "saving", message: "접수 중입니다." });
    const answers = Object.fromEntries((data.survey?.questions ?? []).map(q => [q.id, q.typeCode === "multiple_choice" ? fields.getAll(q.id).map(String) : String(fields.get(q.id) ?? "")]));
    try {
      const r = await fetch(api(slug), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articleId, requestId: id, kind, token: data.token, consent: fields.get("consent") === "on", website: String(fields.get("website") ?? ""), ...(kind === "survey" ? { surveyId: data.survey?.id, answers } : { body: String(fields.get("body") ?? "") }) }) });
      const value = await r.json().catch(() => null);
      if (r.ok && value?.ok && value.receipt?.id === id) {
        form.reset(); setResult({ phase: "done", message: kind === "comment" ? "댓글을 접수했습니다. 관리자 승인 후에만 표시됩니다." : "비공개로 접수했습니다. 감사합니다." }); onSubmitted();
      } else if ([400, 401, 403, 404, 413, 415, 429].includes(r.status)) {
        remember(null); setResult({ phase: "idle", message: value?.message ?? "입력과 참여 상태를 확인해 주세요." });
      } else setResult({ phase: "unknown", message: "접수 결과 확인이 필요합니다. 같은 요청의 저장 상태를 확인해 주세요." });
    } catch { setResult({ phase: "unknown", message: "응답을 받지 못했습니다. 접수됐을 수 있으므로 다시 제출하지 마세요." }); }
    finally { busy.current = false; }
  }
  return <form onSubmit={submit} className="mt-4 space-y-4" data-swipe-navigation-ignore>
    {kind === "survey" ? data.survey?.questions.map(q => <fieldset key={q.id} className="space-y-2"><legend className="mb-2 text-sm font-bold">{q.title}{q.isRequired ? " (필수)" : ""}</legend><QuestionInput question={q} /></fieldset>) : <label className="block text-sm font-bold">{kind === "private" ? "관리자에게 보낼 비공개 의견" : "승인 후 표시할 댓글"}<textarea name="body" required maxLength={kind === "comment" ? 300 : 1000} rows={4} placeholder="이름·전화번호·이메일 등 개인정보는 적지 마세요." className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-base leading-7 text-slate-800" /></label>}
    <label className="hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <label className="flex gap-2 text-xs leading-6 text-slate-600"><input type="checkbox" name="consent" required className="mt-1.5 h-4 w-4 shrink-0" />개인정보·민감정보를 적지 않았으며, {kind === "comment" ? "검토 후 댓글 공개" : "관리자의 비공개 의견·설문 확인"}에 동의합니다.</label>
    <button type="submit" className={button} disabled={result.phase !== "idle"}>{result.phase === "saving" ? "접수 중…" : result.phase === "done" ? "접수 완료" : result.phase === "unknown" ? "결과 확인 필요" : kind === "survey" ? "설문 응답 보내기" : kind === "private" ? "비공개 의견 보내기" : "댓글 검토 요청"}</button>
    {result.phase === "unknown" ? <button type="button" className={`${button} ml-2`} onClick={() => void status()}>저장 상태 확인</button> : null}
    {result.message ? <p role="status" className="text-sm leading-6 text-slate-700">{result.message}</p> : null}
  </form>;
}
export function HwaseongArticleParticipation({ slug, articleId }: { slug: string; articleId: string }) {
  const [data, setData] = useState<ParticipationData | null>(null), [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    void fetch(`${api(slug)}?${new URLSearchParams({ articleId })}`, { cache: "no-store", signal: controller.signal }).then(async r => {
      const value = await r.json(); if (!current) return;
      if (r.ok && value.ok) { setData(value); setMessage(""); } else setMessage(value.message ?? "참여 영역을 불러오지 못했습니다.");
    }).catch(() => { if (current) setMessage("참여 영역을 불러오지 못했습니다."); });
    return () => { current = false; controller.abort(); };
  }, [slug, articleId, revision]);
  return <section aria-label="기사 참여" className="mt-6 rounded-2xl border border-slate-200 bg-[#f5f9fa] p-5 text-slate-800" data-swipe-navigation-ignore>
    <h2 className="text-xl font-black">이 기사에 참여하기</h2>
    <p className="mt-2 text-xs leading-6 text-slate-600">비공개 제작 시연입니다. 공식 민원 접수나 답변 서비스가 아닙니다. 이름·연락처·민감정보를 입력하지 마세요. 응답은 30일간 운영 화면에서 확인하며 만료 후 후속 접수 시 정리합니다.</p>
    {message ? <div role="status" className="mt-3 text-sm"><p>{message}</p><button className={`${button} mt-2`} onClick={() => setRevision(r => r + 1)}>다시 불러오기</button></div> : !data ? <p role="status" className="mt-3 text-sm">참여 기능을 불러오는 중입니다.</p> : <div className="mt-4 divide-y divide-slate-200">
      <details className="py-3"><summary className="min-h-11 cursor-pointer content-center font-bold">비공개 의견 보내기</summary><p className="mt-2 text-xs leading-6">프로젝트 관리자만 확인합니다. 다른 독자에게 공개되지 않습니다.</p><ParticipationForm slug={slug} articleId={articleId} kind="private" data={data} onSubmitted={() => setRevision(r => r + 1)} /></details>
      {data.commentsEnabled ? <details className="py-3"><summary className="min-h-11 cursor-pointer content-center font-bold">승인된 댓글 · 댓글 남기기</summary><p className="text-xs leading-6">관리자가 검토·승인한 댓글만 이 인증된 시연 화면에 표시됩니다.</p><ul className="mt-3 space-y-3">{data.comments.map(c => <li key={c.id} className="rounded-xl bg-white p-3"><p className="whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">{c.body}</p><p className="mt-2 text-xs text-slate-500">시연 참여자 · {new Date(c.created_at).toLocaleDateString("ko-KR")}</p></li>)}</ul>{!data.comments.length ? <p className="my-3 text-sm text-slate-500">아직 승인된 댓글이 없습니다.</p> : null}<ParticipationForm slug={slug} articleId={articleId} kind="comment" data={data} onSubmitted={() => setRevision(r => r + 1)} /></details> : <p className="py-4 text-xs text-slate-500">댓글은 기관의 현재 프로젝트 설정에서 사용하지 않습니다.</p>}
      {data.survey ? <details className="py-3"><summary className="min-h-11 cursor-pointer content-center font-bold">간단 설문 · {data.survey.title}</summary><ParticipationForm slug={slug} articleId={articleId} kind="survey" data={data} onSubmitted={() => setRevision(r => r + 1)} /></details> : <p className="py-4 text-xs text-slate-500">현재 연결된 진행 중 설문이 없습니다.</p>}
      {data.isAdmin ? <a href={`/projects/${slug}/sample-participation`} className="inline-block min-h-11 content-center pt-3 text-sm font-bold underline">시연 의견·댓글·설문 결과 관리</a> : null}
    </div>}
  </section>;
}
