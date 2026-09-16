import Link from "next/link";
import { headers } from "next/headers";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectPublishCompletionPanel } from "@/components/project-publish-completion-panel";
import { StatusPill } from "@/components/status-pill";
import {
  getProjectAudioFiles,
  getProjectContent,
  getProjectOriginalPdf,
  getProjectPageImages,
  getProjectWorkspace,
} from "@/lib/newsletter-repository";
import { getAbsoluteSiteUrl, getRequestOriginFromHeaders } from "@/lib/site-url";

function getReadinessStatus(done: boolean, label = "완료") {
  return done ? label : "보완 필요";
}

type PublishChecklistStatus = "완료" | "주의" | "미완료";

type PublishChecklistItem = {
  title: string;
  section: string;
  status: PublishChecklistStatus;
  detail: string;
  href: string;
  actionLabel: string;
};

function getChecklistStatusTone(status: PublishChecklistStatus) {
  if (status === "완료") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (status === "주의") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-rose-200 bg-rose-50 text-rose-800";
}

function getChecklistItemBorder(status: PublishChecklistStatus) {
  if (status === "완료") {
    return "border-emerald-200 bg-emerald-50/50";
  }

  if (status === "주의") {
    return "border-amber-200 bg-amber-50/60";
  }

  return "border-rose-200 bg-rose-50/60";
}

function countChecklistItems(items: PublishChecklistItem[], status: PublishChecklistStatus) {
  return items.filter((item) => item.status === status).length;
}

function hasArticleBody(article: { body: string; blocks: Array<{ type: string; body: string; isVisible: boolean }> }) {
  return (
    article.body.trim().length > 0 ||
    article.blocks.some((block) => block.isVisible && block.type === "paragraph" && block.body.trim().length > 0)
  );
}

