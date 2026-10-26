"use client";
import { useEffect, useRef, useState } from "react";
import { PublicArticleAudioPlayer } from "@/components/public-article-audio-player";
import { adminArticleAudioHref } from "@/lib/admin-article-preview";
import type { ArticleTtsVoice } from "@/lib/article-tts-audio";

type Status = {
  state: string;
  requestId: string | null;
  current: boolean;
  audioState: string;
  canRetry: boolean;
  audioId?: string | null;
};
type Pending = { requestId: string; at: number };
type Props = {
  projectSlug: string;
  articleId: string | null;
  voice: ArticleTtsVoice;
  save: () => Promise<{ id: string } | null>;
  onBusyChange: (busy: boolean) => void;
};
export function ArticleTtsControls({
  projectSlug,
  articleId,
  voice,
  save,
  onBusyChange,
}: Props) {
  const [activeId, setActiveId] = useState(articleId),
    [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(0),
    [unconfirmed, setUnconfirmed] = useState(false);
  const [pendingExpired, setPendingExpired] = useState(false);
  const lock = useRef(false),
    pending = useRef<Pending | null>(null),
    alive = useRef(true);
  const key = (id: string) => `article-tts-request:${projectSlug}:${id}`;
  const endpoint = (id: string) =>
    `/api/projects/${encodeURIComponent(projectSlug)}/articles/${encodeURIComponent(id)}/tts/generate`;
  function remember(id: string, value: Pending | null) {
    pending.current = value;
    try {
      if (value) sessionStorage.setItem(key(id), JSON.stringify(value));
      else sessionStorage.removeItem(key(id));
    } catch {
      /* DB remains authoritative. */
    }
  }
  async function read(id: string) {
    const response = await fetch(endpoint(id), { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.ok !== true)
      throw Error(result.message || "음성 상태 조회에 실패했습니다.");
    if (alive.current) {
      setStatus(result);
      const same = pending.current?.requestId === result.requestId;
      const unresolved =
        !!pending.current && (!same || result.state === "processing");
      setUnconfirmed(unresolved);
      setPendingExpired(
        !!pending.current && Date.now() - pending.current.at >= 360000,
      );
      if (same && result.state !== "processing") remember(id, null);
    }
    return result as Status;
  }
  useEffect(() => {
    alive.current = true;
    let current = true;
    if (articleId) {
      try {
        const p = JSON.parse(sessionStorage.getItem(key(articleId)) || "null");
        if (typeof p?.requestId === "string" && typeof p?.at === "number")
          pending.current = p;
      } catch {
        /* No stored request. */
      }
      void read(articleId).catch(() => {
        if (current)
          setMessage(
            "음성 상태를 조회하지 못했습니다. 결과 확인 후 생성하세요.",
          );
      });
    }
    return () => {
      current = false;
      alive.current = false;
    };
    // An editor instance owns one article; font/voice edits must not restart a request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, projectSlug]);
  async function check() {
    if (lock.current || !activeId) return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      const next = await read(activeId);
      setMessage(
        next.state === "processing"
          ? "생성 중입니다. 다시 생성하지 말고 결과를 확인하세요."
          : next.current
            ? "저장된 정상 음성을 미리들을 수 있습니다."
            : "상태를 확인했습니다. 필요한 경우 명시적으로 다시 생성하세요.",
      );
      setPreview((n) => n + 1);
    } catch {
      setMessage(
        "저장본을 확인하지 못했습니다. 생성 실패로 단정하거나 요청을 반복하지 마세요.",
      );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
      onBusyChange(false);
    }
  }
  async function generate(force: boolean) {
    if (lock.current) return;
    if (
      force &&
      !window.confirm(
        "새 음성을 생성합니다. 이전 요청이 결과 불명인 경우 이미 과금됐을 수 있습니다. 다시 생성하시겠습니까?",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setMessage("현재 기사 저장 중...");
    let id = activeId;
    try {
      const saved = await save();
      if (!saved) {
        setMessage("기사 저장을 확인한 뒤 음성을 생성하세요.");
        return;
      }
      if (!alive.current) return;
      id = saved.id;
      setActiveId(id);
      const before = await read(id);
      if (!alive.current) return;
      if (
        !force &&
        before.audioId &&
        before.audioState === "present" &&
        !before.current
      ) {
        setMessage(
          "기존 음성은 유지됩니다. 변경된 본문·설정으로 새 음성을 만들려면 다시 생성을 선택하세요.",
        );
        return;
      }
      if (
        pending.current &&
        pending.current.requestId !== before.requestId &&
        Date.now() - pending.current.at < 360000
      ) {
        setUnconfirmed(true);
        setMessage(
          "이전 요청 결과를 확인 중입니다. 최소 실행 종료 시간 후 다시 확인하세요.",
        );
        return;
      }
      if (
        (before.state === "processing" && !before.canRetry) ||
        (!force && (before.state === "unknown" || before.state === "failed"))
      ) {
        setMessage("기존 요청을 확인했습니다. 결과 확인 후 다시 생성하세요.");
        return;
      }
      const requestId = crypto.randomUUID();
      remember(id, { requestId, at: Date.now() });
      setUnconfirmed(true);
      setMessage("음성 생성 중... 완료되지 않아도 자동 재시도하지 않습니다.");
      const response = await fetch(endpoint(id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          previousRequestId: before.requestId,
          force,
          voice,
        }),
      });
      const result = await response.json();
      if (!alive.current) return;
      if (result.ok === true) {
        remember(id, null);
        setUnconfirmed(false);
        setStatus({
          ...before,
          state: "ready",
          requestId: result.reused ? before.requestId : requestId,
          current: true,
          audioState: "present",
          canRetry: true,
        });
        setPreview((n) => n + 1);
        setMessage(
          result.reused
            ? "기존 정상 음성을 재사용합니다."
            : "생성 완료. 아래에서 미리듣기 후 필요하면 본문을 수정하고 다시 생성하세요.",
        );
      } else {
        setMessage(
          result.message ||
            "처리 결과를 확인해 주세요. 생성 요청은 반복하지 않습니다.",
        );
        await read(id).catch(() => {});
      }
    } catch {
      if (alive.current) {
        setMessage(
          "결과를 확인하지 못했습니다. 기존 음성을 유지하며, 결과 확인만 진행하세요.",
        );
        setUnconfirmed(!!pending.current);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
      onBusyChange(false);
    }
  }
  const retryAllowed = status?.canRetry && (!unconfirmed || pendingExpired);
  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs leading-5 text-slate-600">
        저장된 공개 본문 문단만 낭독합니다. 제목·요약·이미지·링크·영상 텍스트와
        미저장 수정은 포함하지 않습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            busy ||
            unconfirmed ||
            status?.audioState === "unconfirmed" ||
            status?.state === "processing" ||
            status?.state === "unknown" ||
            status?.state === "failed"
          }
          onClick={() => void generate(false)}
          className="dd-btn dd-btn-primary dd-btn-sm disabled:opacity-50"
        >
          {busy
            ? "처리 중..."
            : status?.current
              ? "저장·기존 음성 확인"
              : "저장 후 음성 생성"}
        </button>
        {activeId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void check()}
            className="dd-btn dd-btn-secondary dd-btn-sm"
          >
            결과 확인
          </button>
        ) : null}
        {activeId && status ? (
          <button
            type="button"
            disabled={busy || !retryAllowed}
            onClick={() => void generate(true)}
            className="dd-btn dd-btn-secondary dd-btn-sm"
          >
            다시 생성
          </button>
        ) : null}
      </div>
      {message ? (
        <p
          role="status"
          className="rounded-lg bg-white p-3 text-sm text-slate-700"
        >
          {message}
        </p>
      ) : null}
      {status?.audioId && !status.current ? (
        <p className="text-xs text-slate-600">
          {status.audioState === "missing"
            ? "기존 음성 파일이 없습니다. 새로 생성할 수 있습니다."
            : status.audioState === "unconfirmed"
              ? "기존 파일을 확인하지 못했습니다. 결과 확인을 먼저 눌러 주세요."
              : status.audioState === "invalid"
                ? "기존 파일 검증에 실패했습니다. 다시 생성할 수 있습니다."
                : "본문 또는 음성 설정이 변경되어 재생성이 필요합니다."}
        </p>
      ) : null}
      {activeId && status?.current ? (
        <PublicArticleAudioPlayer
          key={`${activeId}:${preview}`}
          isAiGenerated
          manifestUrl={adminArticleAudioHref(projectSlug, activeId)}
          ariaLabel="저장된 기사 AI 음성 미리듣기"
        />
      ) : null}
    </div>
  );
}
