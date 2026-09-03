import Link from "next/link";
import { ProjectDistributionForm } from "@/components/project-distribution-form";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { ProjectSendCampaignActions } from "@/components/project-send-campaign-actions";
import { StatusPill } from "@/components/status-pill";
import { getProjectDistribution, getProjectWorkspace } from "@/lib/newsletter-repository";

function getSiteOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "";
}

function makeAbsoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const origin = getSiteOrigin();

  return origin ? `${origin}${path.startsWith("/") ? path : `/${path}`}` : path;
}

function splitDateTime(value: string) {
  const [date, time] = value.split(" ");

  return {
    date: date || "-",
    time: time || "",
  };
}

export default async function ProjectDistributionPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [workspace, distribution] = await Promise.all([
    getProjectWorkspace(projectId),
    getProjectDistribution(projectId),
  ]);
  const project = workspace.project;
  const publicUrl = makeAbsoluteUrl(project?.publicUrl ?? `/newsletters/${projectId}`);
  const qrHref = `/api/qr?value=${encodeURIComponent(publicUrl)}`;
  const totalRecipients = distribution.groups.reduce((total, group) => total + group.recipientCount, 0);
  const sentCampaigns = distribution.campaigns.filter((campaign) => campaign.status === "발송 완료");

  return (
    <ProjectAdminShell
      active="distribution"
      projectId={projectId}
      title="배포 운영"
      description="공개 URL을 실제로 어디에, 누구에게, 어떤 채널로 배포했는지 프로젝트별 운영 기록을 남깁니다."
      sidebarTitle={
        <>
          배포
          <br />
          운영
        </>
      }
      sidebarDescription="발행 완료 후 수신 대상, QR 공유, 문자·이메일·알림톡 발송 기록을 관리합니다."
      sidebarNoteTitle="운영 기준"
      sidebarNote="이 화면은 직접 발송 시스템이 아니라 배포 운영대장입니다. 외부 발송 연동 전까지 기록 관리용으로 사용합니다."
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/projects/distribution"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:border-[#184a88] hover:bg-[#f4f8ff]"
          >
            배포/관리 목록
          </Link>
          <Link
            href={qrHref}
            className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-center text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
          >
            QR 다운로드
          </Link>
          <Link
            href={`/newsletters/${projectId}`}
            className="rounded-lg bg-[#092046] px-5 py-3 text-center text-sm font-black text-white shadow-sm transition hover:bg-[#123a78]"
          >
            공개 화면 열기
          </Link>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: "대상 그룹", value: distribution.groups.length, detail: "등록 그룹" },
              { label: "예상 수신자", value: totalRecipients.toLocaleString("ko-KR"), detail: "그룹 합계" },
              { label: "발송 완료", value: sentCampaigns.length, detail: "기록 기준" },
            ].map((card) => (
              <article key={card.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <strong className="text-3xl font-black text-[#092046]">{card.value}</strong>
                  <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                    {card.detail}
                  </span>
                </div>
              </article>
            ))}
          </section>

          {distribution.source === "error" && (
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-900">
              {distribution.message}
            </article>
          )}

          <ProjectDistributionForm groups={distribution.groups} projectSlug={projectId} publicUrl={publicUrl} />

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">수신 대상</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">대상 그룹 목록</h3>
              </div>
              <StatusPill value={`${distribution.groups.length}개 그룹`} />
            </div>
            <div className="divide-y divide-slate-200">
              {distribution.groups.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm font-bold text-slate-600">등록된 대상 그룹이 없습니다.</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500 [word-break:keep-all]">
                    기관 담당자, 주민 대상, 내부 검수자처럼 실제 배포 단위를 먼저 저장하세요.
                  </p>
                </div>
              ) : (
                distribution.groups.map((group) => {
                  const updated = splitDateTime(group.updated);

                  return (
                    <article key={group.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_120px_130px] lg:items-center">
                      <div className="min-w-0">
                        <h4 className="font-black text-[#092046] [word-break:keep-all]">{group.name}</h4>
                        <p className="mt-1 text-sm leading-6 text-slate-600 [word-break:keep-all]">{group.description}</p>
                        <p className="mt-1 text-xs font-bold text-[#184a88] [word-break:keep-all]">{group.channelNote}</p>
                      </div>
                      <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                        <p className="text-xs font-bold text-slate-500">수신자</p>
                        <p className="mt-1 text-lg font-black text-[#092046]">
                          {group.recipientCount.toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                        <p className="text-xs font-bold text-slate-500">수정</p>
                        <p className="mt-1 whitespace-nowrap text-sm font-black text-[#092046]">{updated.date}</p>
                        <p className="whitespace-nowrap text-xs font-black text-[#184a88]">{updated.time}</p>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">발송 이력</p>
                <h3 className="mt-1 text-lg font-bold text-[#092046]">발송·공유 기록</h3>
              </div>
              <StatusPill value={`${distribution.campaigns.length}건 기록`} />
            </div>
            <div className="divide-y divide-slate-200">
              {distribution.campaigns.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm font-bold text-slate-600">등록된 발송 기록이 없습니다.</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500 [word-break:keep-all]">
                    공개 URL이나 QR을 공유한 뒤 채널, 대상, 발송 일시를 기록하세요.
                  </p>
                </div>
              ) : (
                distribution.campaigns.map((campaign) => {
                  const sentAt = splitDateTime(campaign.sentAt);
                  const updated = splitDateTime(campaign.updated);

                  return (
                    <article key={campaign.id} className="px-5 py-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_130px_130px_180px] lg:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-black text-[#092046] [word-break:keep-all]">{campaign.messageTitle}</h4>
                            <StatusPill value={campaign.campaignType} />
                            <StatusPill value={campaign.channel} />
                            <StatusPill value={campaign.status} />
                          </div>
                          <p className="mt-1 text-sm font-bold text-[#184a88] [word-break:keep-all]">
                            대상: {campaign.targetGroupName}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">{campaign.note}</p>
                          {campaign.publicUrl ? (
                            <p className="mt-2 break-words text-xs font-semibold leading-5 text-slate-500">
                              {campaign.publicUrl}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                          <p className="text-xs font-bold text-slate-500">발송 일시</p>
                          <p className="mt-1 whitespace-nowrap text-sm font-black text-[#092046]">{sentAt.date}</p>
                          <p className="whitespace-nowrap text-xs font-black text-[#184a88]">{sentAt.time}</p>
                        </div>
                        <div className="rounded-lg bg-[#f8fbff] px-3 py-2">
                          <p className="text-xs font-bold text-slate-500">기록 수정</p>
                          <p className="mt-1 whitespace-nowrap text-sm font-black text-[#092046]">{updated.date}</p>
                          <p className="whitespace-nowrap text-xs font-black text-[#184a88]">{updated.time}</p>
                        </div>
                        <ProjectSendCampaignActions
                          campaignId={campaign.id}
                          projectSlug={projectId}
                          statusCode={campaign.statusCode}
                        />
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">공개 링크</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-[#f8fbff] px-3 py-3">
                <p className="text-xs font-black text-[#184a88]">모바일 공개 URL</p>
                <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">{publicUrl}</p>
              </div>
              <div className="rounded-lg bg-[#f8fbff] px-3 py-3">
                <p className="text-xs font-black text-[#184a88]">공개 상태</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{project?.status ?? workspace.message}</p>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">배포 체크</h3>
            <div className="mt-4 grid gap-3">
              {[
                "공개 URL이 실제 접속되는지 확인",
                "QR SVG를 내려받아 인쇄물에 반영",
                "기관 담당자에게 최종 URL 공유",
                "대상 그룹별 발송 기록 저장",
                "접속 통계가 누적되는지 확인",
              ].map((check) => (
                <label key={check} className="flex gap-3 rounded-lg bg-[#f8fbff] px-3 py-3 text-sm leading-6 text-slate-600">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#092046]" />
                  <span className="[word-break:keep-all]">{check}</span>
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-[#092046]">필요 SQL</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 [word-break:keep-all]">
              대상 그룹이나 발송 기록 저장이 실패하면 Supabase SQL Editor에서 배포 관리 테이블을 먼저 생성해야 합니다.
            </p>
          </article>
        </aside>
      </div>
    </ProjectAdminShell>
  );
}
