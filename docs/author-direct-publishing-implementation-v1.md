# 작성자 직접 발행 구현 v1

2026-10-19 (Asia/Seoul), main `9fdd73ff13dd1d17cbf9b7fa6bb7b56c33e74b5b` 기준.
설계: PR #229 `docs/author-direct-publishing-v1.md` (별도 OPEN 유지).

## 구현과 경계

공식 발행 화면의 기본 선택은 작성자 직접 발행이다. 먼저 **공개 대상 확인**으로 저장본의 기사 수/제외 수/e-book/주의사항/최근 이력을 읽고, 공개 자료 최종 확인 체크 뒤 명시적으로 발행한다. 기관 검수 후 발행은 같은 공식 결과 영역의 방식 선택으로 제공하고, 기존 검토 요청/응답과 시연 발행은 접어 두었다. 시연은 별도 토큰/기한/회수 흐름 그대로다.

`/api/project-publish` POST는 prepare/publish/unpublish를 제공한다. same-origin 검사와 `requireProjectApiAccess`의 admin/담당 user/unlock 계약을 재사용한다. actor는 서버 세션에서만 공급한다. mode 미지정 구버전 요청은 승인-only 경로를 유지하며, 이 경우에도 실제 호출자 및 assignee snapshot을 신규 RPC에 넘긴다. 새 직접 발행으로 자동 fallback하지 않는다.

신규 `project-publication.ts`는 Supabase 기존 서버 transport 설정을 사용한다. client가 service-role key나 원문 digest의 입력 데이터를 받지 않는다. 결과 이력에는 actor ID/방식/action/상태/시간만 표시한다. 응답 유실 시 자동 재시도는 없고 **같은 요청 결과 확인**을 누른다. request key/action/mode/revision은 project 단위 sessionStorage에 보관해 새로고침 후 같은 요청을 복구한다. 토큰·기사 원문을 저장하지 않는다. 서버가 다시 권한을 검사하므로 다른 계정으로 바뀐 세션은 타인 receipt를 사용할 수 없다.

## Migration 영향 (원격 미적용)

`supabase/schema_v1_40_author_direct_publishing.sql`:

- 새 `newsletter_project_publication_events` table 1개, PK와 project/time index, RLS/service_role select·insert. 앱의 event update/delete 금지.
- 신규 함수 2개: `project_publication_state(uuid)`, `transition_project_publication_atomic(uuid,text,text,text,text,uuid,text,text,text,boolean,text)`.
- 기존 함수 4개 교체: 승인-only publish 1개, review request 1개, review response의 2/3인자 overload 2개. 기존 feedback/timestamp/expiry/승인 자격을 유지한다.
- 기존 table column/index/policy 변경 없음. 기존 기사/block/link/자산/Storage 데이터 migration mutation 없음. 선행 v1.29/v1.30 review/feedback 계약을 검사하고 없으면 transaction 전체 실패.
- migration 적용 자체는 프로젝트를 발행하거나 event를 삽입하지 않는다. PostgREST schema reload notify 포함.

transition은 service_role·입력·현재 assignee·담당 사용자·source revision을 검증한다. request key advisory lock 뒤 project row lock을 잡는다. 상태/발행시각과 event INSERT는 한 transaction이다. 같은 key/같은 입력은 이전 receipt를 재사용한다. 다른 actor/project/hash는 conflict. receipt에는 이전 요청의 결과와 **현재 project 상태**를 구분해 반환하므로, 이후 비공개로 바뀐 프로젝트를 예전 receipt로 다시 공개하지 않는다.

직접 발행은 draft/private/in_review에서 가능하며 기존 review row를 고치지 않는다. published에서 새 key로 명시적 재발행 가능. 취소는 published→private이고 published_at/기사/파일/자산 보존. archived/deleted는 차단한다. 일반 status 경로는 공개 중 project를 비공개로 낮출 수 없다.

## 기존 경로 충돌 보완

- 기존 review 응답은 이미 published인 project에서 응답/feedback만 기록하고 published를 유지한다. 미발행 project의 in_review/draft 전환은 종전대로다. 새 검토 요청은 published에서 차단하고 먼저 명시적 비공개 전환을 안내한다.
- legacy `/api/projects` published 요청은 여전히 기관 승인 검사. 기타 `updateStatus`는 request key/revision/최종 확인이 있는 atomic 경로만 허용하며, 현재 사용처 없는 예전 상태 버튼의 무조건 PATCH는 차단된다.
- 기본정보 저장은 status를 쓰지 않는다. 폼에서 서버와 다른 status를 제출하면 발행 화면으로 안내한다. 오래된 설정 저장이 발행 상태를 되돌리는 경합을 막는다.
- 보관/삭제 API는 published project를 거절한다. repository의 soft-delete PATCH에도 status!=published 조건을 넣어 확인 직후 발행된 project를 뒤늦게 보관하지 않는다. 일반 비발행 보관의 기존 동작은 유지한다.

## 공개 범위와 snapshot

공통 reader와 file mapper는 변경하지 않았다. regular draft 기사도 공식 공개 대상이다. rolling은 published/유효기간 조건을 따른다. e-book 전용은 기존 page image/외부 e-book 준비 여부를 점검한다. 미승인/비활성/미지원 디자인에 대해서는 기존 public filter를 유지하고 저장본 검토를 안내한다. 발행이 자산을 자동 승인하지 않는다.

