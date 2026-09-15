"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectFileDeleteButton } from "@/components/project-file-delete-button";
import { StatusPill } from "@/components/status-pill";
import { getCustomPageTitle } from "@/lib/page-labels";

type PageImageItem = {
  id: string;
  imagePath: string | null;
  pageNumber: number;
  previewHref: string | null;
  status: string;
  title: string;
  updated: string;
};

type BulkDeleteStatus = "idle" | "deleting" | "success" | "error";

type DeleteResult = {
  message?: string;
};

async function deletePageImage({
  page,
  projectSlug,
}: {
  page: PageImageItem;
  projectSlug: string;
}) {
  if (!page.imagePath) {
    throw new Error(`${page.pageNumber}쪽 이미지 경로가 없습니다.`);
  }

  const params = new URLSearchParams({
    kind: "page_image",
    path: page.imagePath,
    projectSlug,
    recordId: page.id,
  });
  const response = await fetch(`/api/project-files?${params.toString()}`, {
    method: "DELETE",
  });
  const result = (await response.json().catch(() => null)) as DeleteResult | null;

  if (!response.ok) {
    throw new Error(result?.message ?? `${page.pageNumber}쪽 페이지 이미지 삭제에 실패했습니다.`);
  }
}

export function ProjectPageImageBulkDelete({
  pages,
  projectSlug,
}: {
  pages: PageImageItem[];
  projectSlug: string;
}) {
  const router = useRouter();
  const deletablePages = useMemo(() => pages.filter((page) => Boolean(page.imagePath)), [pages]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<BulkDeleteStatus>("idle");
  const [message, setMessage] = useState("");
  const [deletedCount, setDeletedCount] = useState(0);
  const [deleteTotal, setDeleteTotal] = useState(0);
  const selectedCount = selectedIds.size;
  const isDeleting = status === "deleting";

  function togglePage(pageId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }

      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(deletablePages.map((page) => page.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function deletePages(targetPages: PageImageItem[], confirmMessage: string) {
    if (targetPages.length === 0 || isDeleting) {
      return;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setStatus("deleting");
    setMessage("");
    setDeletedCount(0);
    setDeleteTotal(targetPages.length);

    try {
      for (let index = 0; index < targetPages.length; index += 1) {
        const page = targetPages[index];

        setDeletedCount(index + 1);
        setMessage(`${index + 1} / ${targetPages.length}개 삭제 중입니다.`);
        await deletePageImage({ page, projectSlug });
      }

      setStatus("success");
      setMessage(`${targetPages.length}개 페이지 이미지를 삭제했습니다.`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "페이지 이미지 삭제 중 오류가 발생했습니다.");
    }
  }

  const selectedPages = deletablePages.filter((page) => selectedIds.has(page.id));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black text-rose-900">페이지 이미지 선택 삭제</p>
            <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
              선택된 페이지 {selectedCount}개 · 페이지 이미지만 삭제합니다. PDF 원본, 사진·이미지 소재, 음성 파일은 삭제하지 않습니다.
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
              페이지 이미지를 삭제해도 해당 페이지의 클릭 영역은 별도 관리가 필요할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={isDeleting || deletablePages.length === 0}
              className="dd-btn dd-btn-secondary dd-btn-sm border-rose-300 px-4 text-sm text-rose-700 hover:bg-rose-100"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={isDeleting || selectedCount === 0}
              className="dd-btn dd-btn-secondary dd-btn-sm border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50"
            >
              전체 해제
            </button>
            <button
              type="button"
              onClick={() => {
                void deletePages(selectedPages, `선택한 ${selectedPages.length}개 페이지 이미지를 삭제하시겠습니까?`);
              }}
              disabled={isDeleting || selectedPages.length === 0}
              className="dd-btn dd-btn-danger dd-btn-sm px-4 text-sm disabled:bg-rose-300"
            >
              선택 삭제
            </button>
            <button
              type="button"
              onClick={() => {
                void deletePages(
                  deletablePages,
                  "등록된 모든 페이지 이미지를 삭제합니다. 이 작업은 되돌릴 수 없습니다.",
                );
              }}
              disabled={isDeleting || deletablePages.length === 0}
              className="dd-btn dd-btn-danger dd-btn-sm px-4 text-sm disabled:bg-rose-300"
            >
              전체 페이지 이미지 삭제
            </button>
          </div>
        </div>

        {isDeleting && deleteTotal > 0 ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-black text-rose-800">
                {deletedCount} / {deleteTotal}개 삭제 중
              </p>
              <p className="text-xs font-bold text-rose-700">{Math.round((deletedCount / deleteTotal) * 100)}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-rose-100">
              <div className="h-full rounded-full bg-rose-600" style={{ width: `${(deletedCount / deleteTotal) * 100}%` }} />
            </div>
          </div>
        ) : null}

        {message ? (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-xs font-bold leading-5 ${
              status === "error" ? "bg-white text-rose-700" : "bg-white text-rose-900"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {pages.map((page) => {
          const canDelete = Boolean(page.imagePath);
          const isSelected = selectedIds.has(page.id);
          const customTitle = getCustomPageTitle(page.title, page.pageNumber);

          return (
            <article
              key={page.id}
              className={`rounded-lg border bg-white p-3 shadow-sm ${
                isSelected ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200"
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-black text-[#092046]">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!canDelete || isDeleting}
                    onChange={() => togglePage(page.id)}
                    className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  선택
                </label>
                <StatusPill value={page.status} />
              </div>
              <div className="aspect-[3/4] overflow-hidden rounded-md border border-slate-200 bg-[#eef4fb]">
                {page.previewHref ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.previewHref}
                    alt={`${page.pageNumber}쪽 페이지 이미지`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col justify-between bg-white p-3">
                    <div>
                      <div className="h-3 w-2/3 rounded bg-[#092046]" />
                      <div className="mt-4 rounded-lg bg-sky-50 px-3 py-8 text-center">
                        <p className="text-xs font-black text-[#184a88]">Storage 파일</p>
                        <p className="mt-2 break-all text-xs font-semibold leading-5 text-slate-500">
                          이미지 경로 없음
                        </p>
                      </div>
                    </div>
                    <p className="whitespace-nowrap text-xs font-semibold text-slate-500">최근 수정 {page.updated}</p>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-[#092046]">{page.pageNumber}쪽</p>
                  {customTitle ? <p className="mt-1 text-xs font-semibold text-slate-500">{customTitle}</p> : null}
                </div>
              </div>
              {page.imagePath ? (
                <div className="mt-3 flex justify-end">
                  <ProjectFileDeleteButton
                    fileLabel={`${page.pageNumber}쪽 페이지 이미지`}
                    kind="page_image"
                    path={page.imagePath}
                    projectSlug={projectSlug}
                    recordId={page.id}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
