# 관리자 작업 흐름 UI 감사 v1

## 1. 기준과 현재 단계

- 기준 main: `e923687065fe7d35f81650cf1a8bfb143d2bf457`.
- 작업 브랜치: `codex/admin-ux-workflow-audit-v1`.
- 2–8절은 앱 UI/API/SQL 변경 전에 작성한 감사·설계 기록이다. 이후 승인과 구현 결과는 10–12절에 구분했다.
- 코드: App Router 주요 page, `ProjectAdminShell`, `AdminMainNavigation`, `ArticleWorkspaceTabs`, 기사 편집 폼, 저장 API/repository, 공개 기사 정렬, SQL 함수 및 git history 확인.
- 화면: 고정 Staging의 기존 `canva-e2e-test`에서 관리자 GET 탐색만 수행했다. Staging 코드와 기준 main의 `src` 차이는 없다. 기사 저장·삭제·순서 변경·발행·AI/Canva 생성 버튼은 누르지 않았다.
- 1440×1000: 프로젝트 목록/작업 큐/생성/설정/기사 신규·수정·디자인/기관 디자인/pages/assets/publish/distribution/survey/analytics/audio/quick-post, 총 16개 화면 상태 확인.
- 768×1000: 기사 작성·디자인 탭, design/pages/publish/analytics/assets/distribution/survey/settings/audio를 추가 확인. 아래 높이는 기존 데이터와 기본 펼침 상태에서의 대략적인 문서 높이이며 성능 측정값이 아니다.
- 원본 stash 두 개는 그대로 유지한다. Production 접근·DB/Storage write·migration 적용·외부 생성 호출 없음.

## 2. 화면별 감사

`P`는 기존 `/projects/[projectId]`를 뜻한다. 이 프로젝트의 `[projectId]` route 값은 UUID가 아닌 slug로 사용하는 기존 계약을 유지한다.

