# 모바일 미리보기 및 발행호 운영 체계 조사 v1

기준 main `437767c1c3c64a99951719c55fe25ca00a07f550`, 2026-10-19. 제목 간소화 구현 PR과 독립된 문서 전용 변경이다. 코드·API·schema·공개 범위 변경, DB/Storage write, 새 음성/이미지 생성은 수행하지 않는다. 기존 PR #226/#229를 수정하지 않는다.

## 결론 및 A/B/C 분류

A=현재 구현되어 사용할 수 있음, B=기존 권한·데이터 계약 안의 UI 보완, C=새 서버/API/DB 설계 필요. C라고 반드시 migration이 확정된 것은 아니다.

| 요구 | 분류 | 현재 상태와 다음 최소 범위 |
|---|---|---|
| 공개 발행 기사의 AI TTS·업로드 음성 | A | ArticleCard→PublicArticleAudioPlayer 경로, AI는 manifest/segment, 업로드는 file proxy. 음성 생성/정합성/파일 존재가 전제 |
| 미발행 프로젝트의 관리자 AI TTS 미리보기 | C | 기사 HTML 권한과 AI manifest 권한이 분리됨. preview 권한 전용 manifest/segment 매핑 필요. public gate 완화 금지 |
| 즉시 미리보기 단일 기사 전환 시 음성 중단 | A/B | key 재마운트/cleanup은 존재. iframe/모달/부모 동시 재생의 정지는 추가 UI 검증 및 메시지 정책 필요 |
| 독립 관리자 reader의 기사별 수정 링크 | A | admin preview 승인 후 ArticleCard의 article.id로 편집 이동, 일반 공개에는 미노출 |
| iframe/모달에서 현재 기사 편집 이동 | B | 부모가 보유한 articleId로 복귀는 가능. reader 내부 탐색 후 현재 기사 ID 동기화는 명시적 UI/메시지 계약 필요 |
| 공개 프로젝트에서 특정 기사 deep link | A | `/newsletters/{slug}?articleId={id}`는 최초 기사 선택. 한 기사만 공개하는 권한 scope가 아님 |
| 선택 기사 시연 공유 | A | 토큰/세션·선택 집합·1일 만료·회수·revision 검증, 공식 발행이 아님 |
| 미발행 프로젝트의 단일 기사 공식 발행 | C | 프로젝트 published 전제가 reader/파일/음성에 분산. article 공개 범위/이력/회수/충돌을 원자적으로 다루는 설계 선행 |
| 기관별 여러 발행호 프로젝트 등록 | A | 프로젝트마다 organization_name/issue_label/published_date/slug. 기관 키/계약 개체와 동일하지 않음 |
| 관리자 연도별 발행호 필터 | B | 기존 프로젝트 목록과 날짜 재사용. 표시 연도와 날짜 누락 정책 필요 |
| 독자 지난호 탐색 | C(최소 서버 조회)/B(UI) | 공개 프로젝트만 반환하는 제한적 조회·기관 그룹 검증과 UI 필요. 새로운 테이블은 초기에는 피할 수 있음 |
| 불변 발행본/기관 단위 계약·발행계획 | C | 기존 editable project 및 이벤트는 불변 콘텐츠 snapshot/기관 계약 모델을 대체하지 않음 |

## 1. 모바일 미리보기 TTS

근거 파일:
- `src/components/design/composition-mobile-preview.tsx`
- `src/components/public-mobile-article-reader.tsx`의 ArticleCard/stopCurrentArticleAudio
- `src/components/public-article-audio-player.tsx`
- `src/components/public-audio-text-sync-player.tsx`
- `src/components/admin-mobile-preview-frame.tsx`, `src/components/article-mobile-preview-modal.tsx`
- `src/lib/newsletter-repository.ts`의 mapAudioRowToProjectArticleAudioFile
- `src/lib/article-tts-audio.ts`의 getPublicArticleAudioManifest/downloadPublicArticleAudioSegment
- `src/app/api/public/newsletters/[slug]/articles/[articleId]/audio/route.ts` 및 `[segmentIndex]/route.ts`
- `src/lib/client-review-render.ts`, `src/app/api/client-review/audio/route.ts`

### 실제 호출 차이

