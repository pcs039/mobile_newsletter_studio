"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { previewArticleMessage, previewAudioNotice } from "@/lib/admin-article-preview";

export function AdminPreviewArticleNavigation({ slug, articleIds, articleId, embedded, channel, mobile }: {
  slug: string; articleIds: string[]; articleId: string | null; embedded: boolean; channel?: string; mobile: boolean;
}) {
  const [visible, setVisible] = useState<{ slug: string; id: string } | null>(null);
  const currentId = !mobile && visible?.slug === slug && articleIds.includes(visible.id) ? visible.id : articleId;

  useEffect(() => {
    if (mobile) return;
    let frame = 0;
    function measure() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const card = [...document.querySelectorAll<HTMLElement>("article[data-reader-article-id]")].find(node => {
          const rect = node.getBoundingClientRect();
          return rect.height > 0 && rect.bottom > 100 && rect.top < window.innerHeight && articleIds.includes(node.dataset.readerArticleId ?? "");
        });
        if (card?.dataset.readerArticleId) setVisible({ slug, id: card.dataset.readerArticleId });
      });
    }
    measure();
    document.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [mobile, slug, articleIds]);

  useEffect(() => {
    if (embedded && channel && window.parent !== window) {
      window.parent.postMessage({ type: previewArticleMessage, project: slug, channel, articleId: currentId }, window.location.origin);
    }
  }, [embedded, channel, slug, currentId]);

  if (embedded) return null;
  return <div className="sticky top-0 z-20 border-b border-slate-300 bg-white px-3 py-2" data-admin-preview-navigation>
    <div className="mx-auto flex max-w-[520px] flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-black text-[#184a88]">관리자 미리보기</span>
      <div className="flex flex-wrap gap-2">
        {currentId && articleIds.includes(currentId) ? <Link className="dd-btn dd-btn-secondary dd-btn-sm" href={`/projects/${encodeURIComponent(slug)}/reading?articleId=${currentId}`}>현재 기사 편집</Link> : null}
        <Link className="dd-btn dd-btn-primary dd-btn-sm" href={`/projects/${encodeURIComponent(slug)}/publish`}>발행 관리</Link>
      </div>
      <p className="w-full text-xs leading-5 text-slate-600">{previewAudioNotice}</p>
    </div>
  </div>;
}
