# 작성자 시연용 발행 v1

기준 main `fcc1264377b243a384fdde5aebab2c14969c7df8`. PR #226/#227과 분리한 긴급 기능. 2026-10-15 (Asia/Seoul).

## 목적과 기존 차단 원인

Production 무안군 `muan-26-09`는 읽기 전용 조사 당시 제작 중/미발행/기관 검토 요청 전이었다. 최종 발행은 최신 기관 승인 + project in_review/published 조건으로 차단된다. 자동 체크리스트의 부족 항목은 해당 버튼을 직접 차단하지 않는다.

기존 관리자 preview는 작업자 로그인 기기에서 시연 가능하지만 외부 담당자 자기 기기에 공유할 수 없다. 기관 검토 링크는 승인/수정 요청 액션과 프로젝트 상태 전환을 동반하므로 판매 시연 토큰으로 재사용하지 않는다.

## UI와 열람 흐름

- 기존 `/projects/[slug]/publish`에서 **시연용 발행** → 기사 개별 선택(기본 선택 0) → 원문·이미지 외부 공유 확인 → 1/3/7일 → 시연 링크 발급 → 복사/모바일 공유.
- 기존 프로젝트 담당 작업자/관리자 권한과 프로젝트 잠금 검증 재사용. same-origin mutation만 허용.
- 선택 기사 목록의 snapshot을 prepare 시 확인하고 create 직전에 다시 검사한다. 자동 발급/자동 재시도/정식 발행 호출 없음. double click 동기 lock, 성공 링크가 있는 동안 발급 버튼 잠금.
- 원본 링크는 서버 DB에는 SHA-256 hash만 저장. 클라이언트 ref에서 5분만 유지하며 React state/DOM/localStorage에 원문 토큰을 저장하지 않는다. 새로고침 후 토큰 복구 불가. 발급 목록에서는 회수 가능.
- `/demo/{token}`은 별도 토큰 저장소를 서버 검증하고 demo 전용 HttpOnly/Secure/SameSite=Strict cookie를 설정, 토큰 없는 `/demo?project=…`로 redirect.
- 표시: **시연용 · 정식 발행 전**. 기관 승인·수정 요청·편집·발행 버튼 없음. analytics 비활성, noindex/nofollow 및 no-referrer.
- 회수 후 새 page/file/audio/session 요청 차단. 이미 열린 화면은 15초 주기/포커스 복귀/만료 시 확인 후 숨김. 이미 전달/다운로드된 bytes나 스크린샷을 회수할 수는 없다.

## 범위와 자료 보안

- 한 소식지의 명시 선택 기사만 공유, 최대 100개. 일반 draft 기사도 사용자 확인 후 시연할 수 있으므로 내용을 먼저 확인해야 한다. 기존 rolling 기사의 발행/유효기간 제한 유지.
- 원문 title/summary/body/publicInfo·block/link ID와 값 등을 source digest에 포함. 변경 시 링크를 차단하고 재발급을 요구한다. 일반 기사 저장이 block/link ID를 재생성한 경우도 stale 처리. 자산 자체를 복제/삭제하거나 자동 승인하지 않는다.
- 원문 digest 검사한 article snapshot을 reader mapper에 직접 넘겨 두 번째 원문 조회의 변경값을 그대로 노출하지 않는다. Composition 표현/자산 승인 상태는 기존 현재 서버 검증을 따르므로 이 기능은 전체 파일/디자인 버전의 영구 snapshot 배포가 아니다.
- 프로젝트 전체 표지/e-book 페이지/공통 음성/다른 기사/설문을 자동 포함하지 않는다. 선택 기사 HTML·이미지·CTA·기사 음성은 공통 reader/기존 helper 재사용.
- 파일 요청마다 demo 세션 + 선택 기사/참조 파일 allowlist + project ownership 재검증. 섞인 hero/article 참조를 거부한다. AI/Canva 파일은 기존 approved/active/provenance 검증 helper를 false(includeDraft)로 호출하며 private design Storage path는 HTML에 노출하지 않는다.
- 일반 image/audio도 기존 프로젝트 소유 row가 있어야 한다. SVG는 기존 sandbox CSP 유지. 파일 캐시 private/no-store, normal image 원본 전달 및 기존 lightbox 유지. demo managed PNG는 기존 이미지 최적화 allowlist 밖이면 PNG fallback이며 성능 최적화는 이번 범위 아님.
- 기관 검토 cookie/token과 demo cookie/token은 분리. demo 발급/회수는 검토 승인/최종 발행 RPC를 호출하지 않는다. 정식 public reader의 공개 조건도 변경하지 않는다.
- bearer 링크이므로 받은 사람이 재전달할 수 있다. 시연 대상 자료의 선택과 전달 대상 확인은 작업자의 명시적 책임이다. 자동 이메일 발송 없음.

