"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type SubmitState =
  | { status: "idle"; message: string }
  | { status: "saving"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ProjectFormMode = "create" | "edit";

export type ProjectFormInitialValues = {
  projectId?: string;
  title?: string;
  issueLabel?: string;
  organizationName?: string;
  assigneeName?: string;
  publishedDate?: string;
  slug?: string;
  description?: string;
  primaryColor?: string;
  status?: string;
  packageTier?: string;
  productionMode?: string;
  estimatedHours?: string;
  designerHoursCap?: string;
  hasProjectPassword?: boolean;
  projectPasswordUpdatedAt?: string;
};

const primaryColorOptions = [
  { label: "딥블루", value: "#092046" },
  { label: "공공 블루", value: "#184A88" },
  { label: "시안 블루", value: "#0E7490" },
  { label: "포레스트", value: "#166534" },
  { label: "와인", value: "#7F1D1D" },
  { label: "인디고", value: "#3730A3" },
  { label: "차콜", value: "#1F2937" },
  { label: "브라운", value: "#7C2D12" },
];

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-bold text-[#092046]">
      {children}
      {required && <span className="ml-1 text-sky-700">*</span>}
    </label>
  );
}

function TextInput({
  name,
  placeholder,
  type = "text",
  defaultValue,
  required = false,
}: {
  name: string;
  placeholder: string;
  type?: "text" | "date" | "password";
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      defaultValue={defaultValue}
      required={required}
      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
    />
  );
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getNextAuthoringPath(projectSlug: string, productionMode: string) {
  if (productionMode === "full_image" || productionMode === "external_ebook") {
    return `/projects/${projectSlug}/pages`;
  }

  return `/projects/${projectSlug}/reading`;
}

export function ProjectCreateForm({
  initialValues = {},
  mode = "create",
}: {
  initialValues?: ProjectFormInitialValues;
  mode?: ProjectFormMode;
}) {
  const router = useRouter();
  const isEditMode = mode === "edit";
  const [primaryColor, setPrimaryColor] = useState(initialValues.primaryColor || "#092046");
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: isEditMode ? "기본 정보 수정 준비됨" : "Supabase 저장 연결 준비됨",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setSubmitState({
      status: "saving",
      message: isEditMode
        ? "수정한 프로젝트 기본 정보를 Supabase에 저장하는 중입니다."
        : "프로젝트 정보를 Supabase에 저장하는 중입니다.",
    });

    const response = await fetch("/api/projects", {
      method: isEditMode ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: initialValues.projectId ?? initialValues.slug,
        title: getFormText(formData, "title"),
        issueLabel: getFormText(formData, "issueLabel"),
        organizationName: getFormText(formData, "organizationName"),
        assigneeName: getFormText(formData, "assigneeName"),
        publishedDate: getFormText(formData, "publishedDate"),
        slug: getFormText(formData, "slug"),
        description: getFormText(formData, "description"),
        primaryColor: getFormText(formData, "primaryColor"),
        status: getFormText(formData, "status"),
        packageTier: getFormText(formData, "packageTier"),
        productionMode: getFormText(formData, "productionMode"),
        estimatedHours: getFormText(formData, "estimatedHours"),
        designerHoursCap: getFormText(formData, "designerHoursCap"),
        projectPassword: getFormText(formData, "projectPassword"),
        clearProjectPassword: formData.get("clearProjectPassword") === "on",
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | { ok: true; project: { slug: string } }
      | { ok: false; message?: string }
      | null;

    if (!result) {
      setSubmitState({
        status: "error",
        message: isEditMode
          ? "기본 정보 수정에 실패했습니다. Supabase 서버 키와 입력값을 확인하세요."
          : "프로젝트 저장에 실패했습니다. Supabase 서버 키와 입력값을 확인하세요.",
      });
      return;
    }

    if (result.ok !== true) {
      setSubmitState({
        status: "error",
        message:
          result.message ??
          (isEditMode
            ? "기본 정보 수정에 실패했습니다. Supabase 서버 키와 입력값을 확인하세요."
            : "프로젝트 저장에 실패했습니다. Supabase 서버 키와 입력값을 확인하세요."),
      });
      return;
    }

    const nextAuthoringPath = getNextAuthoringPath(
      result.project.slug,
      getFormText(formData, "productionMode"),
    );

    setSubmitState({
      status: "success",
      message: isEditMode
        ? "수정되었습니다. 프로젝트 제작 화면으로 이동합니다."
        : "저장되었습니다. 선택한 제작 방식에 맞는 다음 화면으로 이동합니다.",
    });

    router.refresh();
    router.push(nextAuthoringPath);
  }

  const isSaving = submitState.status === "saving";

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#184a88]">작업 입력 영역</p>
          <h3 className="mt-1 text-lg font-bold text-[#092046]">
            {isEditMode ? "프로젝트 기본 정보 수정" : "프로젝트 기본값 입력"}
          </h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            submitState.status === "error"
              ? "bg-rose-100 text-rose-700"
              : submitState.status === "success"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-[#eaf2ff] text-[#184a88]"
          }`}
        >
          {submitState.status === "saving" ? "저장 중" : "DB 저장"}
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <FieldLabel required>소식지명</FieldLabel>
          <TextInput
            name="title"
            placeholder="예: 황토골 무안소식지 2025년 제94호"
            defaultValue={initialValues.title}
            required
          />
        </div>

        <div>
          <FieldLabel>발행호수</FieldLabel>
          <TextInput
            name="issueLabel"
            placeholder="예: 제94호, 통권 312호, 2026-05호"
            defaultValue={initialValues.issueLabel}
          />
        </div>

        <div>
          <FieldLabel required>기관명</FieldLabel>
          <TextInput
            name="organizationName"
            placeholder="예: 무안군"
            defaultValue={initialValues.organizationName}
            required
          />
        </div>

        <div>
          <FieldLabel required>작업자명</FieldLabel>
          <TextInput
            name="assigneeName"
            placeholder="예: 박춘수 또는 디자인팀 김OO"
            defaultValue={initialValues.assigneeName}
            required
          />
        </div>

        <div>
          <FieldLabel required>발행일</FieldLabel>
          <TextInput
            name="publishedDate"
            type="date"
            placeholder="2026-09-03"
            defaultValue={initialValues.publishedDate}
            required
          />
        </div>

        <div>
          <FieldLabel required>공개 주소 slug</FieldLabel>
          <TextInput name="slug" placeholder="예: muan-2025-94" defaultValue={initialValues.slug} required />
        </div>

        <div className="md:col-span-2">
          <FieldLabel>설명</FieldLabel>
          <textarea
            name="description"
            placeholder="소식지의 성격, 발행 목적, 주요 콘텐츠를 간단히 적습니다."
            defaultValue={initialValues.description}
            className="min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <div className="md:col-span-2">
          <FieldLabel required>대표 색상</FieldLabel>
          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
            <div className="flex flex-wrap gap-2">
              {primaryColorOptions.map((option) => {
                const isSelected = primaryColor.toLowerCase() === option.value.toLowerCase();

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setPrimaryColor(option.value)}
                    className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-black transition ${
                      isSelected
                        ? "border-[#092046] bg-white text-[#092046] shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-[#2f73b7] hover:text-[#092046]"
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-black/10"
                      style={{ backgroundColor: option.value }}
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center">
              <label className="inline-flex h-12 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#092046] transition hover:border-[#184a88]">
                <input
                  type="color"
                  value={isHexColor(primaryColor) ? primaryColor : "#092046"}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                직접 선택
              </label>
              <input
                name="primaryColor"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                required
                pattern="^#[0-9a-fA-F]{6}$"
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
              />
              <span className="text-sm font-semibold text-slate-600">공개 화면 헤더와 버튼 기준 색상</span>
            </div>
          </div>
        </div>

        <div>
          <FieldLabel>상태</FieldLabel>
          <select
            name="status"
            defaultValue={initialValues.status || "draft"}
            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          >
            <option value="draft">제작 중</option>
            <option value="in_review">검수 중</option>
            <option value="published">발행 완료</option>
            <option value="private">비공개</option>
          </select>
        </div>

        <div>
          <FieldLabel required>상품 옵션</FieldLabel>
          <select
            name="packageTier"
            defaultValue={initialValues.packageTier || "standard"}
            required
            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          >
            <option value="standard">표준형</option>
            <option value="basic">기본형</option>
            <option value="advanced">고급형</option>
            <option value="premium">프리미엄</option>
            <option value="retainer">월간 운영형</option>
          </select>
        </div>

        <div>
          <FieldLabel required>제작 방식</FieldLabel>
          <select
            name="productionMode"
            defaultValue={initialValues.productionMode || "hybrid"}
            required
            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
          >
            <option value="hybrid">혼합형</option>
            <option value="template">템플릿 블록형</option>
            <option value="full_image">이미지 페이지형</option>
            <option value="external_ebook">원본 연동형</option>
            <option value="ocr_assist">OCR 보조형</option>
          </select>
        </div>

        <div>
          <FieldLabel>예상 작업시간</FieldLabel>
          <TextInput name="estimatedHours" placeholder="예: 18~24시간" defaultValue={initialValues.estimatedHours} />
        </div>

        <div>
          <FieldLabel>디자이너 투입 상한</FieldLabel>
          <TextInput
            name="designerHoursCap"
            placeholder="예: 6시간 또는 별도 견적"
            defaultValue={initialValues.designerHoursCap}
          />
        </div>

        <div className="md:col-span-2">
          <FieldLabel required={!isEditMode}>프로젝트 비밀번호</FieldLabel>
          <div className="rounded-lg border border-slate-200 bg-[#f8fbff] p-4">
            <TextInput
              name="projectPassword"
              type="password"
              placeholder={isEditMode ? "새 비밀번호 입력 시 변경됩니다." : "이 프로젝트 작업 화면에 들어갈 비밀번호"}
              required={!isEditMode}
            />
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500 [word-break:keep-all]">
              {isEditMode
                ? initialValues.hasProjectPassword
                  ? `현재 프로젝트 비밀번호가 설정되어 있습니다.${
                      initialValues.projectPasswordUpdatedAt ? ` 최근 변경: ${initialValues.projectPasswordUpdatedAt}` : ""
                    }`
                  : "현재 프로젝트 비밀번호가 설정되어 있지 않습니다."
                : "일반 사용자가 만든 프로젝트는 이 비밀번호로 작업 화면 접근을 한 번 더 확인합니다. 관리자는 비밀번호 없이 접근합니다."}
            </p>
            {isEditMode && initialValues.hasProjectPassword ? (
              <label className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-3 text-sm font-bold text-slate-700">
                <input name="clearProjectPassword" type="checkbox" className="h-4 w-4 accent-[#092046]" />
                프로젝트 비밀번호 해제
              </label>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-7 rounded-lg border border-dashed border-sky-300 bg-[#eaf2ff] p-5">
        <h3 className="text-base font-bold text-[#092046]">
          {isEditMode ? "수정 기준" : "다음 단계: 제작 화면으로 이동"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {isEditMode
            ? "발행일, 담당자, 공개 주소, 상품 옵션은 기관 사정에 따라 바뀔 수 있습니다. 공개 주소 slug를 바꾸면 기존 공개 URL도 함께 바뀝니다."
            : "프로젝트 정보를 저장하면 작성/수정 목록에 반영되고, 선택한 제작 방식에 맞는 작성 화면으로 이동합니다."}
        </p>
      </div>

      <div
        className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold ${
          submitState.status === "error"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : submitState.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
        }`}
      >
        {submitState.message}
      </div>

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={isEditMode && initialValues.slug ? `/projects/${initialValues.slug}/settings` : "/projects/edit"}
          className="rounded-lg border border-slate-300 px-5 py-3 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "저장 중..." : isEditMode ? "수정 내용 저장" : "프로젝트 정보 저장"}
        </button>
      </div>
    </form>
  );
}