| 화면/route | 화면 목적 | 핵심 사용자 행동 | 현재 주요 섹션 | 중복 요소 | 불필요/과다 요소 | 누락·발견성 문제 | 작업 순서상 위치 | 개선 필요도 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 프로젝트 목록 `/` | 작업 대상 찾기 | 프로젝트 열기·생성·미리보기 | 목록/상태/접속 요약/순위/제작 흐름/운영 기능/이미지 기준 | 접속 요약과 하단 운영 요약, 작업 안내 반복 | 제작 시작보다 하단 운영 설명 비중이 큼 | `작성/수정`이 현재 `/pages`로 연결되어 모바일 기사 편집과 불일치 | 시작/준비 | 높음 |
| 프로젝트 작업 큐 `/projects/edit` | 미발행 프로젝트 작업 진입 | 추천 작업 열기 | 작업 대상 목록/추천 작업/전체 메뉴 펼침 | `/` 프로젝트 목록과 목적 일부 중복 | 전체 프로젝트 목록과 차이를 더 명확히 해야 함 | 전역 메뉴에 독립 작업 큐 진입이 드러나지 않음 | 시작/작성 | 중간 |
| 프로젝트 생성 `/projects/new` | 발행호 생성 | 기본 정보·표지 입력 후 저장 | 기본값/글꼴/표지/e-book/유형·상품·제작 방식 안내 | 우측 가이드와 실제 입력 내용 반복 | 처음부터 글꼴·상품 설명 등 장문 노출 | 프로젝트 생성과 기사 신규 작성의 명칭 혼동 가능 | 준비 | 중간 |
| 프로젝트 설정 `P/settings` | 기관·호수·공개 기준 관리 | 기본정보 수정 | 기본정보/표지/e-book/기준 정보/저장 후 이동 | 설정 폼과 우측 기준 요약, 기관 색상·글꼴과 design 범위 중첩 | 운영 기준 설명 반복 | 작업 중 변경 위험과 단순 기사 편집 구분 필요 | 준비 | 중간 |
| 현재 기사 작업 `P/reading` | 기사 목록+작성+디자인+검수 혼합 | 기사 선택/신규 작성/저장/미리보기 | 좌측 전체 기사 카드·자료 상태 + 작성/디자인/검수 탭 | 전체 목록과 편집 헤더 통계, 원본자료 상태와 준비 화면, 저장본 검수 안내 | 목록 카드의 블록·링크·요약 metadata가 기본 노출됨 | 독립 목록 없음, 순서 변경 버튼 없음, 잘못된 articleId가 신규 폼으로 fallback | 작성/구성/검수 | 높음 |
| 신규/기존 기사 폼 `P/reading?articleId=…&tab=content` | 단일 기사 입력 | 제목·본문·AI 도움·CTA·저장 | AI 자료 입력/기본 정보/표현 방식/블록/공공정보·행동/고급 설정/미리보기/저장 | workspace 제목과 폼 제목, 입력 미리보기와 저장본 확인의 명칭이 불분명 | 전체 기사 목록이 계속 자리 차지, 기본 화면에 제작 방식·모션 요약까지 혼재 | 저장이 하단에 멀리 있음, 기사 순서가 고급 설정 두 단계 안에 있음 | 작성 | 높음 |
| 기사 디자인 `P/reading?articleId=…&tab=composition` | 기사별 시각 구성 | 시각 전략 검토/자산·패턴/저장본 미리보기 | Visual Director/AI 이미지/추천/Canva/패턴/텍스트/Composition/즉시 미리보기 | 상단 모바일 확인과 내부 preview, 여러 저장·적용 버튼의 영향 범위 설명 분산 | 선택 기사 밖 전체 목록, 기본 제작과 transform 상세가 같은 맥락에 보임 | 생성/승인/적용 및 텍스트 저장/Composition 저장 구분을 더 명시할 필요 | 구성 | 높음 |
| 디자인 준비 `P/design` | 기관 기준과 발행호 자산 준비 | CI/색상/원본·제작 자산/Canva registry 관리 | 브랜드/자료 접수/일괄·단건 자산/일괄 디자인/Canva/기사별 이동 | assets와 자산 명칭, 기본 안내와 섹션 안내 반복 | 하나의 긴 화면에 기관 기준·호수 자산·기사 진입이 누적 | 어느 저장 버튼이 무엇을 저장하는지 범위 확인 부담 | 준비 | 높음, 큰 변경은 후속 |
| e-book 페이지 `P/pages` | 원본 페이지·클릭 영역 관리 | PDF/이미지 등록·변환·hotspot·preview | PDF 원본/페이지 생성/검색텍스트·음성/수동 업로드/목록/hotspot/preview/가이드 | PDF 선택 흐름 둘, 다음 작업 안내와 전역 흐름 | 신규 모바일 기사 작성에도 기본 진입 route로 사용됨 | 페이지 목록과 편집 선택의 경계 불명확 | 구성(e-book) | 높음, 큰 변경은 후속 |
| 이미지 소재 `P/assets` | 기존 기사 소재 보관 | 업로드/권리·품질 확인 | 업로드/선택정보/목록/이미지·AI 기준/검수/다음 작업 | design의 제작 자산과 명칭이 유사하지만 다른 저장 모델 | 설명 카드·우측 안내·실제 목록에서 반복 | UI 필터 버튼은 page에 handler/state가 없어 동작 확인이 필요함 | 준비 | 중간 |
| 검수·발행 `P/publish` | 저장본과 기관 승인 후 발행 | preview/기관 검토 요청/최종 발행 | 승인 대기/기관 검토/발행/체크리스트/준비 요약/미리보기/공개 정보 | 상태 요약·준비 요약·체크리스트·하단 공개 정보의 내용 반복 | 기본 화면에 긴 체크리스트가 펼쳐짐 | 기관 검토와 최종 발행 상태는 이미 분리되어 있으며 보존해야 함 | 검수→발행 | 높음, 큰 변경은 후속 |
| 배포 `P/distribution` | 발행 후 공유·발송 기록 | 그룹/발송기록/문안·URL 복사 | 입력 폼/그룹 목록/기록/문안/공개 링크/배포 체크/필요 SQL | 공개 링크/발송 문안/상단 단계 안내 중첩 | 일반 작업자에게 `필요 SQL` 등 구현 설명이 노출됨 | 메뉴의 `최종발행·채널` 설명은 실제 역할인 배포 기록과 다름 | 발행 후 운영 | 중간 |
| 참여 콘텐츠 `P/survey` | 설문/이벤트 구성과 응답 운영 | 문항 작성·기사 연결·응답 확인 | 생성/문항/콘텐츠 목록/문항 요약/최근 응답/기준·메모 | 생성과 운영 통계가 한 화면에 있음 | 안내 카드 반복 | 작성 전 설문 준비와 발행 후 응답 운영의 단계 구분 필요 | 준비+운영 | 중간 |
| 분석 `P/analytics` | 운영 성과 해석 | 기간 선택·리포트·분석 | KPI/운영리포트/AI해설/기간·일별·기기·유입·채널·전환·분류/기사/저장리포트/해석 | 첫 요약·리포트 인사이트·하단 기사 요약 반복 | 빈 데이터에서도 여러 상세 섹션이 길게 노출 | 핵심 지표에서 상세로 내려가는 구조 부족 | 운영/분석 | 높음, 이번 PR은 기록만 |
| 음성 `P/audio` | 음성 연결·재생 점검 | 업로드/연결/재생 | 파일/AI TTS/기사 연결 표/preview/검수·가이드 | 편집기 음성 설정과 역할 겹침 | 넓은 기사 표의 min-width=1040px | 1440px audit에서 문서 가로 overflow 관찰; 별도 보정 필요 | 구성/검수 | 중간, 후속 |
| 빠른 소식 `P/quick-post` | 수시·긴급 기사 입력 | 임시 저장 또는 즉시 게시 | 기본 내용/노출/문의·행동 | 일반 기사 신규 작성과 진입 의미 겹침 | 정기 기사 작성 흐름에서 구분 없는 빠른 등록 링크 | 즉시 게시와 일반 저장의 차이를 진입 전에 안내할 필요 | 작성, 수시 전용 | 중간 |

