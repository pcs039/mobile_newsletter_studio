"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParticipationEntry } from "@/lib/hwaseong-participation-contract";
import type { ProjectSurveyItem } from "@/lib/newsletter-repository";

const button = "min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50";
export function HwaseongParticipationAdmin({ slug, organization, settings, entries, surveys, articles }: { slug: string; organization: string; settings: { survey_id: string | null }; entries: ParticipationEntry[]; surveys: ProjectSurveyItem[]; articles: { id: string; title: string }[] }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function send(input: Record<string, unknown>) {
    if (busy) return; setBusy(true); setMessage("");
    try { const r = await fetch(`/api/projects/${slug}/sample-participation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); const value = await r.json(); if (r.ok && value.ok) { setMessage("저장했습니다."); router.refresh(); } else setMessage(value.message ?? "저장 결과를 다시 확인해 주세요."); }
    catch { setMessage("응답을 확인하지 못했습니다. 새로고침으로 상태를 확인한 뒤 다시 판단해 주세요."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: "settings", surveyId: String(f.get("survey") ?? "") }); }}>
      <h2 className="text-xl font-black">{organization} · 시연 참여 설정</h2><p className="text-sm leading-6 text-slate-600">현재 화성시 시연 프로젝트에만 적용합니다. 다른 발행호·기관에는 적용하지 않습니다.</p>
      <label className="block text-sm font-bold">기사 하단에 연결할 설문<select name="survey" defaultValue={settings.survey_id ?? ""} className="mt-2 block w-full rounded-lg border border-slate-300 p-3"><option value="">설문 연결 안 함</option>{surveys.map(s => <option value={s.id} key={s.id}>{s.title} · {s.status}</option>)}</select></label>
      <a className="block text-sm font-bold underline" href={`/projects/${slug}/survey`}>기존 설문·이벤트 문항 편집기 열기</a><p className="text-xs leading-6 text-slate-600">문항을 편집한 뒤 이 설정을 다시 저장하면 검토한 문항 사본이 시연에 반영됩니다.</p><button className={button} disabled={busy}>설정 저장</button>
    </form>
    {message ? <p role="status" className="rounded-xl border bg-white p-4 text-sm">{message}</p> : null}
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">기사별 참여 결과</h2><p className="mt-2 text-xs leading-6 text-slate-500">최근 유효 응답 최대 200건을 표시합니다. 기사별 비공개 의견·설문 응답을 확인하세요.</p>
      <div className="mt-4 space-y-4">{articles.map(a => { const rows = entries.filter(e => e.article_id === a.id), polls = rows.filter(e => e.kind === "survey"); return <article key={a.id} className="rounded-xl bg-slate-50 p-4"><h3 className="font-bold">{a.title}</h3><p className="mt-2 text-sm">비공개 의견 {rows.filter(e => e.kind === "private").length} · 설문 {polls.length}</p>{surveys.map(s => s.questions.map(q => { const values = polls.filter(p => p.survey_id === s.id).flatMap(p => p.answers[q.id] ?? []); if (!values.length) return null; return <div key={q.id} className="mt-3 text-sm"><h4 className="font-bold">{q.title}</h4>{[...new Set(values)].map(v => <p key={v} className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{v} · {values.filter(x => x === v).length}건</p>)}</div>; }))}</article>; })}</div>
    </section>
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-black">비공개 의견</h2><p className="text-sm leading-6 text-slate-600">프로젝트 관리자만 확인합니다. 다른 독자에게 공개되지 않습니다.</p>
      {!entries.some(e => e.kind === "private") ? <p className="text-sm">접수된 비공개 의견이 없습니다.</p> : null}
      {entries.filter(e => e.kind === "private").map(e => <article key={e.id} className="rounded-xl border p-4"><p className="text-xs font-bold text-slate-500">{articles.find(a => a.id === e.article_id)?.title} · 비공개 의견</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">{e.body}</p></article>)}
    </section>
  </div>;
}
