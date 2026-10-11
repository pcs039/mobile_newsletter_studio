export function StagingBadge() {
  if (process.env.APP_ENV !== "staging" || process.env.VERCEL_ENV === "production") return null;
  return <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-950">STAGING · 테스트 환경</div>;
}