위 표의 ‘과다/불필요’는 기능 삭제 제안이 아니라 기본 노출을 줄이거나 필요한 위치에서만 제공하자는 의미다. 반복되는 자산별 저장 버튼처럼 대상이 서로 다른 컨트롤은 같은 기능으로 합치지 않는다. publish의 승인 gate, source별 자산 승인, 고급 권한 검증은 UX 정리로 제거하지 않는다.

## 3. 우선 문제 Top 10

1. **모바일 기사 작업 진입이 잘못 연결됨**: 대시보드의 `작성/수정`은 `/pages`이며 메뉴 `모바일 소식지`는 `/reading`이다. 기사 작업과 e-book 작업을 구분한다.
2. **전체 목록과 단일 편집 혼합**: 280px 전역 sidebar와 280–300px 기사 sidebar가 편집 영역을 압박한다. 태블릿에서는 목록 전체가 폼 앞에 쌓인다.
3. **목록 순서와 공개 기본 순서 불일치**: reading 목록은 pageNumber 우선, repository는 sort_order 우선이다. 원본 페이지는 출처 정보이지 기사 노출 순서가 아니다.
4. **핵심 순서 기능 발견성·안전성 부족**: 숫자 입력은 남아 있지만 고급 설정 두 단계 안에 숨겨졌다. 순서 전용 저장·중복 방지·stale 검증이 없다.
5. **navigation과 작업 흐름 중복**: 전역 메뉴/프로젝트 하위 메뉴/상단 운영 흐름/화면별 다음 작업이 겹치며 준비→작성→구성의 경계가 약하다.
6. **단일 기사 안의 저장·적용 의미 혼재**: 기사 저장/텍스트 디자인 저장/디자인 적용/Canva 생성·승인·가져오기·기사 적용을 같은 저장처럼 읽지 않도록 범위를 분명히 한다. 계약은 유지한다.
7. **미리보기 기준 불명확**: 입력 중 즉시 미리보기와 저장본 모바일 확인을 구분한다. 중복 preview 버튼을 모두 추가하는 대신 하나의 상단 진입과 영역별 명확한 설명을 사용한다.
8. **자산 관리 명칭 충돌**: `/assets`의 기사 소재와 `/design`의 Design Asset은 다른 모델이다. 하나로 합치기보다 역할을 명시한다.
9. **잘못된 기사 ID가 신규 작성으로 열림**: `selectedArticle=null` fallback 때문에 편집하려다 새 기사를 만들 가능성이 있다. 신규는 articleId 없음으로 명시하고, 잘못된 ID는 안내/404 처리한다.
10. **장문 페이지와 안내·카드 중첩**: design/analytics/publish에서 기본 노출이 길다. 이번에는 기사 작업 영역만 정리하고 나머지는 후속 PR로 분리한다.

## 4. 실제 화면 baseline

