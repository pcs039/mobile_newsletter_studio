import Link from "next/link";
import { AuthUserPanel } from "@/components/auth-user-panel";
import { getCurrentUser } from "@/lib/app-auth";

export type AdminMainSection = "dashboard" | "new" | "edit" | "publish" | "distribution" | "survey";

type AdminMainNavigationProps = {
  active: AdminMainSection;
  projectId?: string;
};

export async function AdminMainNavigation({ active, projectId }: AdminMainNavigationProps) {
  const user = await getCurrentUser();
  const items: Array<{
    key: AdminMainSection;
    label: string;
    detail: string;
    href?: string;
  }> = [
    { key: "dashboard", label: "프로젝트 현황", detail: "전체 목록", href: "/" },
    { key: "new", label: "새 프로젝트 생성", detail: "기본 정보", href: "/projects/new" },
    { key: "edit", label: "작성/수정", detail: "작업 대상", href: "/projects/edit" },
    {
      key: "publish",
      label: "미리보기/발행",
      detail: projectId ? "검수·URL·QR" : "프로젝트 선택",
      href: projectId ? `/projects/${projectId}/publish` : "/projects/publish",
    },
    { key: "distribution", label: "배포/관리", detail: "공개 운영", href: "/projects/distribution" },
    { key: "survey", label: "설문/이벤트", detail: "참여 운영", href: "/projects/survey" },
  ];

  return (
    <>
      <nav className="space-y-2" aria-label="관리자 주 메뉴">
        {items.map((item) => {
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
        })}
      </nav>
      {user ? <AuthUserPanel user={user} /> : null}
    </>
  );
}
