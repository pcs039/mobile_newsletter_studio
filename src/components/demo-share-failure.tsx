import { demoMessages, type DemoFailureCode } from "@/lib/demo-share-status";
export function DemoShareFailure({code,requestId}:{code:DemoFailureCode;requestId:string}) {
  return <main className="mx-auto max-w-lg space-y-4 p-8 text-center" role="alert">
    <h1 className="text-xl font-bold">시연 접속 확인이 필요합니다</h1>
    <p className="text-sm leading-7">{demoMessages[code]}</p>
    <p className="text-xs break-all text-slate-500">오류 코드: {code} · 확인 번호: {requestId}</p>
    <p className="text-xs leading-6">전달받은 원본 링크에서 ‘소식지 열기’를 눌러 주세요. 카카오톡 안에서 계속 실패하면 메뉴에서 외부 브라우저로 원본 링크를 열어 주세요.</p>
  </main>;
}