revision은 project 및 기존 article/block/link/pages/assets/Composition 등 공개 표현 관련 row의 정렬된 digest다. 원문을 event에 복제하지 않는다. review/demo/event/analytics 이력은 source digest에서 제외한다. project lock은 v1.38 기사 저장/순서와 공유하지만 **모든 asset 관리 경로까지 불변 version 배포로 만드는 것은 아니다**. 발행 후 저장본을 읽는 기존 live reader 계약이므로, 이미지·기사 수정은 공개에 반영될 수 있다. 이미 내려받은 bytes를 발행 취소로 회수할 수는 없다.

## 검증 / 남은 승인

- 신규 격리 SQL/server/UI 회귀: 승인 없는 직접 발행, 현재 사용자/다른 프로젝트/assignee 보호, stale, 동일 요청·응답 유실·동시 요청 재사용, 명시 재발행, 취소, event INSERT 실패 transaction rollback, published review 응답 유지, 기관 승인 legacy/양 overload, 익명 public file 차단, source row identity 보존.
- 기존 시연/기관검수/AI/Canva 포함 전체 회귀 **414/414 (신규 29개, skip 0)**, TypeScript/lint/Webpack build/diff check 통과. lint는 기존 warning 3개만 있고 신규 warning 0.
- 브라우저 QA는 원격 연결이 없는 **로컬 mock API**와 실제 신규 React controls를 사용했다. 390/768/1440 CSS px 실측 overflow 없음, console error 없음. 확인 전 비활성, 명시 동작/결과, 비공개 전환, 기관 승인 미완료 gate 확인. 의도적인 응답 유실 mock에서도 같은 key의 HTTP 확인 2회에 event 1개만 존재하며 결과를 재사용했다. URL 복사/QR 다운로드/e-book 동선은 기존 공통 결과 패널을 재사용한다. mock은 실제 공식 발행 증거가 아니다.
- 실제 Staging migration/공식 발행 E2E, 실제 public reader와 e-book/파일의 통합 확인은 **미수행**. 승인된 disposable Staging project로 migration 적용 → snapshot 기록 → 발행/중복/취소/검토 응답/복구 E2E가 필요하다.
- Production migration/데이터/Storage/무안군 발행 및 외부 GPT/Canva/Adobe 생성 호출 없음. PR #226/#229와 기존 stash 원본 두 개 보존. 이 구현 PR은 OPEN 유지하며 merge하지 않는다.

## Staging v1.40 보정: 업무 충돌 HTTP 409

실제 Staging에서 `publication_stale`에 사용한 SQLSTATE `40001` 때문에 PostgREST가 업무상 충돌을 직렬화 실패로 재시도하여 timeout을 유발했다. 다음 다섯 명시적 업무 예외만 `PT409`로 바꾼다: `publication_assignee_conflict`, `publication_key_conflict`, `publication_stale`, `publication_not_published`, `publication_status_conflict`. 실제 PostgreSQL 직렬화 실패/교착상태 코드는 바꾸지 않는다. 서버/UI의 uncertain 처리 및 동일 request key 복구 계약은 유지한다.

설치 경로:

- **신규 환경**: 수정된 `schema_v1_40_author_direct_publishing.sql`을 선행 v1.29/v1.30 이후 한 번 적용한다.
- **이미 v1.40 적용된 환경**: 전체 migration을 재실행하지 않는다. `patch_v1_40_publication_conflict_http409.sql`만 적용한다. 이 파일은 기존 단일 transition 함수의 다섯 정확한 raise 구문을 검사하고 `CREATE OR REPLACE`로 교체한다. 이미 보정되었으면 no-op, 함수 누락/예상 밖 정의면 transaction을 중단한다. signature/owner/execute ACL, table/column/index/policy와 데이터는 변경하지 않는다.
- 적용 전후 `pg_get_functiondef`, signature/ACL, schema/data/Storage digest를 비교하고 PostgREST의 실제 HTTP 409/code/message를 확인한다. patch는 schema reload notify만 추가한다.
- 이번 원격 보정은 **Staging `mvrkpmffuhcqwisqvpqi`만 승인**되었다. Production migration/rollout과 PR 병합은 별도 승인 대상이다.

보정 검증 (2026-10-19): Staging의 잔여 transition 실행 세션 0건을 확인했다. patch 전후에는 transition 함수 정의 1개만 변경되었고 signature/ACL과 36개 데이터·Storage 집계 digest는 동일했다. 새 격리 프로젝트의 실제 Supabase REST에서 다섯 오류 모두 HTTP 409 / PT409 / 정확한 오류명으로 반환되었다(18~41ms, stale 24ms). 충돌 호출은 이력을 추가하지 않았고 정상 발행→동일 key duplicate→취소 및 다른 담당자/프로젝트 403도 확인했다. 보정 포함 전체 416/416, 전용 31/31, TypeScript/lint/Webpack build/diff check 통과(기존 lint warning 3개, 신규 0). 실제 관리자 UI/공개 reader의 추가 결과와 fixture 정리 증거는 PR 검증 기록에 구분해서 남긴다.
