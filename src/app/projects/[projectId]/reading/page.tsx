import Link from "next/link";
import { ProjectAdminShell } from "@/components/project-admin-shell";
import { StatusPill } from "@/components/status-pill";
import {
  linkBlockGuidelines,
  readingEditSections,
  sampleContentBlocks,
  sampleImageOverlays,
  sampleNewsletterArticles,
} from "@/lib/newsletter-data";

const previewButtons = ["신청 안내", "전화 연결", "지도 보기"];
const selectedArticle = sampleNewsletterArticles[0];

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-2 block text-sm font-bold text-[#092046]">{children}</label>;
}

function TextInput({ placeholder, defaultValue }: { placeholder: string; defaultValue?: string }) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
    />
  );
}

export default async function ReadingEditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  return (
    <ProjectAdminShell
      active="reading"
      projectId={projectId}
      title="모바일 읽기 보기 편집"
      description="기사 단위로 텍스트, 이미지, 문의처, 버튼, 음성 대본을 정리합니다."
      sidebarTitle={
        <>
          읽기 보기
          <br />
          편집
        </>
      }
      sidebarDescription="PDF 원본 또는 제공 원고를 바탕으로 모바일 기사형 콘텐츠를 다시 정리합니다."
      sidebarNoteTitle="편집 기준"
      sidebarNote="OCR은 보조 수단으로만 두고, 제목·본문·문의처·버튼·대본은 사람이 검수해 정리합니다."
      actions={
        <Link
          href={`/projects/${projectId}/pages`}
          className="rounded-lg border border-[#2f73b7] bg-white px-5 py-3 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
        >
          페이지 관리로 돌아가기
        </Link>
      }
    >
          <div className="grid gap-5 2xl:grid-cols-[300px_1fr_360px]">
            <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">기사 목록</h3>
                  <p className="mt-1 text-sm text-slate-500">페이지별 추출 텍스트를 기사 단위로 정리</p>
                </div>
                <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-xs font-bold text-[#184a88]">
                  {sampleNewsletterArticles.length}건
                </span>
              </div>

              <div className="space-y-3">
                {sampleNewsletterArticles.map((article, index) => (
                  <button
                    key={article.title}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      index === 0
                        ? "border-[#184a88] bg-[#f4f8ff] shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black text-[#184a88]">{article.page}</span>
                      <StatusPill value={article.status} />
                    </div>
                    <p className="mt-3 text-sm font-black text-[#092046]">{article.title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{article.summary}</p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#092046]">기사 편집</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    PDF 원본 또는 제공 원고를 모바일 독자에게 맞게 다시 씁니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {readingEditSections.map((section) => (
                    <span key={section} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {section}
                    </span>
                  ))}
                </div>
              </div>

              <form className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>기사 제목</FieldLabel>
                    <TextInput defaultValue={selectedArticle.title} placeholder="기사 제목 입력" />
                  </div>
                  <div>
                    <FieldLabel>상태</FieldLabel>
                    <select className="h-12 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100">
                      <option>편집 중</option>
                      <option>검수 필요</option>
                      <option>완료</option>
                    </select>
                  </div>
                </div>

                <div>
                  <FieldLabel>요약 문장</FieldLabel>
                  <TextInput defaultValue={selectedArticle.summary} placeholder="목차와 카드에 표시될 요약" />
                </div>

                <div>
                  <FieldLabel>본문</FieldLabel>
                  <textarea
                    defaultValue={selectedArticle.body}
                    className="min-h-56 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>대표 이미지 자산</FieldLabel>
                    <div className="rounded-lg border border-dashed border-sky-200 bg-[#f4f8ff] p-5">
                      <p className="text-sm font-bold text-[#092046]">이미지 자산 선택 전</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        기관 제공 원본 이미지 또는 디자이너 제작 이미지를 연결합니다.
                      </p>
                      <Link
                        href={`/projects/${projectId}/assets`}
                        className="mt-4 inline-flex rounded-lg border border-[#2f73b7] bg-white px-4 py-2 text-sm font-black text-[#092046] transition hover:bg-[#eaf3ff]"
                      >
                        이미지 선택
                      </Link>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>문의처</FieldLabel>
                    <div className="grid gap-3">
                      <TextInput defaultValue="무안군 홍보팀" placeholder="담당 부서" />
                      <TextInput defaultValue="061-000-0000" placeholder="전화번호" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>버튼명</FieldLabel>
                    <TextInput defaultValue="자세히 보기" placeholder="예: 신청하기" />
                  </div>
                  <div>
                    <FieldLabel>버튼 링크</FieldLabel>
                    <TextInput defaultValue="https://www.muan.go.kr" placeholder="URL 또는 전화번호" />
                  </div>
                </div>

                <div>
                  <FieldLabel>콘텐츠 블록 구성</FieldLabel>
                  <div className="grid gap-3 md:grid-cols-2">
                    {sampleContentBlocks.map((block) => (
                      <div key={block.id} className="rounded-lg border border-slate-200 bg-[#f4f8ff] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-[#092046]">{block.title}</p>
                          <StatusPill value={block.status} />
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{block.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>동영상 링크 카드</FieldLabel>
                    <div className="rounded-lg border border-dashed border-sky-200 bg-[#f4f8ff] p-5">
                      <p className="text-sm font-bold text-[#092046]">YouTube 등 외부 영상 연결</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        1차 MVP에서는 영상을 직접 업로드하지 않고 썸네일 카드와 외부 URL을 연결합니다.
                      </p>
                      <div className="mt-4 grid gap-3">
                        <TextInput defaultValue="홍보 영상 보기" placeholder="카드 제목" />
                        <TextInput defaultValue="https://www.youtube.com" placeholder="YouTube 또는 외부 영상 URL" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>지도 링크 카드</FieldLabel>
                    <div className="rounded-lg border border-dashed border-sky-200 bg-[#f4f8ff] p-5">
                      <p className="text-sm font-bold text-[#092046]">지도 이미지와 외부 지도 URL 연결</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        지도 이미지는 카드로 보여주고 카카오·네이버·구글 지도 URL로 이동합니다.
                      </p>
                      <div className="mt-4 grid gap-3">
                        <TextInput defaultValue="행사장 지도 보기" placeholder="지도 카드 제목" />
                        <TextInput defaultValue="https://map.kakao.com" placeholder="지도 URL" />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel>음성 대본</FieldLabel>
                  <textarea
                    defaultValue="무안군의 주요 정책과 생활 정보를 안내드립니다. 자세한 내용은 본문과 연결 버튼을 확인해 주세요."
                    className="min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-[#184a88] focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    초안 저장
                  </button>
                  <button className="rounded-lg bg-[#092046] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#123a78]">
                    검수 요청으로 변경
                  </button>
                </div>
              </form>
            </section>

            <aside className="space-y-5">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">모바일 미리보기</h3>
                <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-sm">
                  <div className="overflow-hidden rounded-[22px] bg-white">
                    <div className="bg-[#092046] px-4 py-4 text-white">
                      <p className="text-xs font-semibold text-sky-200">황토골 무안소식지</p>
                      <h4 className="mt-2 text-lg font-black">군정 주요 소식</h4>
                    </div>
                    <div className="p-4">
                      <div className="h-36 rounded-xl bg-gradient-to-br from-sky-100 to-blue-50" />
                      <p className="mt-4 text-sm font-bold leading-6 text-[#092046]">
                        무안군의 주요 정책과 생활 정보를 한눈에 확인할 수 있는 소식입니다.
                      </p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        PDF 원본의 내용을 모바일 독자가 읽기 쉬운 문단으로 정리합니다. 문의처와 신청 링크도 함께 제공합니다.
                      </p>
                      <div className="mt-4 rounded-xl bg-[#f4f8ff] px-4 py-3">
                        <p className="text-xs font-bold text-[#184a88]">본문 듣기</p>
                        <div className="mt-3 h-2 rounded-full bg-sky-100">
                          <div className="h-2 w-1/3 rounded-full bg-[#092046]" />
                        </div>
                      </div>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-black text-[#184a88]">동영상</p>
                        <div className="mt-2 rounded-lg bg-slate-100 px-3 py-4 text-center text-xs font-bold text-slate-600">
                          YouTube 썸네일 카드
                        </div>
                        <button className="mt-3 w-full rounded-lg bg-[#092046] px-4 py-2 text-sm font-bold text-white">
                          홍보 영상 보기
                        </button>
                      </div>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-black text-[#184a88]">지도</p>
                        <div className="mt-2 rounded-lg bg-sky-50 px-3 py-4 text-center text-xs font-bold text-slate-600">
                          지도 이미지 카드
                        </div>
                        <button className="mt-3 w-full rounded-lg bg-[#092046] px-4 py-2 text-sm font-bold text-white">
                          지도 보기
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {previewButtons.map((button) => (
                          <button key={button} className="rounded-lg bg-[#092046] px-4 py-2 text-sm font-bold text-white">
                            {button}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">검수 체크</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">문단이 모바일에서 너무 길지 않은지 확인</li>
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">대표 이미지 출처와 대체텍스트 확인</li>
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">전화번호, 지도, 신청 링크 동작 확인</li>
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">YouTube 등 외부 링크가 정상 이동하는지 확인</li>
                  <li className="rounded-lg bg-[#f4f8ff] px-3 py-2">음성 대본이 본문과 일치하는지 확인</li>
                </ul>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">링크·오버레이 기준</h3>
                <div className="mt-4 space-y-3">
                  {linkBlockGuidelines.map((item) => (
                    <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-[#092046]">{item.label}</p>
                        <span className="text-xs font-black text-[#184a88]">{item.status}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-[#092046]">이미지 오버레이 예고</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  이미지 위 클립과 클릭 영역은 2차 기능에서 좌표 기반 편집기로 확장합니다.
                </p>
                <div className="mt-4 space-y-3">
                  {sampleImageOverlays.map((overlay) => (
                    <div key={overlay.id} className="rounded-lg bg-slate-50 px-3 py-3">
                      <p className="text-sm font-bold text-[#092046]">{overlay.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        x {overlay.xPercent}% · y {overlay.yPercent}% · w {overlay.widthPercent}% · h {overlay.heightPercent}%
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </div>
    </ProjectAdminShell>
  );
}
