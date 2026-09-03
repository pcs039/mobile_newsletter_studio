"use client";

import { useMemo, useState } from "react";

type DistributionCopyToolsProps = {
  projectTitle: string;
  publicUrl: string;
};

type TemplateKey = "kakao" | "sms" | "email" | "qr";

const templateLabels: Record<TemplateKey, string> = {
  kakao: "카카오 알림톡",
  sms: "문자",
  email: "이메일",
  qr: "QR·인쇄물",
};

function makeTemplate(type: TemplateKey, projectTitle: string, publicUrl: string) {
  if (type === "sms") {
    return `[모바일 소식지 안내] ${projectTitle}이 공개되었습니다. 아래 링크에서 확인해 주세요. ${publicUrl}`;
  }

  if (type === "email") {
    return `[모바일 소식지 공개 안내]

안녕하세요.
${projectTitle} 모바일 소식지가 공개되었습니다.

아래 링크에서 모바일 화면으로 확인하실 수 있습니다.
${publicUrl}

감사합니다.`;
  }

  if (type === "qr") {
    return `${projectTitle}
모바일 소식지 바로가기
${publicUrl}

QR 코드를 함께 인쇄물 또는 안내문에 삽입해 주세요.`;
  }

  return `[모바일 소식지 공개 안내]
${projectTitle}이 공개되었습니다.

아래 링크에서 확인해 주세요.
${publicUrl}`;
}

export function ProjectDistributionCopyTools({ projectTitle, publicUrl }: DistributionCopyToolsProps) {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("kakao");
  const [message, setMessage] = useState("");
  const template = useMemo(() => makeTemplate(templateKey, projectTitle, publicUrl), [projectTitle, publicUrl, templateKey]);

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
    } catch {
      setMessage("복사하지 못했습니다. 내용을 직접 선택해서 복사해 주세요.");
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">외부 발송</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">발송용 문안 복사</h3>
        </div>
        <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
          직접 발송 아님
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 [word-break:keep-all]">
        이 앱은 발송 버튼을 누르는 시스템이 아니라 공개 URL과 발송 기록을 관리하는 운영 화면입니다. 실제 발송은
        카카오 알림톡, 문자, 이메일, 단체방, QR 인쇄물에서 진행하세요.
      </p>

      <label className="mt-4 grid gap-2 text-sm font-bold text-[#092046]">
        발송 채널
        <select
          value={templateKey}
          onChange={(event) => setTemplateKey(event.target.value as TemplateKey)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f73b7] focus:ring-2 focus:ring-blue-100"
        >
          {(Object.keys(templateLabels) as TemplateKey[]).map((key) => (
            <option key={key} value={key}>
              {templateLabels[key]}
            </option>
          ))}
        </select>
      </label>

      <textarea
        value={template}
        readOnly
        rows={7}
        className="mt-3 w-full rounded-lg border border-slate-200 bg-[#f8fbff] px-3 py-3 text-xs font-semibold leading-5 text-slate-700 outline-none"
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void copyText(template, "발송 문안을 복사했습니다.")}
          className="rounded-lg bg-[#092046] px-4 py-3 text-sm font-black text-white transition hover:bg-[#123a78]"
        >
          문안 복사
        </button>
        <button
          type="button"
          onClick={() => void copyText(publicUrl, "공개 URL을 복사했습니다.")}
          className="rounded-lg border border-[#2f73b7] bg-white px-4 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          URL 복사
        </button>
      </div>

      {message ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-700">
          {message}
        </p>
      ) : null}
    </article>
  );
}
