import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataDiction Newsletter Studio",
  description: "DataDiction의 PDF 기반 공공 모바일 소식지 제작 관리자 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