| 화면 상태 | 1440px 문서 높이 | 768px 문서 높이 | 관찰 |
| --- | ---: | ---: | --- |
| 프로젝트 목록 | 2,538px | 미측정 | 접속 요약·제작 안내가 목록 뒤에 계속 이어짐 |
| 신규 프로젝트 | 2,910px | 미측정 | 폼/유형/상품 안내 병렬 |
| 기본 설정 | 3,573px | 5,781px | 폼과 기준 안내 누적 |
| 신규 기사 | 3,642px | 미측정 | 신규 작성에도 전체 기사 목록 표시 |
| 저장 기사 작성 | 3,764px | 6,250px | 폼 진입 전에 목록·안내, 고급 설정에 기사 순서 |
| 저장 기사 디자인 | 2,531px | 5,323px | 동일 기사 sidebar와 다층 디자인 UI |
| 디자인 준비 | 5,928px | 8,744px | 자료·자산·Canva·일괄 기능 누적 |
| e-book 페이지 | 3,433px | 6,599px | PDF/페이지/영역/preview 모두 한 화면 |
| 검수·발행 | 4,064px | 6,970px | 승인/발행 gate 정상, 체크리스트 길이 큼 |
| 분석 | 5,153px | 7,138px | 빈 데이터에도 상세 지표가 연속 |
| 이미지 소재 | 1,760px | 3,682px | source/rights/quality 설명 중첩 |
| 배포 | 2,305px | 5,432px | 기록 입력과 공유 안내 혼재 |
| 참여 | 2,855px | 5,240px | 제작/응답 운영 혼재 |
| 음성 | 2,170px | 4,575px | 1440/768px 가로 overflow, 768 viewport에서 문서 폭1,074px 관찰 |
| 빠른 소식 | 1,716px | 미측정 | 수시 전용 의미를 더 명시할 필요 |

측정한 기사 작성·디자인, design/pages/publish/analytics는 1440/768px에서 document overflow가 없었다. 이 값은 **변경 전 baseline**이며 개선 후 검증 결과가 아니다. 감사 탭의 console error 로그는 0건이었다. 저장/API 호출, 이미지 생성, destructive action을 하지 않았다.

## 5. 제안 정보구조와 이번 PR 경계

상위 작업 흐름: **준비 → 작성 → 구성 → 검수 → 발행 → 운영/분석**.

- 준비: settings + design(기관/발행호 기준) + assets(기사 소재). 별도 대형 페이지 재설계는 하지 않는다.
- 작성: 새 `P/articles` 목록 → 새 기사/기사 수정. 빠른 소식은 수시 전용 secondary link.
- 구성: 선택 기사 `P/reading?articleId=…&tab=composition`, e-book `P/pages`, 음성 `P/audio`.
- 검수: 선택 기사 저장본 preview + `P/publish`의 기관 검토. 기존 승인 workflow 보존.
- 발행: `P/publish`의 최종 발행 gate를 그대로 사용. 새 publish route나 자동 발행을 만들지 않는다.
- 운영/분석: distribution/survey/analytics. survey 제작은 준비 단계에서도 바로 접근 가능하게 의미를 안내한다.

동일 route에 검수/발행 단계가 존재해도 단계를 구분해 표시할 수 있다. 이번 PR에서 모든 route를 분할하지 않는다. analytics/design/publish/pages/audio의 큰 변경은 후속 감사 backlog다.

### 기사 목록: `/projects/[projectId]/articles`

- 기존 `getProjectContent`, project auth/unlock, 상태/기사 유형/공개 표시 helper, Composition source 조회를 재사용한다.
- 순번/제목/기사 유형/상태/수정일/공개 상태/디자인 상태, 편집·저장본 미리보기·신규 작성만 기본 노출한다.
- 디자인 상태는 실제 저장된 productionPattern/textDesign/Composition/managed 이미지의 존재 근거로 요약한다. 생성 성공·검토 승인·기사 적용을 같은 상태로 표시하지 않는다.
- 공개 상태는 project 발행 상태와 기존 `isArticlePubliclyVisible`/기간 규칙을 함께 표시한다. 정기 기사 status만 보고 공개 여부를 임의 판정하지 않는다.
- source page, 블록·링크 수, 세부 metadata는 펼침으로 이동한다.
- 기본 정렬은 저장된 sort_order와 동일. 초기 중복은 repository의 기존 보조 정렬을 유지해 읽고, 원자적 순서 저장 시 중복 없는 값으로 정규화한다.
- drag handle + 위/아래 버튼을 같은 단일 순서 상태에 연결한다. drag만으로 접근성을 충족한다고 보지 않는다. 조정 후 `순서 저장`으로 명시적 저장, 진행 중 중복 요청 차단, 충돌 시 재조회.

