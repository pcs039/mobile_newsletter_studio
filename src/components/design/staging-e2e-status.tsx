"use client";
import { useEffect, useState } from "react";
export function useStagingE2E() {
  const [status,setStatus] = useState<"loading"|"enabled"|"blocked">("loading");
  useEffect(() => {
    let active = true;
    fetch("/api/staging-status", {cache:"no-store"}).then(async r => {
      const data = r.ok ? await r.json() : null;
      if (active) setStatus(data?.enabled ? "enabled" : "blocked");
    }).catch(() => { if(active) setStatus("blocked"); });
    return () => { active = false; };
  }, []);
  return status;
}
export function StagingE2ENotice() {
  return <p className="my-2 text-sm text-slate-600">Canva·이미지 생성 검증은 고정 Staging에서만 사용할 수 있습니다. <a className="underline" href="https://canva-staging.datadiction.co.kr">고정 Staging으로 이동</a></p>;
}
