"use client";

import { useState } from "react";

type SupabaseHealthResult = {
  ok?: boolean;
  status?: string;
  message?: string;
  checkedAt?: string;
  missing?: string[];
  httpStatus?: number;
};

type SupabaseHealthCheckButtonProps = {
  anonKeyConfigured?: boolean;
  buttonClassName?: string;
  buttonLabel?: string;
  serviceRoleKeyConfigured?: boolean;
  urlConfigured?: boolean;
};

function formatCheckedAt(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function getConfigLabel(isConfigured: boolean | undefined, configuredLabel = "입력됨") {
  return isConfigured ? configuredLabel : "확인 필요";
}

export function SupabaseHealthCheckButton({
  anonKeyConfigured,
  buttonClassName,
  buttonLabel = "Supabase 상태 확인",
  serviceRoleKeyConfigured,
  urlConfigured,
}: SupabaseHealthCheckButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SupabaseHealthResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function checkHealth() {
    setIsOpen(true);
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/supabase/health", {
        cache: "no-store",
      });
      const data = (await response.json()) as SupabaseHealthResult;

      setResult(data);
    } catch {
      setResult(null);
      setErrorMessage("상태 확인 요청에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setIsLoading(false);
    }
  }

  const isHealthy = Boolean(result?.ok);
  const configItems = [
    {
      label: "URL",
      value: getConfigLabel(urlConfigured),
      detail: "NEXT_PUBLIC_SUPABASE_URL",
    },
    {
      label: "Anon Key",
      value: getConfigLabel(anonKeyConfigured),
      detail: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    },
    {
      label: "Service Key",
      value: getConfigLabel(serviceRoleKeyConfigured, "서버용 키 있음"),
      detail: "SUPABASE_SERVICE_ROLE_KEY",
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={checkHealth}
        className={
          buttonClassName ??
          "mt-4 inline-flex w-full justify-center rounded-lg bg-[#092046] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#123a78]"
        }
      >
        Supabase 상태 확인
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="supabase-health-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">연결 점검</p>
                <h3 id="supabase-health-title" className="mt-1 text-xl font-black text-[#092046]">
                  Supabase 상태 확인
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <section className="rounded-lg border border-slate-200 bg-[#f8fbff] px-4 py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">Supabase 연결 준비</p>
                    <h4 className="text-base font-black text-[#092046]">저장소 환경 설정</h4>
                  </div>
                  <span
                    className={`self-start rounded-full px-3 py-1 text-xs font-black sm:self-auto ${
                      urlConfigured && anonKeyConfigured
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {urlConfigured && anonKeyConfigured ? "환경변수 준비" : "설정 필요"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {configItems.map((item) => (
                    <div key={item.label} className="rounded-lg bg-white px-3 py-3 shadow-sm">
                      <p className="text-sm font-black text-[#092046]">{item.label}</p>
                      <p className="mt-1 text-xs font-bold text-slate-700">{item.value}</p>
                      <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              {isLoading && (
                <div className="rounded-lg bg-[#f4f8ff] px-4 py-5 text-sm font-bold text-[#092046]">
                  Supabase 연결 상태를 확인하고 있습니다.
                </div>
              )}

              {!isLoading && errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-bold text-rose-700">
                  {errorMessage}
                </div>
              )}

              {!isLoading && result && (
                <>
                  <div
                    className={`rounded-lg border px-4 py-4 ${
                      isHealthy ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <p className={`text-base font-black ${isHealthy ? "text-emerald-800" : "text-amber-800"}`}>
                      {isHealthy ? "연결 정상" : "확인 필요"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {result.message ?? "상태 메시지를 받지 못했습니다."}
                    </p>
                  </div>

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 px-3 py-3">
                      <dt className="font-black text-[#092046]">상태</dt>
                      <dd className="mt-1 font-semibold text-slate-600">{result.status ?? "-"}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-3">
                      <dt className="font-black text-[#092046]">HTTP 상태</dt>
                      <dd className="mt-1 font-semibold text-slate-600">{result.httpStatus ?? "-"}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-3 sm:col-span-2">
                      <dt className="font-black text-[#092046]">확인 시간</dt>
                      <dd className="mt-1 font-semibold text-slate-600">{formatCheckedAt(result.checkedAt)}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-3 sm:col-span-2">
                      <dt className="font-black text-[#092046]">누락 항목</dt>
                      <dd className="mt-1 font-semibold text-slate-600">
                        {result.missing && result.missing.length > 0 ? result.missing.join(", ") : "없음"}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={checkHealth}
                className="rounded-lg border border-[#2f73b7] bg-white px-4 py-2 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
              >
                다시 확인
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg bg-[#092046] px-4 py-2 text-sm font-black text-white transition hover:bg-[#123a78]"
              >
                관리화면으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
