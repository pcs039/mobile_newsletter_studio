"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchableFontSelect } from "@/components/searchable-font-select";
import { useArticleFontSettingsWorkspace } from "@/components/article-font-settings-context";
import { articleFontRoles, articleFontDesignRoles, articleFontDesignStyle, type ArticleFontDesign } from "@/lib/article-font-design";
import type { FontAsset } from "@/lib/newsletter-repository";
import type { ProjectArticleComposition } from "@/lib/article-composition";
import styles from "@/components/article-font-design.module.css";

const labels = { title: "기사 제목", summary: "기사 요약", body: "본문", subheading: "소제목", caption: "이미지 설명·캡션", button: "행동 버튼" };
export function ArticleFontDesignSettings({ articleId, projectSlug, fonts, composition, initialValues }: {
  articleId: string; projectSlug: string; fonts: FontAsset[]; composition: ProjectArticleComposition | null; initialValues: ArticleFontDesign;
}) {
  const router = useRouter();
  const workspace = useArticleFontSettingsWorkspace();
  const [values, setValues] = useState(initialValues);
  const [saved, setSaved] = useState(initialValues);
  const [current, setCurrent] = useState(composition);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  async function save() {
    if (busy || workspace.articleSaving || workspace.compositionUnsettled) return;
    setBusy(true); setError(false); setMessage("");
    try {
      let target = current;
      if (!target) {
        const response = await fetch("/api/project-article-composition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_composition", projectSlug, articleId }) });
        const body = await response.json();
        if (!response.ok || !body.ok || !body.composition) throw Error(body.message || "기사 구성을 준비하지 못했습니다.");
        target = body.composition as ProjectArticleComposition; setCurrent(target);
      }
      const response = await fetch("/api/project-article-composition", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_font_design", projectSlug, articleId, compositionId: target.id, expectedUpdatedAt: target.updatedAt, fontDesign: values }) });
      const body = await response.json();
      if (!response.ok || !body.ok || !body.composition) throw Error(body.message || "저장 결과를 확인하지 못했습니다. 다시 생성하지 말고 새로고침해 확인하세요.");
      setCurrent(body.composition); setSaved(values); setMessage("글꼴 설정을 저장했습니다. 기사 원문·블록·음성은 변경하지 않았습니다."); router.refresh();
    } catch (e) { setError(true); setMessage(e instanceof Error ? e.message : "저장 결과 확인이 필요합니다. 새로고침 후 확인하세요."); }
    finally { setBusy(false); }
  }
  return <section aria-label="공통 기사 글꼴 설정" className="mb-5 min-w-0 rounded-lg border border-slate-200 bg-white p-4">
    <h3 className="text-lg font-black text-[#092046]">공통 글꼴 설정 · Staging</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">HTML 제목·요약·본문과 모바일 세로·가로·HTML e-book에 함께 적용합니다. 이미지·Canva 안의 글자에는 적용되지 않습니다. 미선택 항목은 기존 디자인을 유지합니다.</p>
    <fieldset disabled={busy || workspace.articleSaving || workspace.compositionUnsettled} className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
      {articleFontRoles.map(role => <SearchableFontSelect key={role} compact selectFace fonts={fonts} name={`fontDesign-${role}`} label={labels[role]} defaultValue={initialValues[role]} inheritLabel="기존 디자인" onValueChange={value => setValues(old => { const next = { ...old }; if (value) next[role] = value; else delete next[role]; return next; })} />)}
    </fieldset>
    <details className="mt-4"><summary className="min-h-11 cursor-pointer content-center text-sm font-bold">저장 전 글꼴 비교</summary><div className="grid gap-4 sm:grid-cols-2"><section className={`${styles.scope} rounded-lg bg-slate-50 p-3`} data-font-roles={articleFontDesignRoles(saved, fonts)} style={articleFontDesignStyle(saved, fonts)}><p className="text-xs">저장된 설정</p><h2 data-public-text-scale-target="article-title" className="mt-3 text-xl">우리 지역의 새로운 소식</h2><p data-public-text-scale-target="article-body" className="mt-3 leading-7">가까운 곳에서 만나는 일상과 사람들. Korean & English 2026.</p></section><section className={`${styles.scope} rounded-lg bg-slate-50 p-3`} data-font-roles={articleFontDesignRoles(values, fonts)} style={articleFontDesignStyle(values, fonts)}><p className="text-xs">선택한 설정</p><h2 data-public-text-scale-target="article-title" className="mt-3 text-xl">우리 지역의 새로운 소식</h2><p data-public-text-scale-target="article-body" className="mt-3 leading-7">가까운 곳에서 만나는 일상과 사람들. Korean & English 2026.</p></section></div></details>
    <p className="mt-3 text-xs leading-6 text-slate-600">글꼴만 별도로 저장합니다. 기사 작성 내용과 세부 디자인 변경은 먼저 해당 단계에서 저장해 주세요. 글꼴 저장으로 음성이 재생성되거나 발행되지는 않습니다. 공개 화면 적용은 기존 세부 디자인의 준비 완료 상태를 따릅니다.</p>
    {workspace.compositionUnsettled ? <p className="text-sm text-amber-800">세부 디자인 변경을 먼저 저장한 후 새로고침해 주세요.</p> : null}
    <button type="button" onClick={save} disabled={!dirty || busy || workspace.articleSaving || workspace.compositionUnsettled} className="mt-3 min-h-11 rounded-lg bg-[#092046] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "글꼴 저장 중…" : "글꼴 설정만 저장"}</button>
    <p role={error ? "alert" : "status"} className={`mt-3 text-sm ${error ? "text-red-700" : "text-slate-600"}`}>{message || (dirty ? "미저장 글꼴 변경사항 있음" : "저장된 글꼴 설정")}</p>
  </section>;
}
