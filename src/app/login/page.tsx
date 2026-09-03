import { redirect } from "next/navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser, getSafeNextPath, isAuthConfigured } from "@/lib/app-auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);
  const user = await getCurrentUser();
  const configured = isAuthConfigured();

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className="min-h-screen bg-[#071f46] text-slate-950">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_480px]">
        <div className="relative hidden overflow-hidden bg-[#071f46] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(77,151,226,0.45),transparent_30%),radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.16),transparent_24%),linear-gradient(135deg,#071f46_0%,#0b326d_58%,#092046_100%)]" />
          <div className="absolute inset-x-12 top-20 rounded-2xl border border-white/15 bg-white/10 p-8 text-white shadow-2xl shadow-blue-950/30 backdrop-blur">
            <DatadictionBrand theme="light" />
            <h1 className="mt-10 max-w-xl text-5xl font-black leading-tight [word-break:keep-all]">
              DataDiction 모바일 소식지 운영 시스템
            </h1>
            <p className="mt-5 max-w-lg text-base font-semibold leading-8 text-slate-200 [word-break:keep-all]">
              프로젝트 제작, 발행 검수, 배포 관리, 설문 응답 확인을 로그인 사용자 권한에 따라 운영합니다.
            </p>
          </div>
          <div className="absolute bottom-16 left-20 right-20 grid grid-cols-3 gap-4 text-white">
            {["제작 관리", "배포 운영", "응답 분석"].map((label) => (
              <div key={label} className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 shadow-xl shadow-blue-950/20 backdrop-blur">
                <p className="text-sm font-black">{label}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">로그인 후 접근</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid place-items-center bg-[#edf4fb] px-5 py-10">
          <section className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-blue-950/10">
            <div className="mb-7">
              <p className="text-sm font-black text-[#184a88]">관리 시스템 로그인</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#092046]">로그인</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 [word-break:keep-all]">
                발급받은 ID와 PASSWORD로 접속하세요.
              </p>
            </div>

            {configured ? (
              <LoginForm nextPath={nextPath} />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold leading-6 text-amber-800">
                Vercel 환경변수에 NEWSLETTER_AUTH_USERS를 먼저 등록해야 로그인을 사용할 수 있습니다.
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