### 단일 기사: 기존 `/reading` 보존

- `/reading?articleId=…&tab=content|composition|review` deep link를 유지한다. `/reading?tab=content`는 기존 신규 작성 경로로 유지한다.
- 전체 기사 sidebar·원본자료 요약 카드를 제거하고 `기사 목록으로`와 단일 기사 작업 영역만 둔다.
- 잘못된 articleId는 명확한 찾을 수 없음 처리. 신규 작성으로 바꾸지 않는다.
- 기존 작성/디자인/검수 탭 재사용, 추가 tab 체계를 만들지 않는다.
- 상단/하단 action: `기사 목록으로`, `기사 저장`, `저장본 미리보기`, `검수·발행`. 디자인 저장의 기존 범위는 변경하지 않는다.
- CTA·핵심 공공정보는 한 번 펼쳐 접근 가능하도록 요약하고, 회전/z-index/상세 metadata는 기존 세부 조정 안에 유지한다. 일반 작업자의 AI/Design/Canva 기능을 없애거나 실행 정책을 바꾸지 않는다.
- 기사 순서는 목록의 한 위치에서 관리한다. 기존 숫자 입력을 다른 숫자 입력으로 복제하지 않는다.

### navigation 연결

- 대시보드·작업 큐의 모바일 기사 작업 진입 → articles. e-book 프로젝트는 pages 진입 유지.
- 프로젝트 메뉴 `기사 목록`(작성/순서), `e-book 페이지`, `음성 관리`를 의미가 분명하게 표시한다.
- 기존 pages/reading/settings 등 route와 deep link를 삭제하지 않는다.
- 전역 메뉴 전체 개편 대신 기사 작업 진입과 중복 안내만 최소 변경한다.

## 6. 과거 기사 순서 기능 조사

| 증거 | 확인된 동작 | 결론 |
| --- | --- | --- |
| `673e93d351855b410a3b00e258cc07be22ae8c00` — Add real article editor workflow | 편집기 상단에 `순서` number input, `sortOrder`를 기사 저장 요청에 포함 | 과거 순서 숫자 입력 존재 확인 |
| `277cc55f` — simplify article editor workflow | `기사 순서`를 노출·우선순위 설정에 배치 | 현재 필드의 직접 history |
| `25783ccc997453d0de75a5bb4d7d3f3a49227e5c` | 고급 설정 section을 접힌 details로 변경 | 삭제가 아니라 추가 disclosure 안으로 이동 |
| `e5a14337b84b3bb80cd4331de678aa3fe4b2bb1a` | reading 목록 카드의 순서/블록/링크 등 정보 강화 | 별도 목록의 drag 저장 기능 복구 commit은 아님 |
| 전체 local refs의 article reorder/move/drag history, 삭제 component 이름 조사 | 독립 기사 목록 reorder component/API는 확인하지 못함. reader swipe/다음기사 제스처와 블록 위/아래 버튼은 별개 | 과거 기사 drag 기능이 있었다고 단정하지 않음 |

현재 원문 블록의 위/아래 이동을 프로젝트 기사 순서 변경으로 오인하지 않는다. 숫자 필드는 실제 확인했고, 독립 reorder API는 현재 코드와 Staging 함수 메타데이터 양쪽에서 없음을 확인했다.

## 7. 저장 계약·안전성 조사 결과

