import Link from "next/link";
import { AdminInteractionSound } from "@/components/admin-interaction-sound";
import { AuthUserPanel } from "@/components/auth-user-panel";
import { getCurrentUser } from "@/lib/app-auth";

export type AdminMainSection = "dashboard" | "edit" | "publish" | "distribution" | "analytics" | "survey" | "fonts";

type AdminMainNavigationProps = {
  active: AdminMainSection;
  projectId?: string;
};

export async function AdminMainNavigation({ active, projectId }: AdminMainNavigationProps) {
  const user = await getCurrentUser();
  const commonItems: Array<{
    key: AdminMainSection;
    label: string;
    detail: string;
    href?: string;
  }> = [
    { key: "dashboard", label: "전체 프로젝트", detail: "전체 목록", href: "/" },
    { key: "fonts", label: "폰트 관리", detail: "글꼴", href: "/projects/fonts" },
  ];
  const projectItems: typeof commonItems = projectId
    ? [
        {
          key: "publish",
          label: "검수·발행",
          detail: "내부검수·가발행",
          href: `/projects/${projectId}/publish`,
        },
        {
          key: "distribution",
          label: "배포 관리",
          detail: "최종발행·채널",
          href: `/projects/${projectId}/distribution`,
        },
        {
          key: "survey",
          label: "참여 콘텐츠",
          detail: "검토·설문·이벤트",
          href: `/projects/${projectId}/survey`,
        },
        {
          key: "analytics",
          label: "반응 통계",
          detail: "운영·성과 분석",
          href: `/projects/${projectId}/analytics`,
        },
      ]
    : [];

  const renderItems = (items: typeof commonItems) =>
    items.map((item) => {
      const isActive = active === item.key;
      const isDisabled = !item.href;
      const className = `flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold transition ${
        isActive
          ? "bg-white text-[#071f46] shadow-lg shadow-blue-950/20"
          : isDisabled
            ? "cursor-not-allowed text-slate-400"
            : "text-slate-200 hover:bg-white/10"
      }`;
      const content = (
        <>
          <span>{item.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
              isActive
                ? "bg-[#eaf2ff] text-[#184a88]"
                : isDisabled
                  ? "bg-white/8 text-slate-400"
                  : "bg-white/10 text-sky-100"
            }`}
          >
            {item.detail}
          </span>
        </>
      );

      if (isActive || isDisabled || !item.href) {
        return (
          <span key={item.key} className={className} aria-disabled={isDisabled}>
            {content}
          </span>
        );
      }

      return (
        <Link key={item.key} href={item.href} className={className}>
          {content}
        </Link>
      );
    });

  return (
    <>
      <AdminInteractionSound />
      <nav aria-label="관리자 주 메뉴">
        <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-sky-200/70">공통 관리</p>
        <div className="space-y-2">{renderItems(commonItems)}</div>
        {projectItems.length > 0 ? (
          <div className="mt-5 border-t border-white/15 pt-4">
            <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-wide text-sky-200/70">현재 프로젝트</p>
            <div className="space-y-2">{renderItems(projectItems)}</div>
          </div>
        ) : null}
      </nav>
      {user ? <AuthUserPanel user={user} /> : null}
    </>
  );
}
