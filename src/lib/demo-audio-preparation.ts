// Preparation is opt-in for this private Demo, never for uploaded/general audio.
export const demoAudioPreparationBytes = 64 * 1024;

export function demoAudioPreparationHref(href: string) {
  if (!href.startsWith("/api/demo-share/sample-audio?")) return null;
  const u = new URL(href,"https://demo.invalid"),q = u.searchParams;
  if (u.hash || [...q.keys()].some(k=>!["project","article","part","segment"].includes(k)) ||
    ["project","article","part","segment"].some(k=>q.getAll(k).length!==1) ||
    q.get("project")!=="hwaseong-2026-10-samples" || !["summary","detail"].includes(q.get("part")!) || q.get("segment")!=="0") return null;
  q.set("prepare","1");
  return u.pathname+u.search;
}

export function canPrepareDemoAudio(userAgent: string, connection?: {saveData?:boolean;effectiveType?:string}) {
  // Only the measured Chromium behavior is opted in. Other engines remain none.
  return /(?:Chrome|Chromium)\//.test(userAgent) && !/iPhone|iPad|iPod/.test(userAgent) &&
    !connection?.saveData && !/(^|-)2g$/.test(connection?.effectiveType??"");
}

export function demoAudioPreparationRequest(request: Request) {
  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d+)-(\d*)$/i);
  // Later byte ranges are ordinary, freshly authorized playback/seek requests.
  if (range && (!match || Number(match[1])>=demoAudioPreparationBytes)) return {request,limited:false};
  const start=match?Number(match[1]):0;
  const end=Math.min(match?.[2]?Number(match[2]):demoAudioPreparationBytes-1,demoAudioPreparationBytes-1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end<start) return {request,limited:false};
  const headers=new Headers(request.headers);headers.set("Range",`bytes=${start}-${end}`);
  return {request:new Request(request,{headers}),limited:true,start,end};
}

export function validDemoPreparationResponse(response: Response, start: number, end: number) {
  const m=response.headers.get("content-range")?.match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
  const length=response.headers.get("content-length");
  return response.status===206 && !!m && Number(m[1])===start && Number(m[2])>=start && Number(m[2])<=end && Number(m[3])>Number(m[2]) &&
    (length===null || Number(length)===Number(m[2])-start+1);
}
