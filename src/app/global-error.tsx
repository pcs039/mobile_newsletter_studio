"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, background: "#f3f7fc", color: "#0f172a", fontFamily: "Arial, sans-serif" }}>
        <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <section style={{ width: "100%", maxWidth: 560, border: "1px solid #e2e8f0", borderRadius: 8, background: "white", padding: 28 }}>
            <p style={{ margin: 0, color: "#184a88", fontSize: 12, fontWeight: 800 }}>서비스 안내</p>
            <h1 style={{ margin: "10px 0 0", color: "#092046", fontSize: 24 }}>서비스 화면에 문제가 발생했습니다.</h1>
            <p style={{ margin: "14px 0 0", color: "#475569", fontSize: 14, lineHeight: 1.7 }}>
              잠시 후 다시 시도하거나 전체 프로젝트 화면으로 이동하세요.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
              <button type="button" onClick={reset} style={{ minHeight: 44, border: 0, borderRadius: 8, background: "#092046", color: "white", padding: "0 18px", fontWeight: 800 }}>
                다시 시도
              </button>
              {/* The global boundary replaces the root layout, so use a document navigation. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" style={{ display: "inline-flex", minHeight: 44, alignItems: "center", border: "1px solid #2f73b7", borderRadius: 8, background: "white", color: "#092046", padding: "0 18px", fontWeight: 800, textDecoration: "none" }}>
                전체 프로젝트
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
