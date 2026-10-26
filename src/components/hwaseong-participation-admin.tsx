"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParticipationEntry } from "@/lib/hwaseong-participation-contract";
import type { ProjectSurveyItem } from "@/lib/newsletter-repository";

const button = "min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50";
export function HwaseongParticipationAdmin({ slug, organization, settings, entries, surveys, articles }: { slug: string; organization: string; settings: { comments_enabled: boolean; survey_id: string | null }; entries: ParticipationEntry[]; surveys: ProjectSurveyItem[]; articles: { id: string; title: string }[] }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function send(input: Record<string, unknown>) {
    if (busy) return; setBusy(true); setMessage("");
    try { const r = await fetch(`/api/projects/${slug}/sample-participation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); const value = await r.json(); if (r.ok && value.ok) { setMessage("저장했습니다."); router.refresh(); } else setMessage(value.message ?? "저장 결과를 다시 확인해 주세요."); }
    catch { setMessage("응답을 확인하지 못했습니다. 새로고침으로 상태를 확인한 뒤 다시 판단해 주세요."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: "settings", commentsEnabled: f.get("comments") === "on", surveyId: String(f.get("survey") ?? "") }); }}>
      <h2 className="text-xl font-black">{organization} · 시연 참여 설정</h2><p className="text-sm leading-6 text-slate-600">현재 화성시 시연 프로젝트에만 적용합니다. 다른 발행호·기관에는 적용하지 않습니다.</p>
      <label className="flex gap-3 text-sm font-bold"><input type="checkbox" name="comments" defaultChecked={settings.comments_enabled} />기관(프로젝트)별 댓글 활성화 · 관리자 승인 후 표시</label>
      <label className="block text-sm font-bold">기사 하단에 연결할 설문<select name="survey" defaultValue={settings.survey_id ?? ""} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"><option value="">설문 연결 안 함</option>{surveys.map(s => <option value={s.id} key={s.id}>{s.title} · {s.status}</option>)}</select></label>
      <a className="block text-sm font-bold underline" href={`/projects/${slug}/survey`}>기존 설문·이벤트 문항 편집기 열기</a><p className="text-xs leading-6 text-slate-600">문항을 편집한 뒤 이 설정을 다시 저장하면 검토한 문항 사본이 시연에 반영됩니다.</p><button className={button} disabled={busy}>설정 저장</button>
    </form>
    {message ? <p role="status" className="rounded-xl border bg-white p-4 text-sm">{message}</p> : null}
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">기사별 참여 결과</h2><p className="mt-2 text-xs leading-6 text-slate-500">최근 유효 응답 최대 200건을 표시합니다. 기존 설문 응답 테이블의 익명 접근과 분리해 저장한 시연 결과입니다.</p>
      <div className="mt-4 space-y-4">{articles.map(a => { const rows = entries.filter(e => e.article_id === a.id), polls = rows.filter(e => e.kind === "survey"); return <article key={a.id} className="rounded-xl bg-slate-50 p-4"><h3 className="font-bold">{a.title}</h3><p className="mt-2 text-sm">비공개 의견 {rows.filter(e => e.kind === "private").length} · 댓글 {rows.filter(e => e.kind === "comment").length} · 설문 {polls.length}</p>{surveys.map(s => s.questions.map(q => { const values = polls.filter(p => p.survey_id === s.id).flatMap(p => p.answers[q.id] ?? []); if (!values.length) return null; return <div key={q.id} className="mt-3 text-sm"><h4 className="font-bold">{q.title}</h4>{[...new Set(values)].map(v => <p key={v} className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{v} · {values.filter(x => x === v).length}건</p>)}</div>; }))}</article>; })}</div>
    </section>
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">비공개 의견·댓글 승인</h2><p className="text-sm leading-6 text-slate-600">비공개 의견은 승인 대상으로 전환할 수 없습니다. 댓글은 개인정보·비방·광고를 직접 확인한 뒤 승인하세요. 승인 취소는 ‘비공개 처리’로 즉시 반영됩니다.</p>
      {!entries.some(e => e.kind !== "survey") ? <p className="text-sm">접수된 의견·댓글이 없습니다.</p> : null}
      {entries.filter(e => e.kind !== "survey").map(e => <article key={e.id} className="rounded-xl border p-4"><p className="text-xs font-bold text-slate-500">{articles.find(a => a.id === e.article_id)?.title} · {e.kind === "private" ? "비공개 의견" : e.state === "pending" ? "댓글 승인 대기" : e.state === "approved" ? "승인 댓글" : "비공개 처리 댓글"}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">{e.body}</p>{e.kind === "comment" ? <form className="mt-3 flex flex-wrap items-center gap-3" onSubmit={event => { event.preventDefault(); void send({ action: "approve", id: e.id, privacyChecked: new FormData(event.currentTarget).get("privacy") === "on" }); }}><label className="flex gap-2 text-xs"><input type="checkbox" name="privacy" required />개인정보·부적절 표현 검토 완료</label><button className={button} disabled={busy || e.state === "approved"}>승인</button><button type="button" className={button} disabled={busy || e.state === "rejected"} onClick={() => void send({ action: "reject", id: e.id })}>비공개 처리</button></form> : null}</article>)}
    </section>
  </div>;
}