- `newsletter_articles.sort_order`: 기존 integer not null default0. project+sort_order unique 제약은 없다.
- 실제 Staging 테스트 프로젝트 기사 4건의 sort_order가 **모두0**이었다. 기존 중복이 이미 존재한다. 감사 중 변경하지 않았다.
- `getProjectContent`: sort_order ASC, updated_at DESC. reading sidebar만 pageNumber를 추가 우선해 불일치한다.
- 공개 reader는 `getPublicOrderedArticles`를 재사용한다. 정기 기사의 기본 순서는 입력 순서이며, 수시·긴급 우선/기관 중요도/독자 관심사 조건은 별도 정책이다. 이번 UI 정리에서 그 정책을 덮어쓰지 않는다. 목록에는 ‘기본 순서’와 자동 우선 노출 안내를 구분한다.
- `save_newsletter_article_atomic`는 기존 기사 저장 때 content block/link를 삭제 후 재생성한다. 순서만 바꾸려고 호출하면 row identity와 managed reference를 훼손할 수 있으므로 **재사용 불가**.
- `delete_newsletter_article_atomic` 안에 남은 기사 순서 정규화가 있지만, 기사 삭제 함수이므로 **재사용 불가**.
- 여러 PATCH를 순서대로 보내면 중간 실패/동시 수정 시 반쪽 순서·중복이 남을 수 있다. client rollback은 서버 중단을 보장하지 못하므로 사용하지 않는다.
- 한 기사에 사용하지 않는 정수를 넣는 방법도 기존 중복·정수 간격 소진·동시 이동·기존 폼 저장의 stale sortOrder를 해결하지 못한다.
- Staging OpenAPI GET에서 기존 공개 RPC 15개 확인. 기사 save/delete/Composition/design/review 함수만 있고 순서 전용 atomic RPC는 없다. 함수 실행이나 SQL write는 하지 않았다.

## 8. 승인 전 최소 atomic 설계 (제안)

감사 당시 migration 필요를 확인하고 구현을 중단해 승인을 요청했다. 이후 사용자가 **“함수 migration 예외 허용: 구현·PR까지, DB 적용 별도 승인”**을 승인했다. 아래 설계를 구현했으며 원격 DB 적용은 하지 않았다.

### 8.1 새 순서 전용 RPC 1개

제안 함수: `reorder_newsletter_articles_atomic`.

입력: `p_project_id uuid`, `p_ordered_article_ids uuid[]`, `p_expected_snapshot text`.

반환: `{ok, duplicate, snapshot, articles:[{id,sortOrder,updatedAt}]}`. stale는409, 다른 프로젝트 ID/중복 ID/누락 ID는명확히 거부한다.

Transaction 설계:

1. service_role 확인; API는 기존 project access/unlock과 same-origin을 재검증한다. anon/review는 사용 불가. 기존 작업자 권한을 임의 확대하지 않는다.
2. 프로젝트 row를 FOR UPDATE, 해당 프로젝트 article rows를 ID 고정 순서로 FOR UPDATE 잠금한다. 기존 저장/삭제 함수의 프로젝트 lock 순서와 맞춰 교착 위험을 검증한다.
3. current `{id,sort_order,updated_at}` 전체 set의 canonical digest를 계산한다. expected와 다르면 write0으로 conflict. 본문/블록/링크를 snapshot이나 응답에 복제하지 않는다.
4. 요청 ID 배열이 현재 프로젝트 전체 article ID set과 정확히 같고 중복이 없는지 검증한다. 다른 project/누락/추가·삭제/동시 정렬은 거부한다.
5. 요청 순서에 따라 기존 sort_order를10/20/30…으로 한 transaction에서 정규화한다. 기사 본문·page_id·대표 이미지·block·link·Composition·asset/job/Storage는 수정하지 않는다. 변경된 article의 updated_at만 기존 정책에 맞게 갱신한다.
6. 동일 순서의 재호출은 현재 snapshot/순서와 맞으면 duplicate/no-op. 오래된 snapshot에 대한 요청은 ‘같아 보인다’는 이유로 자동 덮어쓰지 않는다.
7. 오류 시 전체 rollback. 응답이 미확정이면 재조회하여 실제 저장 순서를 확인하며 자동 write 재시도하지 않는다.

### 8.2 기존 article save의 최소 보완도 필요

새 reorder 함수만 추가하면 오래 열린 편집 폼이 예전 sortOrder를 일반 저장 때 다시 보내 순서를 덮어쓸 수 있다. 따라서 함수 migration은 새 RPC1개에 더해 기존 `save_newsletter_article_atomic`의 **순서 취급 부분만** 교체하는 안을 권장한다.

- 기존 기사 저장: 현재 DB sort_order 보존. 신규 목록만 순서 변경의 권위 있는 위치가 된다.
- 신규 기사 저장(일반/빠른 소식): 프로젝트 잠금 안에서 마지막 순서 다음에 추가해 신규 default0 중복을 방지한다.
- body/block/link 저장 계약 자체는 이번 범위에서 재설계하지 않는다. 순서 전용 RPC는 그 저장 함수를 호출하지 않는다.
- table/column/index/policy 추가는 제안하지 않는다. 기존 함수 보완까지 포함한 **함수 정의 migration**이 승인 대상이다. 신규 함수 execute는 service_role만 허용한다.
- 파일명: `supabase/schema_v1_38_article_order_atomic.sql` (승인 후 작성, 원격 미적용).
- Production 적용 금지. Staging 적용도 별도 명시 승인 전 실행하지 않는다.