즉시 미리보기는 공통 ArticleCard를 재사용하고 analyticsDisabled=true, showAdminPreviewControls=false다. 로컬 Composition/HTML textDesign을 전달하지만 음성은 저장 article DTO의 audioFile을 사용한다. 로컬 배치/텍스트 초안을 즉시 재낭독하거나 새 TTS를 만들지 않는다. context.slug가 비면 기본 manifest URL도 유효하지 않으므로 caller에서 slug를 반드시 전달해야 한다.

저장본 iframe/모달은 `/newsletters/{slug}?preview=admin&articleId=…&embedded=adminPreview`의 공통 reader다. HTML과 디자인 조회는 requireProjectAdminPreviewAccess를 통과하면 미발행도 볼 수 있다. iframe에는 sandbox/allow로 음성을 명시 차단하는 설정이 없다. 자동 재생을 보장하는 것은 아니며 모바일 브라우저의 사용자 제스처 정책은 별개다.

AI TTS는 audioFile.manifestHref가 있으면 이를, 없으면 **공개** `/api/public/newsletters/{slug}/articles/{id}/audio`를 사용한다. 해당 route는 관리자 preview flag를 전달하지 않는다. getPublicArticleAudioManifest는 reviewProjectId가 없는 기본 호출에서 프로젝트 published를 요구한다. 따라서 관리자 HTML은 열리는데 음성 manifest는404가 되는 경로가 존재한다. `preview=admin` 쿼리만으로 공개 음성 권한을 바꾸지 않는다.

업로드 음성은 repository DTO가 `makePublicStoragePreviewHref("audio-files",…)`를 생성하지만, 일반 public-files 경로는 private 프로젝트에서 requireProjectApiAccess로 관리자/담당자 인증 fallback을 수행한다. 따라서 정상 세션에서는 기존 파일 proxy를 재사용할 수 있으며 AI manifest의 published-only 문제와 동일하게 단정하면 안 된다. 세션 만료/프로젝트 잠금/잘못된 파일 참조는 별도 실패 원인이다. AI가 이미 생성돼 있어도 텍스트 hash/voice/paths가 최신과 일치하지 않으면 hasAudio=false/stale이며 이는 preview 권한 결함과 구분해야 한다. 파일 부재·네트워크 오류·생성 안 됨·권한 거절을 구분해 진단해야 한다.

기관 검수/시연 renderer는 권한을 검증한 후 전용 audio URL을 DTO에 부여하는 선례가 있다. 재사용할 것은 mapper/service 경계와 article ownership 검증이며, review 토큰을 관리자에게 가짜로 발급하거나 public route에 무검증 project ID를 전달하는 방식은 금지한다.

### 컨트롤·전환

PublicArticleAudioPlayer는 사용자 재생/정지, 속도 변경(playbackRate와 localStorage), AI 분할 segment를 지원한다. `datadiction:stop-article-audio` 수신 시 pause/currentTime0, unmount 시 src 제거/load를 수행한다. 공통 reader는 기사·표지·탐색 전환에서 stop을 dispatch한다. 즉시 preview는 key=article.id로 기사 변경 시 cleanup된다. iframe은 별도 window이므로 부모 event가 자동 전달되지 않는다. 모달 닫기/unmount는 프레임 해제로 중단될 수 있지만 숨김만으로 프레임이 유지되는 경우는 실제 재생 QA가 필요하다. PublicAudioTextSyncPlayer는 별도 프로젝트/본문 동기화 플레이어이므로 기사별 segment player와 혼동하지 않는다.

### 최소 후속 설계

1. requireProjectApiAccess 기반 관리자 전용 preview audio GET(또는 기존 프로젝트 파일 API의 제한적 확장)에서 current project/article 소유권 검증.
2. AI manifest와 segment의 양쪽 URL을 관리자 scope로 매핑. 업로드 음성은 기존 인증 fallback 파일 mapper의 project/file ownership을 보존하고 실제 세션별 재생을 검증. private no-store 유지.
3. public/review/demo의 기존 gate와 no-store 유지. 전용 mapper를 preview 페이지 및 즉시 preview에 전달.
4. UI에 ‘미생성/변경 후 재생성 필요/접근 실패’를 분리, 자동 생성 금지.
5. 저장된 기존 AI/업로드 샘플만으로 play/stop/speed, 기사 전환, 모달 종료/iframe 새로고침, 390/768/1440, anonymous404·다른 담당자403를 검증.

