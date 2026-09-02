import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "모바일 소식지 제작 관리",
  description: "PDF 기반 공공 소식지를 모바일 읽기 콘텐츠와 PC e-book으로 제작하는 관리자 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