export default async function PublishPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const requestOrigin = getRequestOriginFromHeaders(await headers());
  const [workspace, contentData, pageImageData, originalPdfData, audioData] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectContent(projectId),
    getProjectPageImages(projectId),
    getProjectOriginalPdf(projectId),
    getProjectAudioFiles(projectId),
  ]);
  const project = workspace.project;
  const articles = contentData.articles;
  const firstArticle = articles[0] ?? null;
  const firstPages = pageImageData.pages.slice(0, 2);
  const publicPreviewHref = `/newsletters/${projectId}?preview=admin`;
  const ebookPreviewHref = `/newsletters/${projectId}/ebook?preview=admin`;
  const readyCount = [
    Boolean(originalPdfData.pdf),
    pageImageData.pages.length > 0,
    articles.length > 0,
    articles.some((article) => article.links.length > 0),
    audioData.files.length > 0 || articles.some((article) => article.blocks.some((block) => block.type === "audio")),
  ].filter(Boolean).length;
  const readinessItems = [
    {
      label: "PDF 원본",
      status: getReadinessStatus(Boolean(originalPdfData.pdf), "등록됨"),
      detail: originalPdfData.pdf ? originalPdfData.pdf.fileName : "원본 자료 화면에서 PDF를 업로드하세요.",
    },
    {
      label: "e-book",
      status: getReadinessStatus(pageImageData.pages.length > 0, "이미지 등록"),
      detail:
        pageImageData.pages.length > 0
          ? `페이지 이미지 ${pageImageData.pages.length}개 등록`
          : "e-book용 페이지 이미지를 등록하세요.",
    },
    {
      label: "모바일 기사",
      status: getReadinessStatus(articles.length > 0, "작성됨"),
      detail: articles.length > 0 ? `모바일 기사 ${articles.length}개 작성` : "모바일 페이지 작성 화면에서 기사를 저장하세요.",
    },
    {
      label: "연결 링크",
      status: getReadinessStatus(articles.some((article) => article.links.length > 0), "연결됨"),
      detail: `${articles.reduce((total, article) => total + article.links.length, 0)}개 링크 등록`,
    },
    {
      label: "음성 소식지",
      status: getReadinessStatus(
        audioData.files.length > 0 || articles.some((article) => article.blocks.some((block) => block.type === "audio")),
        "준비됨",
      ),
      detail: `MP3 ${audioData.files.length}개 · 기사 대본 ${
        articles.filter((article) => article.blocks.some((block) => block.type === "audio")).length
      }개`,
    },
  ];
  const distributionItems = [
    { label: "공개 URL", value: project?.publicUrl ?? `/newsletters/${projectId}` },
    { label: "e-book URL", value: project?.ebookUrl ?? `/newsletters/${projectId}/ebook` },
    { label: "공개 상태", value: project?.status ?? "프로젝트 확인 필요" },
    { label: "최종 수정", value: project?.updated ?? "-" },
  ];
  const publicUrl = project?.publicUrl ?? `/newsletters/${projectId}`;
  const publicUrlAbsolute = getAbsoluteSiteUrl(publicUrl, requestOrigin);
  const ebookUrl = project?.ebookUrl ?? `/newsletters/${projectId}/ebook`;
  const publicQrTarget = publicUrlAbsolute;
  const publicQrHref = `/api/qr?value=${encodeURIComponent(publicQrTarget)}`;
  const projectPageCount = project?.pageCount ?? 0;
  const registeredPageCount = pageImageData.pages.length;
  const hasAnyArticle = articles.length > 0;
  const articleTitleMissingCount = articles.filter((article) => !article.title.trim()).length;
  const articleSummaryMissingCount = articles.filter((article) => !article.summary.trim()).length;
  const articleBodyMissingCount = articles.filter((article) => !hasArticleBody(article)).length;
  const hasAudioContent =
    audioData.files.length > 0 || articles.some((article) => article.blocks.some((block) => block.type === "audio" && block.body.trim()));
  const pageImageCountStatus: PublishChecklistStatus =
    registeredPageCount === 0 ? "미완료" : projectPageCount > 0 && registeredPageCount < projectPageCount ? "주의" : "완료";
  const publishChecklistItems: PublishChecklistItem[] = [
    {
      title: "프로젝트명 또는 소식지 제목",
      section: "기본 정보",
      status: project?.title?.trim() ? "완료" : "미완료",
      detail: project?.title?.trim() ? project.title : "소식지 제목이 비어 있습니다.",
      href: `/projects/${projectId}/settings`,
      actionLabel: "기본 정보 수정",
    },
    {
      title: "기관/지역명",
      section: "기본 정보",
      status: project?.organization?.trim() ? "완료" : "미완료",
      detail: project?.organization?.trim() ? project.organization : "기관 또는 지역명을 입력해야 합니다.",
      href: `/projects/${projectId}/settings`,
      actionLabel: "기본 정보 수정",
    },
    {
      title: "호수 정보",
      section: "기본 정보",
      status: project?.issue?.trim() ? "완료" : "주의",
      detail: project?.issue?.trim() ? project.issue : "호수 정보가 없으면 공개 화면에서 식별이 어렵습니다.",
      href: `/projects/${projectId}/settings`,
      actionLabel: "기본 정보 수정",
    },
    {
      title: "페이지 수 정보",
      section: "기본 정보",
      status: projectPageCount > 0 ? "완료" : "주의",
      detail: projectPageCount > 0 ? `프로젝트 기준 ${projectPageCount}쪽` : "프로젝트 기준 페이지 수를 확인하세요.",
      href: `/projects/${projectId}/settings`,
      actionLabel: "기본 정보 수정",
    },
    {
      title: "기사 1개 이상",
      section: "기사 콘텐츠",
      status: hasAnyArticle ? "완료" : "미완료",
      detail: hasAnyArticle ? `모바일 기사 ${articles.length}개 작성` : "공개 모바일 읽기 화면에 표시할 기사가 없습니다.",
      href: `/projects/${projectId}/reading`,
      actionLabel: "기사 작성으로 이동",
    },
    {
      title: "기사 제목",
      section: "기사 콘텐츠",
      status: !hasAnyArticle ? "미완료" : articleTitleMissingCount === 0 ? "완료" : "미완료",
      detail:
        !hasAnyArticle || articleTitleMissingCount > 0
          ? `제목 미입력 기사 ${articleTitleMissingCount || articles.length}개`
          : "모든 기사에 제목이 있습니다.",
      href: `/projects/${projectId}/reading`,
      actionLabel: "기사 작성으로 이동",
    },
    {
      title: "기사 요약문/리드문",
      section: "기사 콘텐츠",
      status: !hasAnyArticle ? "미완료" : articleSummaryMissingCount === 0 ? "완료" : "주의",
      detail:
        !hasAnyArticle || articleSummaryMissingCount > 0
          ? `요약문 미입력 기사 ${articleSummaryMissingCount || articles.length}개`
          : "모든 기사에 요약문이 있습니다.",
      href: `/projects/${projectId}/reading`,
      actionLabel: "기사 작성으로 이동",
    },
    {
      title: "기사 본문",
      section: "기사 콘텐츠",
      status: !hasAnyArticle ? "미완료" : articleBodyMissingCount === 0 ? "완료" : "미완료",
      detail:
        !hasAnyArticle || articleBodyMissingCount > 0
          ? `본문 미입력 기사 ${articleBodyMissingCount || articles.length}개`
          : "모든 기사에 본문이 있습니다.",
      href: `/projects/${projectId}/reading`,
      actionLabel: "기사 작성으로 이동",
    },
    {
      title: "등록된 페이지 이미지",
      section: "페이지 이미지",
      status: registeredPageCount > 0 ? "완료" : "미완료",
      detail: registeredPageCount > 0 ? `페이지 이미지 ${registeredPageCount}개 등록` : "e-book용 페이지 이미지가 없습니다.",
      href: `/projects/${projectId}/pages`,
      actionLabel: "이미지 페이지 관리",
    },
    {
      title: "기준 페이지 수와 이미지 수",
      section: "페이지 이미지",
      status: pageImageCountStatus,
      detail:
        projectPageCount > 0
          ? `기준 ${projectPageCount}쪽 · 등록 ${registeredPageCount}쪽`
          : `기준 페이지 수 미입력 · 등록 ${registeredPageCount}쪽`,
      href: `/projects/${projectId}/pages`,
      actionLabel: "이미지 페이지 관리",
    },
    {
      title: "모바일 읽기 보기",
      section: "공개 화면",
      status: publicUrl ? "완료" : "미완료",
      detail: publicUrl ? `공개 URL: ${publicUrl}` : "공개 모바일 읽기 URL을 확인할 수 없습니다.",
      href: publicUrl,
      actionLabel: "공개 URL 확인",
    },
    {
      title: "e-book 보기",
      section: "공개 화면",
      status: registeredPageCount > 0 ? "완료" : "미완료",
      detail: registeredPageCount > 0 ? `/newsletters/${projectId}/ebook 연결 가능` : "페이지 이미지가 없어 e-book 검수가 어렵습니다.",
      href: ebookPreviewHref,
      actionLabel: "e-book 보기",
    },
    {
      title: "공개 URL / QR",
      section: "공개 URL",
      status: project?.slug?.trim() && publicUrl && publicQrHref ? "완료" : "미완료",
      detail: project?.slug?.trim() && publicUrl ? "공개 URL과 QR 코드 표시가 가능합니다." : "공개 slug 또는 URL을 확인하세요.",
      href: `/projects/${projectId}/publish`,
      actionLabel: "발행 정보 확인",
    },
    {
      title: "음성 소식지",
      section: "음성",
      status: hasAudioContent ? "완료" : "주의",
      detail: hasAudioContent
        ? `MP3 ${audioData.files.length}개 · 기사 대본 ${articles.filter((article) => article.blocks.some((block) => block.type === "audio")).length}개`
        : "음성 파일은 선택 항목입니다. 필요 시 검수 화면에서 MP3와 대본을 확인하세요.",
      href: `/projects/${projectId}/audio`,
      actionLabel: "음성 소식지 검수",
    },
  ];
  const completedChecklistCount = countChecklistItems(publishChecklistItems, "완료");
  const warningChecklistCount = countChecklistItems(publishChecklistItems, "주의");
  const incompleteChecklistCount = countChecklistItems(publishChecklistItems, "미완료");
  const hasBlockingChecklistIssues = incompleteChecklistCount > 0;

  return (
    <ProjectAdminShell
      active="publish"
      projectId={projectId}
      title="검수·발행"
      description="발행 전 최종 확인 후 공개 URL과 QR코드를 생성합니다."
      sidebarTitle={
        <>
          검수
          <br />
          발행
        </>
      }
      sidebarDescription="화면, URL, QR 상태를 확인합니다."
      sidebarNoteTitle="공개 기준"
      sidebarNote="모바일은 기사, e-book은 페이지 이미지 기준입니다."
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/projects/publish"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
          >
            발행 목록으로 돌아가기
          </Link>
          <Link
            href={`/projects/${projectId}/reading`}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            기사 작성/편집으로 돌아가기
          </Link>
          <Link
            href={`/projects/${projectId}/distribution`}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            배포 관리로 이동
          </Link>
          <Link
            href={publicPreviewHref}
            className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
          >
            공개 화면 열기
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <section className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">발행 상태 요약</p>
                <h3 className="mt-1 text-xl font-black text-[#092046]">
                  {project?.statusCode === "published" ? "발행 완료" : hasBlockingChecklistIssues ? "발행 전 확인 필요" : "발행 가능 상태"}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
                  검수 결과를 확인하고 발행하기를 누르면 공개 URL과 QR코드가 활성화됩니다.
                </p>
              </div>
              <span
                className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-black ${
                  project?.statusCode === "published"
                    ? "bg-emerald-100 text-emerald-800"
                    : hasBlockingChecklistIssues
                      ? "bg-rose-100 text-rose-800"
                      : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {project?.statusCode === "published" ? "발행 완료" : hasBlockingChecklistIssues ? "검수 필요" : "발행 가능"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "현재 상태", value: project?.status ?? "작성 중" },
                { label: "공개 URL", value: publicUrl },
                { label: "e-book URL", value: ebookUrl },
                { label: "최종 수정", value: project?.updated ?? "-" },
                { label: "발행일시", value: project?.publishedAt || "미발행" },
              ].map((item) => (
                <div key={item.label} className="min-w-0 rounded-xl border border-slate-200 bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs font-black text-[#184a88]">{item.label}</p>
                  <p className="mt-1 break-words text-sm font-black leading-6 text-[#092046]">{item.value}</p>
                </div>
              ))}
            </div>
          </article>

          <ProjectPublishCompletionPanel
            currentStatus={project?.status ?? "작성 중"}
            ebookUrl={ebookUrl}
            hasChecklistIssues={hasBlockingChecklistIssues}
            initialPublishedAt={project?.publishedAt ?? ""}
            isPublished={project?.statusCode === "published"}
            projectId={projectId}
            publicUrl={publicUrl}
            publicUrlAbsolute={publicUrlAbsolute}
          />

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">자동 검수</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">발행 전 자동 검수 체크리스트</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 [word-break:keep-all]">누락 항목을 자동 점검합니다. 발행 차단은 하지 않습니다.</p>
              </div>
              <div className="shrink-0 rounded-xl border border-slate-200 bg-[#f8fbff] px-4 py-3">
                <p className="text-xs font-black text-[#184a88]">전체 요약</p>
                <p className="mt-1 text-sm font-black text-[#092046]">
                  완료 {completedChecklistCount}개 · 주의 {warningChecklistCount}개 · 미완료 {incompleteChecklistCount}개
                </p>
                <p className={`mt-2 text-xs font-black ${hasBlockingChecklistIssues ? "text-rose-700" : "text-emerald-700"}`}>
                  {hasBlockingChecklistIssues ? "발행 전 확인 필요" : "발행 가능 상태"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {publishChecklistItems.map((item) => (
                <div key={`${item.section}-${item.title}`} className={`rounded-xl border p-4 ${getChecklistItemBorder(item.status)}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#184a88]">{item.section}</p>
                      <h4 className="mt-1 text-sm font-black leading-6 text-[#092046]">{item.title}</h4>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center self-start rounded-full border px-2.5 py-1 text-xs font-black ${getChecklistStatusTone(
                        item.status,
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">{item.detail}</p>
                  <Link
                    href={item.href}
                    className="mt-4 inline-flex rounded-lg border border-[#2f73b7] bg-white px-3 py-2 text-xs font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#092046]">발행 준비 상태</h3>
                <p className="mt-1 text-sm text-slate-500">저장 데이터 기준</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  readyCount === readinessItems.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {readyCount}/{readinessItems.length} 준비
              </span>
            </div>

            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {readinessItems.map((item) => (
                <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-[#f9fbfe] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 whitespace-nowrap text-sm font-black tracking-normal text-[#092046]">
                      {item.label}
                    </p>
                    <span className="shrink-0 whitespace-nowrap">
                      <StatusPill value={item.status} />
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 tracking-normal text-slate-500 [word-break:keep-all]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <section className="grid gap-5 2xl:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">모바일 읽기 보기</h3>
                  <p className="mt-1 text-sm text-slate-500">저장된 기사 기준 모바일 공개 화면</p>
                </div>
                <StatusPill value={articles.length > 0 ? "기사 있음" : "기사 없음"} />
              </div>
              <Link
                href={publicPreviewHref}
                className="mb-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                공개 화면 열기
              </Link>
              <div className="mx-auto max-w-[300px] rounded-[30px] border border-slate-200 bg-slate-950 p-3 shadow-sm">
                <div className="overflow-hidden rounded-[24px] bg-white">
                  <div className="px-4 py-4 text-white" style={{ backgroundColor: project?.primaryColor ?? "#092046" }}>
                    <p className="text-xs font-semibold text-sky-200">
                      {project?.organization ?? "프로젝트 정보 확인 필요"}
                    </p>
                    <h4 className="mt-2 text-lg font-black">{firstArticle?.title ?? project?.title ?? projectId}</h4>
                  </div>
                  <div className="p-4">
                    {firstArticle ? (
                      <>
                        <p className="rounded-lg bg-[#f4f8ff] px-3 py-3 text-sm font-black leading-6 text-[#092046]">
                          {firstArticle.summary || "요약 미입력"}
                        </p>
                        <p className="mt-4 line-clamp-5 text-sm leading-7 text-slate-600">
                          {firstArticle.body || "본문 미입력"}
                        </p>
                        <div className="mt-4 grid gap-2">
                          {firstArticle.links.slice(0, 3).map((link) => (
                            <div key={link.id} className="rounded-lg bg-[#092046] px-3 py-2 text-center text-xs font-bold text-white">
                              {link.label}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center">
                        <p className="text-sm font-black text-[#092046]">저장된 모바일 기사가 없습니다.</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">작성 화면에서 첫 기사를 저장하세요.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">e-book 보기</h3>
                  <p className="mt-1 text-sm text-slate-500">등록 페이지 이미지 기준 PC·태블릿 화면</p>
                </div>
                <StatusPill value={pageImageData.pages.length > 0 ? "이미지 있음" : "이미지 없음"} />
              </div>
              <Link
                href={ebookPreviewHref}
                className="mb-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                e-book 열기
              </Link>
              <div className="rounded-lg border border-slate-200 bg-slate-100 p-4">
                <div className="rounded-t-lg bg-[#092046] px-4 py-3 text-sm font-bold text-white">
                  e-book 미리보기
                </div>
                {firstPages.length > 0 ? (
                  <div className="grid gap-4 rounded-b-lg bg-white p-4 md:grid-cols-2">
                    {firstPages.map((page) => (
                      <div key={page.id} className="aspect-[3/4] overflow-hidden rounded-md border border-slate-200 bg-white">
                        {page.previewHref ? (
                          <img src={page.previewHref} alt={page.title} className="h-full w-full object-contain" />
                        ) : (
                          <div className="grid h-full place-items-center text-xs font-bold text-slate-500">이미지 경로 없음</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-b-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
                    <p className="text-sm font-black text-[#092046]">등록된 페이지 이미지가 없습니다.</p>
                  </div>
                )}
              </div>
            </article>
          </section>

        </section>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">공개 정보</h3>
            <div className="mt-4 space-y-3">
              {distributionItems.map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-3">
                  <p className="text-xs font-black text-[#184a88]">{item.label}</p>
                  <p className="mt-1 break-words text-sm font-bold text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </ProjectAdminShell>
  );
}
