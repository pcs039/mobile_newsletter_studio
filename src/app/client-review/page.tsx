import { getClientReviewCookieToken } from "@/lib/client-review";
import { getClientReviewAccess } from "@/lib/client-review-repository";

export const dynamic = "force-dynamic";

type ClientReviewPageProps = {
  searchParams: Promise<{ error?: string | string[]; project?: string | string[] }>;
};

const statusLabels = {
  approved: "승인 완료",
  changes_requested: "수정 요청 완료",
  pending: "검토 대기",
  revoked: "검토 취소",
} as const;

function ReviewNotice({ title, message }: { title: string; message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#e4edf7] px-5 py-10 text-slate-950">
      <section className="w-full max-w-[560px] rounded-lg border border-slate-300 bg-white px-6 py-9 shadow-lg shadow-blue-950/10 sm:px-8">
        <p className="text-sm font-black text-[#184a88]">DataDiction 기관 검토</p>
        <h1 className="mt-3 text-2xl font-black leading-tight text-[#092046]">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

export default async function ClientReviewPage({ searchParams }: ClientReviewPageProps) {
  const params = await searchParams;
  const projectValue = Array.isArray(params.project) ? params.project[0] : params.project;
  const projectSlug = projectValue?.trim() ?? "";

  if (!projectSlug) {
    return (
      <ReviewNotice
        title="검토 링크를 확인할 수 없습니다."
        message="링크가 만료되었거나 취소되었을 수 있습니다. 소식지 담당자에게 새 검토 링크를 요청해 주세요."
      />
    );
  }

  const token = await getClientReviewCookieToken(projectSlug);
  const access = await getClientReviewAccess(token, projectSlug);

  if (access.status !== "ok") {
    return <ReviewNotice title="검토 세션이 유효하지 않습니다." message={access.message} />;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#e4edf7] px-5 py-10 text-slate-950">
      <section className="w-full max-w-[560px] rounded-lg border border-slate-300 bg-white px-6 py-9 shadow-lg shadow-blue-950/10 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#184a88]">기관 검토용</p>
            <h1 className="mt-2 text-2xl font-black leading-tight text-[#092046]">{access.data.project.title}</h1>
            <p className="mt-2 text-sm font-bold text-slate-600">{access.data.project.organizationName}</p>
          </div>
          <span className="rounded-full bg-[#eaf3ff] px-3 py-2 text-xs font-black text-[#184a88]">
            {statusLabels[access.data.review.status]}
          </span>
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm font-bold leading-6 text-slate-700">
            안전한 기관 검토 세션이 확인되었습니다. 실제 소식지 검토 화면과 응답 UI는 다음 단계에서 이 세션에 연결됩니다.
          </p>
        </div>
        <p className="mt-5 text-xs font-bold leading-5 text-slate-500">
          이 화면은 일반 공개 주소와 분리되어 있으며, 링크 만료 또는 취소 후에는 다시 접근할 수 없습니다.
        </p>
      </section>
    </main>
  );
}
