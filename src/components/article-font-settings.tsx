"use client";

import { useEffect, useState } from "react";
import { SearchableFontSelect } from "@/components/searchable-font-select";
import { articleEditorFormId } from "@/lib/article-editor-form-id";
import type { FontAsset } from "@/lib/newsletter-repository";

type FontValues = { title: string; body: string; caption: string; button: string };
export type ArticleFontSettingsWorkspaceProps = {
  compositionUnsettled?: boolean;
  articleSaving?: boolean;
  articleError?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onInvalidArticle?: () => void;
};

export function ArticleFontSettings({ articleId, fonts, initialValues, projectTitleFontAssetId, projectBodyFontAssetId,
  compositionUnsettled = false, articleSaving = false, articleError = "", onDirtyChange, onInvalidArticle,
}: ArticleFontSettingsWorkspaceProps & {
  articleId: string;
  fonts: FontAsset[];
  initialValues: FontValues;
  projectTitleFontAssetId?: string | null;
  projectBodyFontAssetId?: string | null;
}) {
  const [values, setValues] = useState(initialValues);
  const [localError, setLocalError] = useState("");
  const dirty = (Object.keys(values) as Array<keyof FontValues>).some(key => values[key] !== initialValues[key]);
  const formId = articleEditorFormId(articleId);
  const preferredIds = [projectTitleFontAssetId, projectBodyFontAssetId].filter((id): id is string => !!id);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  function save() {
    const form = document.getElementById(formId);
    if (compositionUnsettled || articleSaving) return;
    if (!(form instanceof HTMLFormElement)) {
      setLocalError("기사 작성 화면을 불러오지 못했습니다. 새로고침 후 다시 확인하세요.");
      return;
    }
    const title = form.elements.namedItem("title");
    if (!form.checkValidity() || (title && "value" in title && !String(title.value).trim())) {
      setLocalError("작성 단계의 필수 입력을 확인한 뒤 다시 저장하세요.");
      onInvalidArticle?.();
      return;
    }
    setLocalError("");
    form.requestSubmit();
  }

  return <section aria-label="기사 글꼴 설정" className="mb-5 min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
    <h3 className="text-lg font-black text-[#092046]">글꼴 설정</h3>
    <p className="mt-1 text-sm text-slate-600">변경을 눌러 글꼴을 고르세요. 굵기는 기존 제목·본문 스타일을 따릅니다.</p>
    <fieldset disabled={articleSaving} className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
      {([['title', '제목 글꼴'], ['body', '본문 글꼴'], ['caption', '이미지 캡션 글꼴'], ['button', '행동 버튼 글꼴']] as const).map(([key, label]) => <SearchableFontSelect
        key={key} compact form={formId} name={`${key}FontAssetId`} label={label} fonts={fonts}
        defaultValue={initialValues[key]} preferredIds={preferredIds}
        inheritedId={key === 'title' ? projectTitleFontAssetId : key === 'body' ? projectBodyFontAssetId : values.body || projectBodyFontAssetId}
        inheritLabel={key === 'caption' || key === 'button' ? '본문 글꼴 사용' : (key === 'title' ? projectTitleFontAssetId : projectBodyFontAssetId) ? '프로젝트 기본값 따름' : '시스템 기본 글꼴'}
        onValueChange={value => setValues(current => ({ ...current, [key]: value }))}
      />)}
    </fieldset>
    <p role="status" className={`mt-4 text-sm font-bold ${dirty || articleError ? 'text-amber-900' : 'text-slate-600'}`}>
      {articleSaving ? '기사·글꼴 저장 중…' : articleError ? '저장 실패 — 선택한 글꼴을 유지했습니다. 확인 후 다시 저장하세요.' : dirty ? '글꼴 변경사항 있음 — 저장 필요' : '저장된 기사 글꼴 기준'}
    </p>
    <p className="mt-1 text-xs leading-5 text-slate-500">작성 단계의 미저장 내용도 함께 저장됩니다. Composition 변경은 별도로 저장하며, 저장만으로 발행되지는 않습니다.</p>
    {compositionUnsettled ? <p className="mt-2 text-sm text-amber-900">세부 디자인의 변경사항을 먼저 저장한 뒤 글꼴을 저장하세요.</p> : null}
    {articleError || localError ? <p role="alert" className="mt-2 break-words text-sm text-red-700">{articleError || localError}</p> : null}
    <button type="button" onClick={save} disabled={articleSaving || compositionUnsettled} className="mt-3 min-h-11 max-w-full rounded-lg bg-[#092046] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{articleSaving ? '저장 중…' : '작성 내용과 글꼴 함께 저장'}</button>
  </section>;
}