### 8.3 Staging E2E의 ‘기사 1건’ 제약

현재4건이 모두 sort_order0이므로 중복 없는 정규화는 최대4건의 순서 값을 바꿀 수 있다. 이는 ‘기존 테스트 기사1건만 사용’ 범위로 임의 확대해서 실행할 수 없다.

- 기사 작성/수정 E2E는 기존 테스트 기사1건만 사용하고 원문/row 상태를 원복한다.
- 순서 E2E는 **같은 테스트 프로젝트의 순서 필드에 한정한 다중 기사 변경·정확한 원복**을 별도로 승인받거나, 먼저 로컬 격리 SQL fixture로만 검증한다.
- 정렬 전 원래 ID/order/updated_at 및 원문 hash를 기록한다. 원복도 atomic하게 수행하며 원래 상태에 중복이 있었음을 감추기 위해 임의로 유지/정규화하지 않는다. 운영 RPC의 중복 금지와 기존 중복 snapshot 복원은 서로 다른 테스트 관리 문제이므로, 임의 SQL UPDATE로 해결하지 않는다. 원복 방법을 승인된 테스트 계획에서 확정해야 한다.

## 9. 구현·검증 계획 (승인 후)

1. 새 articles page + compact list, 기존 reading에서 전체 목록 제거, 기존 deep link 보존, navigation 연결.
2. 단일 기사 기존 tabs/AI/Design 컴포넌트 유지. 순서만 목록에서 관리; 공공정보·CTA와 고급 디자인은 기존 disclosure 재사용.
3. 승인된 atomic order 경로에 drag/위아래 및 ‘순서 저장’ 연결. stale/실패/저장 중 상태, keyboard/screen-reader 안내 제공.
4. 로컬 SQL fixture: 다른 프로젝트/중복·누락 ID/권한/stale/동시 reorder·save·insert·delete/중간 실패 rollback/no-op/기존 block·link row ID/asset/Canva reference 보존 검증.
5. UI: 목록→신규→저장된 기사 수정→목록 복귀, 잘못된 ID, 미리보기, 저장 실패, pending unsaved 상태, 같은 입력 저장 회귀 확인.
6. 공개/preview: 정기 기사 기본 순서 일치, 긴급·수시/관심사 기존 우선 노출 유지. 기존 AI 이미지/Canva/Design 계약과 gate 보존.
7. 1440/768 overflow/console, 상단·하단 action, 좁은 화면 버튼과 keyboard 이동 검증.
8. 전체 관련/전체 테스트, TypeScript/lint/Webpack build/diff check. Staging read/write는 별도 승인 범위 안에서만 실행.
9. 함수 migration 포함 구현에 대한 승인 이후 commit/push/PR 여부와 DB rollout을 분리한다. PR merge 및 Production migration/write는 하지 않는다.

## 10. 승인 후 구현 결과

