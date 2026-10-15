# 디자인 미리보기 정합성 v1

기준: main `5581233d1a99a2799a7291f57e3e55df613abb98` / PR #224 이후. 2026-10-15 (Asia/Seoul).
참조: [디자인 제작 흐름 감사](design-workflow-audit-v1.md).

## 조사 결과와 변경 전후

| 항목 | 기존 즉시 미리보기 / 저장본 reader의 차이 | 이번 변경 |
| --- | --- | --- |
| 본문 길이 | 일반 분기는 360자로 자름. 디자인 블록 존재 여부에 따라 별도 분기 | reader의 `ArticleCard`를 그대로 재사용. 본문 전체와 실제 visible/sortOrder 정책 적용 |
| 제목·소제목·요약 | 별도 h3/중앙 정렬/간략 summary와 reader의 h2/한국어 줄바꿈/유형별 summary가 다름 | 동일 카드의 제목, 정렬, HTML 디자인, 유형 배지, 요약 사용 |
| HTML 본문 디자인 | info/quote/caption 유무에 따라 일부 내용만 그리는 mock | 같은 `ArticleBodyDesignElement` / `ArticleDesignedCaption` 및 일반 문단 경로 사용 |
| 공공정보·CTA·문의 | 일반 분기에 핵심정보/CTA/문의가 빠짐 | 같은 `ArticlePublicInfoCard`, attached action, button/map/video/audio block, 전화 문의 표시. URL 검증/CTA 중복 억제도 reader 정책 그대로 |
| 이미지 | captionStyled 등이 없으면 일반 image block이 누락될 수 있음. 확대 미연결 | 일반·AI hero/body·Canva full-layout 모두 공용 카드. 기존 private file mapper의 승인된 URL을 그대로 사용. 기존 lightbox 재사용 |
| 배경·상단 장식 | 일반 mock은 여러 배경/160px 장식, 별도 transform/z-index. fluid 분기만 공통 layer | 지원 슬롯별 첫 유효 visible 배치 하나를 sortOrder/createdAt 순으로 선택. 공용 `ArticleHeroBackgroundLayer`의 크기·fit·offset·scale·opacity·rotation·z-index/HTML 보호 사용 |
| 미지원 슬롯 | title_icon/body_decoration/footer_banner가 mock에만 나타나 공개 결과로 오인 가능 | 편집/저장 모델과 #224 안내 유지. 공용 카드에 이 3개 슬롯을 추가하지 않으며 즉시 미리보기도 표시하지 않음 |
| 표시 폭 | max390 고정. 관리자 브라우저 폭의 vw가 reader 폭과 다름 | 모바일 390 / reader 최대 520 선택, 좁은 작업창에 맞춤. preview 안의 제목 크기와 카드 padding만 cqw로 계산하여 해당 viewport의 reader CSS와 맞춤 |
| 글꼴·정렬·표시 모드 | 축약된 article props에 contentPresentation, alignment, contact, fonts 등이 빠짐 | 별도 `previewArticle`에 기존 서버 file mapper 결과/전체 저장 기사 전달. 기존 생성·추천·저장용 article props는 유지. 기존 font 조회/face style과 프로젝트 기본 글꼴·연결 survey 전달 |
| 편집/저장 구분 | #224 dirty/error/saving 표시와 저장본 iframe 안내 | hook/API/상태 전달 변경 없음. 로컬 Composition은 즉시 카드에만 전달. 원문은 마지막 기사 저장 기준이라는 기존 안내 유지 |
| 긴 페이지 | 2xl 이전에는 설정과 미리보기가 수직 배치 | xl부터 공통 카드 옆 sticky 미리보기. 미리보기 내용은 75dvh 내 스크롤. 768 이하에서는 기존 수직 흐름 유지 |

독립 renderer를 추가하지 않았다. `public-mobile-article-reader.tsx`의 기존 `ArticleCard`에 export만 추가했다. public/client-review의 카드 호출 및 실행 동작은 수정하지 않았다. Composition editor의 저장 hook, provider 실행 입력, API 계약은 그대로 유지했다.

## 의도적으로 남는 차이