이번 문서는 코드 경로 분석이다. 신규 음성 생성이나 실제 가청 재생 성공을 검증했다고 보고하지 않는다. 이 문제를 제목 PR에 섞어 수정하지 않는다.

## 2. 미리보기→기사 편집 복귀

`src/app/newsletters/[slug]/page.tsx`는 preview=admin이면 requireProjectAdminPreviewAccess(requireAppUser/canAccessProject/project unlock)를 거친다. showAdminPreviewControls는 admin && !embedded이며 공용 reader가 이를 받는다. 일반 공개 쿼리로 편집 권한을 얻을 수 없다. 편집 목적지 ProjectAdminShell/저장 API도 별도로 project access를 확인한다. 링크를 숨기는 것만이 보안 경계가 아니다.

독립 reader의 각 ArticleCard ‘수정’ 링크는 실제 article.id를 사용한다. 상단 ‘작성 화면’은 URL의 초기 articleId를 사용한다. 이후 reader에서 다른 기사를 보아도 URL/상단 href가 자동으로 현재 기사로 동기화되는 것으로 볼 수 없다. 따라서 **카드별 수정은 정확하지만 상단 초기 복귀는 stale 가능**하다.

iframe은 embedded=adminPreview로 상단/카드 관리자 버튼을 숨긴다. 프레임의 ‘큰 창으로 보기’는 원래 previewHref를 사용한다. 모달은 부모 편집 화면의 articleId를 유지하며 닫기 후 그 기사로 돌아가지만 프레임 내부 다른 기사 탐색을 부모가 자동으로 아는 것은 아니다.

최소 UI 보완: 독립 reader는 currentArticleId로 단일 복귀 링크를 계산. iframe/모달은 same-origin postMessage의 origin/source/project/article allowlist를 확인하여 현재 기사 변경만 부모에 알리고 ‘현재 기사 편집’은 부모에서 실행한다. 사용자 클릭 없이 editor로 이동하지 않는다. 단순 수정 링크 보완은 migration 불필요. 공개 reader에는 버튼과 메시지 통신을 켜지 않는다. 알 수 없는 ID를 신규 기사로 열지 않는 기존 reading page 검증 유지. 실제 권한별 E2E는 후속 구현 시 별도 수행한다.

## 3. 단일 기사 공식 발행

현재 공식 발행은 `src/lib/project-publication.ts` 및 v1.40의 project_publication_state/transition_project_publication_atomic가 프로젝트 단위로 revision/requestKey/권한/이력을 다룬다. 시연은 `src/lib/demo-share.ts`의 선택 기사·digest·만료·회수 모델이며 검색 비노출·임시 권한을 부여한다. 시연 URL을 공식 URL이라고 이름만 바꾸면 안 된다.

공식 reader는 project published를 먼저 요구한다. 일반 regular 기사는 article.status가 draft여도 프로젝트 공개 시 기존 정책상 표시될 수 있다. rolling은 published + valid_from/valid_until 조건이며 urgency/priority/interests의 정렬이 적용된다(`src/lib/article-publication.ts`). article status를 published로 바꾸는 것만으로 private 프로젝트를 익명 공개할 수 없다. articleId deep link는 접근권한/선택 집합 제한이 아니라 초기 위치 선택이다.

### 최소 안전 설계(이번 미구현)

- 공식 공개 단위(project issue/article)를 서버 모델로 구분. 프로젝트 비공개여도 승인된 article release만 공개할 수 있는 record/revision 및 idempotent publish/revoke transaction이 필요하다. 컬럼/테이블/RPC 선택은 현재 publication event와의 관계를 검토한 뒤 별도 승인한다.
- URL은 `/newsletters/{slug}/articles/{articleId}` 같은 명시적 scope를 우선 검토. 기존 `?articleId`와 역할을 구분하고 제목/목차/검색/이전다음에서 미선택 기사·프로젝트 표지/PDF/음성이 유출되지 않도록 한다.
- 파일/AI hero/full-layout/Composition/음성 manifest·segment 모두 현재 release와 asset approval/active/provenance를 재검증한다. no-store/회수 정책을 공통으로 유지한다. 프로젝트 published gate를 전역 완화하지 않는다.
- 수정 후 재발행 필요 여부, snapshot 또는 live revision 정책, project 전체 publish와 single article revoke의 우선순위, rolling 만료를 먼저 정의한다.
- analytics는 기존 project/article ID를 유지하되 진입 context/release를 구분할지 설계한다. publication event에 article scope/action/revision이 필요하며 기존 project count와 이중 집계를 막는다.
- 테스트: private project의 승인된 단일 article만200, 다른 article/asset/audio/PDF404, revoke 즉시404, 동일 key 재사용, stale409, project full publish/unpublish와의 경합 및 review/demo 회귀.