- 독립 목록: `P/articles`. 순번/제목/유형/상태/수정일/프로젝트 발행·기간 기반 공개 대상/저장된 디자인 상태를 compact row로 표시한다. 블록/링크 수는 `구성 정보`에서 펼친다. 전문·private metadata는 목록 client DTO에 넣지 않는다.
- 기존 `P/reading`의 전체 기사 sidebar와 원본자료 상태 카드를 제거했다. AI/Design/Canva 컴포넌트와 content/composition/review deep link는 유지한다. 잘못된 ID와 조회 실패를 신규 기사로 바꾸지 않는다.
- 전체 기사 수 카드를 제거하고 저장본 블록/링크 수를 한 줄로 요약했다. preview는 `저장본 미리보기`로 명시한다. 기존 즉시 preview/세부 디자인은 그대로다.
- 숫자 순서 입력을 제거했다. 기존 API 호환용 hidden 값은 유지하지만, migration 적용 후 save RPC는 DB 순서를 보존한다. 하단 저장 action은 sticky bar로 제공하며 목록 복귀와 저장을 구분한다.
- 모바일 기사 dashboard/작업 큐 진입과 프로젝트 하위 메뉴를 articles로 연결한다. e-book은 pages, 참여 전용은 survey로 구분한다. 기사 작업 중 프로젝트 운영 현황은 접힌 상태로 유지한다.
- 순서 UI: native drag/drop + 위/아래 버튼, 명시적 `순서 저장`, 취소, 저장 중 lock, 상태 안내. 자동 write 없음. conflict/timeout 후 fresh snapshot 조회 전까지 추가 write를 막는다.
- API: `/api/project-content/order` GET snapshot / POST 순서 저장. 기존 project access/unlock + same-origin 재사용. service_role은 서버에서만 사용한다. 공개 reader renderer는 변경하지 않았다.
- migration: 함수 정의 2개와 execute 권한만 포함한다. 새 reorder RPC1개, 기존 save RPC의 order 취급만 보정한다. table/column/index/policy 변경0.
- **Staging/Production migration 미적용, 원격 DB/Storage write0, 외부 생성 호출0.** migration 없는 배포에서는 목록/편집/미리보기는 가능하고, 순서 저장은 ‘DB 함수 적용 필요’ 안내와 함께 비활성화된다.
- 별도 승인/미완료: Staging 함수 적용, 실제 Staging 다중 기사 순서 변경·원복, 실제 다중 DB 연결 경쟁/잠금 관찰. 로컬 PGlite는 실제 SQL의 CAS·rollback 검증이며 운영 PostgreSQL 다중 연결 검증을 대신하지 않는다.

## 11. 감사 단계 baseline 검증

- 기존 전체 테스트 **322/322**, skip0. 로컬 격리 SQL runtime을 사용했고 원격 DB에는 write하지 않았다.
- TypeScript/lint/diff check 통과. 신규 warning0, 기존 lint warning3개(발행 화면 img2개/상태확인 컴포넌트 unused1개) 유지.
- Webpack build 통과. 이 검증은 변경 전 baseline이며 아직 미구현인 목록 분리/순서 저장의 동작 검증이 아니다.
- 이 baseline 시점의 변경은 감사 문서1개뿐이었다. 이후 구현과 검증은 다음 절에 기록한다.

## 12. 구현 후 검증

- 신규 관련 테스트16개: API/access/origin/CAS, 실제 SQL, 목록 UI/hook, server page/deep-link/오류 fallback, 기존 공개 기본 순서 계약.
- SQL: 기존 순서0 중복 →10단위 정규화, exact project ID set, 중복/누락/타 project 거부, stale 거부, rollback trigger, no-op, 신규 기사 append, stale 편집 순서 보존, 추가·삭제 후 CAS, 같은 snapshot 요청의 한 번만 성공, service_role execute. 순서 저장 후 기존 article source/paragraph/link ID와 값 보존.
- 로컬 브라우저: 실제 `ProjectArticleList`/`ArticleWorkspaceTabs`/`ProjectArticleEditorForm`을 기존 CSS로 bundle하고 로컬 PGlite RPC에 연결한 격리 fixture 사용. shell 골격과 디자인 탭 본문은 QA fixture이며 실제 Next 인증/공개 renderer live E2E로 간주하지 않는다. 기사 저장 응답은 local mock이며 원격 저장하지 않는다.
- 1440/768: 목록, 저장 기사 편집, 신규 작성, 목록 복귀, 위/아래 → 명시 저장 → reload 유지, preview iframe, 저장 버튼 성공 navigation, 신규 기사 디자인 탭 비활성 확인. document overflow0, console error0.
- 드래그 이벤트는 hook regression에서 동일 pending order와 write0을 확인했다. 브라우저 native drag 자동화에서는 이동을 재현하지 못했고 실제 브라우저 순서 mutation은 위/아래 버튼으로 확인했다. 수동 mouse/touch drag QA는 후속 검증에 남긴다.
- 로컬 preview fixture에서 저장된 ID 순서가 전달됨을 확인했다. 실제 public/기관검토 renderer는 변경하지 않았으며 기존 계약 테스트로 회귀를 확인한다. Staging 순서의 public/review 반영 검증은 migration 승인 후 남아 있다.
- 전체 테스트338/338 (skip0), TypeScript/lint/Webpack build/diff check 통과. 신규 warning0, 기존 lint warning3개 유지.
- stash 원본2개: `a330dcb89d1a043b6c7430ac711b48242176fc1b`, `66e70a2e33a3f594b71716359470d69774e761b7`.
- PR은 OPEN 유지한다. DB 적용과 merge는 이번 승인 범위에 포함되지 않는다.
