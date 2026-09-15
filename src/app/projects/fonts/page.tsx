import Link from "next/link";
import { AdminMainNavigation } from "@/components/admin-main-navigation";
import { DatadictionBrand } from "@/components/datadiction-brand";
import { FontAssetManager } from "@/components/font-asset-manager";
import { HomeButton } from "@/components/home-button";
import { PublicFontFaceStyle } from "@/components/public-font-face-style";
import { requireAppUser } from "@/lib/app-auth";
import { getFontAssets } from "@/lib/newsletter-repository";

export default async function FontLibraryPage() {
  const user = await requireAppUser("/projects/fonts");
  const fontData = await getFontAssets({ activeOnly: false });
  const isAdmin = user.role === "admin";

  return (
    <main className="admin-workspace min-h-screen bg-[#f3f7fc] text-slate-950">
      <PublicFontFaceStyle fonts={fontData.fonts} />
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="bg-[#071f46] px-6 py-7 text-white">
          <div className="mb-9">
            <DatadictionBrand theme="light" />
            <h1 className="mt-6 text-2xl font-bold leading-tight">
              폰트
              <br />
              라이브러리
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">공개 화면에 사용할 웹폰트를 관리합니다.</p>
          </div>

          <AdminMainNavigation active="fonts" />

          <div className="mt-10 rounded-lg border border-white/15 bg-white/8 p-4">
            <p className="text-sm font-bold text-white">권한</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              현재 앱 권한은 admin/user입니다. font_manager 역할은 아직 별도로 없습니다.
            </p>
          </div>
        </aside>

        <section className="px-5 py-6 sm:px-8 lg:px-10">
          <header className="mb-7 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#184a88]">관리자 · 폰트 라이브러리</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#092046]">공개 화면 글꼴 관리</h2>
              <p className="mt-2 text-sm text-slate-500">폰트 파일은 Supabase Storage fonts 버킷에 저장됩니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <HomeButton />
              <Link href="/projects/edit" className="dd-btn dd-btn-secondary">
                작성/수정 목록
              </Link>
            </div>
          </header>

          {isAdmin ? (
            <FontAssetManager fonts={fontData.fonts} />
          ) : (
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <h3 className="text-lg font-black">관리자 권한이 필요합니다.</h3>
              <p className="mt-2 text-sm leading-6">
                현재 권한 구조에는 font_manager 역할이 없어 admin 계정만 폰트를 업로드하고 활성화할 수 있습니다.
              </p>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