일반 draft를 일괄 비공개로 바꾸는 정책 변경은 이 기능과 별개다. 해당 정책을 부수 효과로 변경하지 않는다.

## 4. 연간 발행호 및 지난호

근거: `supabase/schema_v0_5.sql`의 newsletter_projects 및 `src/lib/newsletter-repository.ts`, 홈/프로젝트 관리, 공개 newsletter/ebook page. organization_name(문자열), issue_label, published_date(date), 고유 slug가 있어 한 기관의 여러 발행호를 별도 project로 운영할 수 있다. published_at 등 발행 이벤트 시점과 담당자가 입력한 호 발행일은 동일 개념이 아니다. issue_label 자유문자열에서 연도를 정규식만으로 확정하지 않는다.

현재 독자용 기관별 지난호 목록/연도 탐색과 기관 ID/계약/연간 계획의 정규화된 모델은 확인하지 못했다. newsletter-data의 archiveHref 등 예시 문자열을 실제 권한 있는 archive 구현이라고 보지 않는다. 기존 프로젝트 카드 목록은 관리자 권한 아래 모든 작업 상태를 다루므로 익명 archive API로 그대로 노출하지 않는다.

### 기존 데이터 변경 없는 최소 단계

1. 관리자: 기존 목록을 organization_name·published_date로 그룹/연도 필터. 날짜 없는 호는 ‘연도 미지정’. 기관명 표기 차이/동명이 기관의 수동 분류 필요성을 안내. 이 단계는 UI 중심이며 기존 프로젝트를 수정하지 않는다.
2. 독자: 명시적으로 선택한 기관 그룹의 **published 프로젝트만**, slug/title/issue/date/승인 표지만 반환하는 서버 allowlist query를 추가. 날짜 내림차순+고정 ID tie-break, pagination, empty state, unpublish 반영. 임의 organization_name query로 전 기관 비공개 목록을 열지 않는다. 기존 renderer URL로 이동하므로 reader 복제 불필요. 첫 MVP는 read-only 서버 조회+UI로 migration 없이 가능하지만 기관 그룹의 안정 식별/노출 허용 기준을 승인받아야 한다.
3. 장기: institution/contract/issue relation, 기관명 변경/통합/중복·계약별 담당권한·연간 발행계획이 실제 요구될 때 정규화. 현재 문자열을 임의 기관 ID로 간주하지 않는다.

### 보존 정책

published project도 현행 앱에서는 편집 가능한 live 데이터다. 발행 이벤트가 존재한다는 사실이 원문/블록/이미지의 불변 발행본 보관을 보장하지 않는다. archived는 독자 ‘지난호’와 다르며 접근을 막는 삭제/보관 상태일 수 있다. 과거 호를 archive 상태로 자동 전환하거나 파일을 삭제하지 않는다. 기간별 보존/복구·immutable snapshot·공개 철회와 기록 보존을 운영정책으로 결정한 뒤 별도 저장 구조를 설계한다.

## 우선순위와 검증 경계

1. 관리자 preview audio 권한 mapper 설계/구현(기존 서비스 재사용, public gate 유지).
2. 현재 기사 편집 복귀 UI/iframe same-origin 메시지.
3. 관리자 발행호 필터→read-only 독자 지난호 탐색.
4. 단일 기사 공식 발행은 권한·회수·이력·파일 scope 설계를 먼저 승인.

이 PR은 A/B/C 구분과 코드 조사 문서만 추가한다. 브라우저 음성 가청 QA, 실제 단일 기사 발행, 지난호 DB/E2E를 수행하지 않았다. 제목 PR의 브라우저 QA 결과를 위 신규 기능 구현/검증으로 해석하지 않는다. Production/Staging write·migration·외부 생성 API 호출 없음. 기존 PR #226/#229 및 stash2 보존, merge 금지.
