export default function DemoCoverLoading() {
  return <main className="mx-auto min-h-dvh max-w-[740px] bg-[#f6f3e9] px-5 py-8 text-[#234e43]" aria-busy="true">
    <p className="text-xs font-bold tracking-widest">비공개 · 읽기 전용 시연</p>
    <div aria-hidden="true" className="my-6 aspect-[4/3] rounded-3xl bg-gradient-to-br from-[#bdd7ca] via-[#e8e1cc] to-[#294f66]"/>
    <div className="h-10 w-4/5 rounded bg-[#d7e2d8]" aria-hidden="true"/>
    <p role="status" className="mt-5 text-sm">소식지 표지를 준비하고 있습니다…</p>
  </main>;
}