- 즉시 미리보기는 **편집 상태**: draft Composition, 미승인/비활성 자산도 로컬 편집 입력으로 보일 수 있다. 저장본의 ready/approved/active/visible 및 공개·review 권한 gate는 서버가 별도 적용한다. 즉시 미리보기는 공개 가능 여부를 보증하지 않는다.
- 기사 title/body/blocks/links는 저장된 값이다. 작성 탭의 미저장 원문 폼 입력을 실시간 연결하지 않았다.
- reader 전체의 발행호 헤더·목차·기사 이동·관심분야 정렬·발행 필터·하단 navigation은 즉시 카드의 대상이 아니다. 저장본 미리보기 iframe은 그대로 최종 확인 경로다.
- 520px 옵션은 **520px reader viewport**를 모사한다. 실제 넓은 브라우저에서 reader max520에 적용되는 `vw`의 상한(제목40px/padding28px)과는 약간 다를 수 있다. 실제 desktop/e-book 전체 레이아웃을 복제하지 않는다.
- 실제 글꼴 파일, 네트워크 이미지, 음성·영상 재생, 연결 설문 상태, 모션 실행 시점은 환경 의존이다. 기존 검증/권한/analytics 정책은 그대로이며 preview card의 analytics는 비활성화했다. preview를 연다는 이유로 생성/저장/발행하지 않는다.
- 미지원 3개 슬롯, 활성 client-review session의 실제 managed image live QA, 고해상도 Canva Retina QA는 이번 작업으로 확대하지 않았다.

## 검증 방식

원격 기사·자산을 변경하지 않고 로컬 disposable fixture로 비교한다. 같은 article/Composition 입력을 (1) 즉시 미리보기와 (2) reader `ArticleCard`를 사용하는 별도 iframe에 전달한다. 개발용 비교 페이지는 PR에서 제거한다. 실제 원격 저장본을 재조회한 E2E나 Staging 배포를 수행했다고 주장하지 않는다.

- short / long(360자를 훨씬 넘는 본문) / mixed(문단·info·quote·이미지·캡션·CTA·문의·공공정보) / fluid frame 4종.
- 390 / 768 / 1440 관리자 viewport, 기본/최대 글자: **24조합**. 동일 가용 폭에서 두 카드의 textContent, 전체 width/height, 제목·공공정보 글자 크기 일치. 가로 overflow 없음.
- 520px 옵션에서도 mixed 카드 내용/width/height/글자 크기 일치 확인. 기본 mixed 예: width465, height2092.672, title39px.
- 390px 좁은 작업창에서는 가용 preview 폭351px → 카드296px. 두 카드 치수·내용 일치, 본문/CTA 줄바꿈 정상. 화면 폭을 강제로390으로 유지하지 않음.
- 기존 lightbox 열기/닫기 확인. 확대는 원본 image proxy/src 사용. 기본/최대 글자 토글 공용 컴포넌트 유지.
- 신규 회귀는 실제 shared card 마크업 비교, 긴 본문 끝 문장, visible/sortOrder, HTML 요소·CTA·문의, 배경/장식 변환, 잘못된 설정·타입 fallback, 일반 image/full-layout, 원문 불변을 검증한다.

- 전체 회귀 **362/362 통과**(신규 8건 포함). PR #224 저장 상태 hook 회귀 16건도 포함한다.
- 미리보기 단독 / reader 단독은 Webpack production build에서 console error **0건**. 미리보기 단독 390/768/1440에서도 가로 overflow 0, 최대 글자 토글 정상.
- **검증 도구 한계:** 나란히 비교하는 임시 Next 페이지에서는 최초 iframe 로딩 때 `MutationObserver.observe` 오류 1건이 개발/production build 모두에서 관찰됐다. 앱 코드에는 해당 observer가 없고 미리보기/reader 각각 단독에서는 재현되지 않았으나, 원인을 확정하지 않았다. 비교 harness의 console까지 0이었다고 주장하지 않는다. 임시 비교 경로/대조군 파일은 최종 PR에서 제거했다.
- 최종 TypeScript (`tsc --noEmit`), lint, Webpack build (`npm run build -- --webpack`), `git diff --check` 모두 통과. lint 오류 0 / 신규 warning 0, 기존 warning 3건(발행 img 2, health-check 미사용 인자 1) 유지. 임시 fixture 제거 뒤 깨끗한 build cache에서 최종 build/typecheck를 재실행했다.

## 데이터·Production 영향

- DB migration / 신규 API / dependency / Storage 변경 없음.
- 기존 server-side 파일 mapper와 public/review visibility 검증 변경 없음.
- Production DB/Storage write 및 외부 GPT/Canva/Adobe 생성 API 호출 없음.
- 원격 write E2E, Staging 도메인 전환, Production 배포 및 merge 수행하지 않는다.
- stash 원본 2개 유지: `a330dcb89d1a043b6c7430ac711b48242176fc1b`, `66e70a2e33a3f594b71716359470d69774e761b7`.
