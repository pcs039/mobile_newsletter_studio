import Link from "next/link";
import { PublicSurveyResponseForm } from "@/components/public-survey-response-form";
import { getPublicProjectSurvey, getProjectWorkspace } from "@/lib/newsletter-repository";

type PublicSurveyPageProps = {
  params: Promise<{ slug: string; surveyId: string }>;
};

function PublicSurveyUnavailablePage({ title, message, backHref }: { title: string; message: string; backHref: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf4fb] px-5 text-slate-950">
      <section className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xl shadow-blue-950/10">
        <p className="text-sm font-black text-[#184a88]">DataDiction Newsletter</p>
        <h1 className="mt-3 text-2xl font-black leading-tight text-[#092046]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 [word-break:keep-all]">{message}</p>
        <Link
          href={backHref}
          className="mt-6 inline-flex rounded-xl bg-[#092046] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123a78]"
        >
          소식지로 돌아가기
        </Link>
      </section>
    </main>
  );
}

export default async function PublicSurveyPage({ params }: PublicSurveyPageProps) {
  const { slug, surveyId } = await params;
  const [workspace, surveyResult] = await Promise.all([getProjectWorkspace(slug), getPublicProjectSurvey(slug, surveyId)]);
  const project = workspace.project;
  const survey = surveyResult.survey;
  const headerColor = project?.primaryColor ?? "#071f46";
  const newsletterHref = `/newsletters/${slug}`;
  const isPublished = project?.status === "발행 완료";

  if (!project || !survey || !isPublished) {
    return (
      <PublicSurveyUnavailablePage
        title="참여 화면을 찾지 못했습니다."
        message="설문 또는 이벤트가 아직 공개되지 않았거나 주소가 변경됐습니다."
        backHref={newsletterHref}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#edf4fb] text-slate-950">
      <section className="mx-auto min-h-screen max-w-[520px] bg-white shadow-xl shadow-blue-950/10">
        <header className="px-5 pb-7 pt-7 text-white" style={{ backgroundColor: headerColor }}>
          <p className="text-sm font-semibold text-sky-200">{project.organization}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">{survey.title}</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-200 [word-break:keep-all]">{survey.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#092046]">{survey.kind}</span>
            <span className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-slate-200">
              {survey.questionCount}개 문항
            </span>
          </div>
        </header>

        <section className="space-y-5 px-5 py-5">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-black text-[#184a88]">참여 안내</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600 [word-break:keep-all]">
              응답은 운영자가 모바일 소식지 성과 확인과 개선 의견 검토에 활용합니다.
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">
              참여 대상: {survey.respondentTarget}
            </p>
          </div>

          <PublicSurveyResponseForm projectSlug={slug} survey={survey} />

          <Link
            href={newsletterHref}
            className="block rounded-xl border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            소식지로 돌아가기
          </Link>
        </section>
      </section>
    </main>
  );
}