## 데이터와 rollout 승인 경계

`supabase/schema_v1_39_author_demo_shares.sql` 정의만 추가한다. **Staging/Production 모두 미적용**.

- 새 table `newsletter_project_demo_shares` 1개: project FK, token hash, article ID allowlist, source digest, creator, expiry, revoked timestamp.
- 새 보조 index 1개 + PK/unique 제약에 따른 index, RLS/service_role-only 정책/권한. anon/authenticated 직접 접근 금지.
- 기존 table/column/index/policy/함수 변경 없음. project/article/block/link/review/Storage 데이터 mutation 없음.
- 미래 링크 발급은 새 demo row INSERT, 회수는 해당 project demo row PATCH뿐이다. project status/published_at은 쓰지 않는다.
- 기존 검수 link infra의 난수/hash 패턴, 서버 권한 helper, reader/file serving helper를 재사용하되 독립 storage/세션으로 승인 자격을 분리한다.
- 기존 client-review mapper는 선택 source/route를 받는 선택적 옵션만 추가하며 default 경로는 그대로다. full-layout 판별 URL allowlist에 권한 보호된 demo file route 하나만 추가했다. `ArticleCard` 자체와 public visibility/승인 RPC는 수정하지 않았다.

배포 순서(별도 승인 필요): PR 검토 → **Staging v1.39 적용 승인** → fixed Staging에 이 PR 배포 → 별도 fixture로 작성자 발급/외부 열람/회수 E2E → **Production migration/배포/무안군 링크 발급의 명시 승인**. 이번 작업에서 이 순서를 실행하지 않았다. migration이 없는 Preview/Production에서는 관리 UI가 안내와 disabled 상태로 실패하며 정식 발행은 그대로 유지된다.

## 검증과 한계

- 신규 서버/UI/격리 SQL 회귀 20개: 선택/ownership/stale/acknowledgment/expiry, 토큰 hash/cookie 격리, 발급·회수의 write 범위, unauth/cross-origin, 선택 기사 파일 제한·mixed ID 차단, 기존 approved file helper 위임, reader 재사용/noindex, double click/성공 후 상태, client-review default 회귀, 같은 프로젝트의 다른 링크 cookie 전환 시 기존 화면 차단.
- 로컬 mock 브라우저에서 390/768/1440: 선택·확인 전 비활성, 명시 발급, 복사/모바일 공유 버튼, 발급 내역·회수 표시. 가로 overflow 0, console error 0. POST는 prepare 1 + create 1 + revoke 1(모두 mock)로 서버 로그 확인.
- 임시 mock page/API는 최종 diff에서 제거. 실 모바일 OS 공유 sheet 수신/외부 기기, DB에 저장되는 실제 링크, 실제 만료·회수 네트워크 E2E는 migration 승인 후 Staging에서 검증해야 한다. 로컬 테스트 통과를 Production 무안군 공유 완료로 보고하지 않는다.
- 최종 전체 테스트 **382/382, fail 0 / skip 0**, TypeScript/lint/Webpack build/diff check 통과. lint 오류 0, 기존 warning 3건 외 신규 warning 0. Preview 상태는 PR 본문에 기록한다.
- PR #226 head 및 stash 원본 두 개를 보존한다. 이번 PR OPEN 유지, merge/Production 배포/원격 DB·Storage write/외부 생성 호출 없음.
