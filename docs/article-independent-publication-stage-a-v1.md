# 기사별 독립 최종 발행 — A단계 DB·RPC 계약 v1

- 기준: `1d403683d878e3a64b8cc32f8e65ea397562b558` (main)
- 조사일: 2026-10-21. 상태: 기술 설계, 구현/적용 승인 전.
- 이 PR은 문서만 포함한다. SQL, API, 기능 gate, Storage 작업, 배포를 구현하지 않는다.
- 보정: 2026-10-21 읽기 전용 실사 결과 반영. 실행 코드·SQL·권한 설정 변경 없음.
- 보안 조사: [staging-font-permissions-audit-v1.md](staging-font-permissions-audit-v1.md).
- 테스트 계약: [article-independent-publication-stage-a-tests-v1.md](article-independent-publication-stage-a-tests-v1.md).

## 1. 유지할 계약과 확인된 충돌

| 현재 코드 | 확인 결과 | A단계 결정 |
|---|---|---|
| `src/app/api/project-publish/route.ts`, `src/lib/project-publication.ts`, v1.40 SQL | 정기호 단위 revision/요청키/발행 이벤트. 저장 수정은 공개 화면에 반영 | 기존 RPC·테이블·상태 의미를 변경하지 않음 |
| `src/lib/article-publication.ts` | regular는 프로젝트 발행 시 draft도 공개 대상, rolling은 status와 유효기간 검사 | 독립 공개 여부를 기존 article.status에 덮어쓰지 않음 |
| `supabase/schema_v1_38_article_order_atomic.sql` | 저장/순서 변경은 project-first 잠금. 저장은 기존 block/link를 삭제 후 재생성 | block/link 원본 ID는 추적 정보이며 공개본 FK로 사용하지 않음 |
| v1.26 Composition 자산 FK | NO ACTION DEFERRABLE INITIALLY DEFERRED | 단순 RESTRICT와 구분, 현재 commit 시점 무결성 유지 |
| v1.36/v1.37 AI/Canva 적용 | article-first 및 block/link 잠금 | 새 공통 잠금이 모든 기존 writer를 직렬화한다고 가정하지 않음 |
| `src/lib/article-composition-repository.ts` | 설정·배치 별도 REST PATCH/POST/DELETE, 부모 article 잠금 계약 없음 | article.updated_at만으로 변경 감지 불가 |
| `src/lib/font-css.ts` | 패밀리 활성화·기본값·파일 URL에 따라 CSS 생성 | 해석된 상속값·실제 face 메타데이터도 스냅샷에 포함 |
| `src/lib/article-tts-audio.ts` | 공개 음성은 프로젝트 published 검사, 최신 기사/음성 참조 사용 | 독립 공개 음성은 별도 revision manifest로 읽어야 함 |
| `src/lib/newsletter-file-storage.ts` | 기존 업로드에 upsert 허용 경로 존재 | 기존 path만 저장해서 바이트 불변을 주장할 수 없음 |
| `src/lib/image-delivery-server.ts` | 권한 검사 후 해시 기반 메모리 변환 캐시 | 독립 파일도 권한 검사 후 변환 캐시 사용 |

기존 Composition JSON에 발행 스냅샷을 넣지 않는다. 기존 JSON은 presentation-only이고 기사 내용·서명 URL 등의 보관 장소가 아니다. 기존 테이블에 독립 공개 플래그만 더하는 안도 공개본 고정·이력·원자성을 충족하지 못한다.

## 2. 상태 모델과 불변 조건

독립 공개 상태는 `never_published / published / withdrawn`. revision은 승인 절차가 아닌 검수 대상으로 고정된 콘텐츠 버전이다. 준비 완료와 공개는 다른 상태다.

| 동작 | 허용 전 상태 | 공개 후 상태 | revision 규칙 |
|---|---|---|---|
| publish | never_published | published | 확인한 새 후보, 미디어 준비 완료 |
| replace | published | published | 확인한 새 후보로 포인터 원자 교체 |
| withdraw | published | withdrawn | 공개 포인터 제거, 마지막 revision·파일 보존 |
| republish | withdrawn | published | 명시 선택한 이전 공개본 또는 새 검수본 |

상태가 같은 중복 조작은 새 키로 성공 이벤트를 만들지 않는다. 같은 키 재전송만 기존 결과를 반환한다. replace의 렌더링 payload+미디어 해시가 현재 공개본과 같으면 `unchanged` no-op(이벤트/버전 증가 없음)을 반환한다. 이 no-op은 미래 API 계층에서 처리 결과를 동일하게 재현할 수 있어야 하며 성공 이벤트와 혼동하지 않는다.

정기호 발행/비공개/검수 응답과 독립 상태는 서로 갱신하지 않는다. 독립 공개 종료는 정기호·기존 시연 링크·외부 공개 사본을 회수하지 않는다. 독립 상태 withdrawn여도 정기호에서 해당 기사가 공개 중일 수 있다.

## 3. 제안 테이블 (명칭 잠정, SQL 없음)

### 3.1 newsletter_article_publications — 상태

- PK article_id, project_id, status, state_version(bigint, 초기 0), active_revision_id(nullable), last_published_revision_id(nullable).
- first_published_at, last_published_at, withdrawn_at, created_at, updated_at.
- article/project의 복합 관계를 검증. published일 때만 active_revision_id 필수, 그 외 null.
- active/last revision은 같은 article/project 소속이어야 함(복합 UNIQUE/FK).
- 최초 공개 시각은 보존, 재공개/변경 공개 시 last_published_at 갱신. 공개 종료 때 기존 공개 시각 보존.
- article.status, project.status/published_at/sort_order는 변경하지 않음.
- 삭제 정책은 3.6의 이력 유무별 계약을 따른다. 준비/상태 row가 있다는 이유만으로 기존 기사 삭제를 영구 차단하지 않는다. soft-delete/archived는 독립 접근을 차단하는 상위 안전 조건이다.

### 3.2 newsletter_article_publication_revisions — 불변 검수본

- PK id, project_id, article_id, revision_no(기사 내 UNIQUE), snapshot_schema_version, renderer_version.
- source_hash, payload_hash, immutable snapshot JSON, expected_media_manifest JSON, created_by/created_at.
- 원본 article/block/link/asset ID는 provenance로 보존한다. revision은 live 원본 child row에 FK를 걸지 않는다. 원본 article/project도 revision에서 일괄 RESTRICT하지 않고 공개 이력 anchor와 생성/실행 시 소유권 검증으로 보호한다(3.6).
- revision JSON·해시·번호 UPDATE 금지. 공개 이력 있는 revision DELETE 금지. 공개된 적 없는 만료/고아 후보만 3.6의 제한된 정리 계약으로 삭제할 수 있다. 준비 lifecycle은 아래 preparation에서 관리한다.
- JSON 객체/배열 구조, 항목 수/총 크기 제한, 안전한 링크·HTML 검증을 명시적 validator에서 수행. signed URL, 원시 secret, provider payload를 저장하지 않음.
- `source_hash`는 일관된 원본 묶음, `payload_hash`는 공개 표현 및 미디어 content hash 기준. 원본 행 ID/updated_at만 바뀐 경우도 source 충돌은 감지하되 replace no-op 판단은 payload 기준.
- canonicalization v1: 스키마별 필드 allowlist, 객체 키 정렬, 명시적 null, UTF-8, 배열은 의미 있는 순서(sort_order,id 등)로 고정, 시간 UTC, 표시 문자열 임의 정규화/요약 금지, SHA-256. DB/서버 cross-fixture 일치가 구현 진입 조건.

### 3.3 newsletter_article_publication_events — 실행 영수증

- PK request_key UUID(독립 발행 namespace), article/project, actor ID, action, request_hash. 실제 성공 발행 이벤트의 원본 article/project 단일 FK는 RESTRICT로 두어 공개 이력 anchor로 사용한다.
- previous/new status, previous/new state_version, selected/previous revision, created_at, result JSON.
- 성공 mutation당 한 행. append-only. 같은 키·다른 actor/project/article/action/revision/expected version은 충돌.
- request_hash는 서버가 정규화한 요청 전체에 대해 계산. 응답에는 당시 결과와 **현재 상태/버전**을 구분하여 반환.
- 복합 관계·버전/동작 CHECK. 이벤트 실패는 상태 변경도 rollback. 접근 거부/validation 실패는 발행 이벤트로 INSERT하지 않음.

### 3.4 newsletter_article_publication_preparations — 준비 lifecycle

- PK preparation_id, UNIQUE preparation_key UUID, request_hash, revision_id(nullable, 준비 완료 때 연결; 같은 과거 revision을 여러 준비가 참조 가능), article/project, actor_id, expected_state_version, source_hash, mode(new_draft/historical), source_capture JSON, provisional_manifest JSON, status(pending/ready/failed/abandoned/committed), expires_at, timestamps, safe error_code.
- 재개 가능한 private media 준비의 소유자·상태·진행 lease. 공개 상태가 아니며 준비만으로 공개 불가.
- historical은 실제 과거 공개 이벤트에 연결된 revision만 선택 가능. 다른 기사/프로젝트 또는 공개 이력 없는 임의 후보는 거부.
- 실제 공개 이력에 연결된 committed 후보는 정리 대상으로 돌아가지 않음. 실패 후 재시도는 준비 상태 재확인 후 명시적으로 실행.

### 3.5 newsletter_article_publication_media — 보존 객체 ledger

- PK media_id, preparation_id(nullable: 미공개 준비 삭제 후 고아 정리 기록 유지), source asset/audio/font provenance, source bucket/path/hash, destination bucket/path, sha256, byte_size, MIME, role, status(pending/verified/pinned/deleting/deleted/failed), verified_at, lease_until.
- frozen_revision_id(nullable, finalize 때 같은 article/project revision에 고정), destination(bucket,path) UNIQUE. UUID 경로 + 검증한 content hash, upsert=false. 원본 변경/삭제 작업 없음.
- expected manifest의 각 media_id와 role/해시/크기/MIME가 일치하는 verified 객체가 있어야 commit 가능. RPC에서 역참조까지 검증(단순 JSON FK라고 가정하지 않음).
- destination은 서버 내부 값. 브라우저에는 revision/file ID만 반환. 서명 다운로드 URL을 보관하거나 장기 발급하지 않음.
- 새 revision끼리 공개 파일을 공유하지 않는 v1 설계로 GC 복잡도 제한. historical republish는 같은 불변 revision의 기존 pinned ledger를 재사용하며 새 preparation 소속 ledger를 요구하거나 파일을 복제하지 않음. 공용 폰트는 예외 분류이며 철회 가능한 콘텐츠 미디어가 아님.
- preparation과 media lifecycle 변경은 제한된 service_role 함수에서만. 같은 객체 pin/GC는 동일 ledger row lock으로 직렬화.

### 3.6 실제 FK·소유권·삭제 계약 보정

실사에서 확인한 제약:

- `newsletter_articles`는 PK(id), project_id 단일 FK→projects(id) ON DELETE CASCADE다. (id, project_id) 복합 UNIQUE는 없다. projects는 PK(id), UNIQUE(slug)다.
- 따라서 기존 기사에 (article_id, project_id) 복합 FK를 바로 추가할 수 없다. 기존 표의 복합 UNIQUE/인덱스 추가가 필요한 안을 기본안으로 간주하지 않는다.
- `newsletter_article_compositions`의 article/project FK는 CASCADE, UNIQUE(article_id)다. 배치의 composition FK도 CASCADE다.
- 배치의 asset FK는 **ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED**다. v1.26의 정상 계약이며 즉시 RESTRICT와 다르다. 한 트랜잭션의 프로젝트 cascade를 허용하면서 직접 사용 중 자산 삭제를 commit 시점에 검사한다.
- 원본 기사 삭제 시 block/link/Composition은 cascade, audio/font/대표 이미지 일부 참조는 SET NULL이다. 정기호 publication event의 project FK는 NO ACTION이다.

권장 대안은 **기존 단일 FK + 신규 DB 소유권 검증**이다.

1. 신규 state/preparation에는 원본 article 및 project 단일 FK를 사용하고, DB validator가 실제 article.project_id와 요청 project를 대조한다. 활성 RPC만 아니라 신규 표 INSERT/UPDATE 직접 경로도 검사한다.
2. 신규 revision/event/media 사이에는 신규 표 안의 복합 UNIQUE/FK로 같은 article/project/revision 소속을 강제한다. revision의 원본 article ID는 provenance여도 생성·finalize·transition 때 실제 소유권 검증을 생략하지 않는다.
3. 신규 row의 article/project 식별자는 임의 변경 불가. 원본 article.project_id 이동으로 이미 검증한 소유권이 깨지는 경우도 막아야 한다. 기존 Composition 가드는 Composition 없는 기사까지 보장하지 않는다. 원본 부모 변경 가드 또는 동등한 DB 불변성 검사가 별도 필요하며, 기존 표에 trigger를 추가해야 한다면 A1 승인 범위에 명시한다. 이번에는 추가하지 않는다.
4. 검사 순서는 project→article 잠금 뒤 실제 소속 확인→신규 상태/준비/ledger. 삭제·프로젝트 이동·발행 경합 테스트를 통과해야 한다.
5. 대안은 기존 article에 UNIQUE(id,project_id)를 추가하는 방식이다. 기존 표/인덱스 변경·적용 잠금 영향이 있어 별도 승인 전 선택하지 않는다.

삭제 정책 권장안(향후 구현 승인 대상):

| 원본 기사 상태 | 삭제 계약 | 신규 데이터/파일 처리 |
|---|---|---|
| 독립 데이터 전혀 없음 | 기존 delete_newsletter_article_atomic 유지 | 기존 cascade/SET NULL 회귀 없음 |
| 준비/실패/만료/미공개 candidate만 있음 | 공개 이력 없음 확인 후 기존 hard delete 허용 | state/preparation은 원본 삭제와 함께 정리 가능. 미공개 revision은 제한 정리 대상. 파일은 즉시 삭제하지 않고 ledger로 후속 GC |
| 실제 publish 이력 있음(현재 withdrawn 포함) | hard delete 차단 | event/revision/보존 파일 유지. 단순 withdraw를 삭제 허가로 보지 않음 |
| project soft-delete/archived | 물리 FK로 막지 못함 | 독립 reader·파일·신규 발행 차단. 이것을 독립 이력/파일 삭제로 처리하지 않음 |

준비-only 정리를 위해 state/preparation의 원본 FK는 CASCADE를 우선 검토하고, **성공 event의 원본 FK만 RESTRICT**로 이력을 보호한다. revision은 원본 FK로 일괄 hard-delete를 막지 않는다. event→revision은 RESTRICT여야 한다. preparation 삭제 시 media ledger는 CASCADE 삭제하지 않고 preparation 참조를 SET NULL하여 source ID/목적지/hash/정리 상태를 남긴다. 이미 공개된 frozen_revision의 파일은 어떤 경우에도 orphan GC 대상으로 재분류하지 않는다.

미공개 고아 revision/ledger 정리는 신규 제한 함수가 공개 event 참조0·현재 공개 pointer0·lease 종료·grace 경과를 재확인한 뒤 수행한다. revision 불변 trigger의 DELETE 예외는 이 경우만 허용하며 일반 UPDATE/DELETE grant나 임의 GUC 우회로 만들지 않는다. 공개 이력의 폐기·영구 삭제는 이번 v1에 없다.

기존 삭제 RPC는 신규 보호 오류를 설명하는 계약이 없으므로, 공개 이력 있는 기사에 대해서는 DB 보호만 도입하면 사용자에게 일반 오류가 보일 수 있다. 미래 삭제 API/UI의 명확한 blocked 응답·보존 안내를 별도 안전 계약으로 확정해야 한다. 기존 RPC 수정은 이번 문서 승인에 포함하지 않는다. prepare-only 기사 삭제 성공·파일 후속 정리·동시 publish 승패를 격리 DB에서 검증하지 못하면 원격 적용을 막는다.

revision_no 할당은 project/article 잠금 안에서 수행하며 상태 row의 초기 생성도 prepare/finalize 단계부터 같은 잠금 순서를 사용한다. prepare/finalize에도 서로 구분된 요청키 namespace를 사용한다.

모든 신규 테이블 RLS enable, anon/authenticated/public 직접 접근 금지. service_role에도 불변 revision/event의 일반 UPDATE/DELETE는 주지 않고 좁은 함수로 처리. SECURITY DEFINER는 고정 search_path와 runtime service_role 검사, PUBLIC EXECUTE revoke. 상태/ledger 제약 구현에는 함수 외 검증 trigger가 필요할 수 있으므로 A 구현 승인 항목에 포함한다.

## 4. 내부 prepare/RPC 명세 (새 HTTP API를 이번에 만들지 않음)

이름은 잠정이다. 모든 actor 입력은 향후 서버가 HMAC 세션에서 주입한다. DB가 세션 자체를 검증하는 척하지 않는다.

### prepare_article_publication

입력: projectId, articleId, actor(id/name/role), expectedAssignee, intent(publish/replace/republish), selection(current_draft | historical_revision_id), preparationKey UUID.

처리: 기존 서버 권한 → DB에서 service_role/실제 담당자 재검증 → 현재 상태/허용 동작 검사 → 단일 MVCC source capture → preparation에 원본과 임시 manifest 보관(또는 과거 revision 연결). 같은 preparationKey·같은 입력은 같은 후보로 재개; 다른 입력은 409. 편집 원문 저장·공식 발행·Storage 복사는 하지 않음. preparation 기록은 신규 설계의 DB write이므로 이번 단계에서는 실행하지 않음.

출력 예(논리 DTO):

```json
{
  "preparationId": "uuid", "articleId": "uuid", "revisionId": null,
  "selection": "current_draft", "sourceHash": "sha256", "payloadHash": null,
  "expectedStateVersion": 0, "status": "never_published", "targetCount": 1,
  "scope": "single_article", "mediaStatus": "pending", "expiresAt": "UTC timestamp",
  "allowedActions": ["publish"], "blockers": [], "warnings": [], "canCommit": false
}
```

`prepare`의 blockers는 code/대상 role/필요 조치로 반환한다. snapshot은 관리 권한이 있는 사용자만 볼 수 있다. `canCommit`은 표시용이며 실제 실행 시 재검증한다. 미디어 hash가 확정되지 않은 pending 준비에는 revisionId/payloadHash가 null이고 최종 확인을 허용하지 않는다.

### finalize_article_publication_preparation (내부 전용)

서버가 미디어를 검증한 뒤 preparationId, trusted actor, 검증된 ledger를 제출한다. 함수가 준비 row와 ledger를 잠그고 single-statement source hash 재검증 → 완전한 manifest/payload hash 생성 → 불변 revision INSERT → ledger frozen_revision_id 연결 → preparation ready를 원자 처리한다. 이때부터 snapshot은 변경할 수 없다. 같은 preparation의 재요청은 같은 revision을 반환한다. Storage가 준비되지 않으면 ready로 만들지 않는다. historical은 이전 revision의 파일 보존/현재 공개 자격을 검증한 뒤 ready 처리한다. 이 내부 함수도 별도 구현 승인 대상이다.

### transition_article_publication_atomic

입력: trusted actor/expectedAssignee, projectId/articleId, action, requestKey, expectedStateVersion, preparationId/revisionId, expectedSourceHash, confirmed=true. withdraw는 candidate 없이 대상 active revision을 명시한다.

출력: eventId(requestKey), duplicate, action, resultStatus/resultStateVersion/resultRevisionId(실행 당시), currentStatus/currentStateVersion/currentRevisionId(조회 시점), first/lastPublishedAt, withdrawnAt. URL은 향후 API가 stable article ID로 만든다.

- 응답 유실 뒤에는 같은 requestKey·payload로 요청한다. 현재 인증·권한을 먼저 검증하고, 기존 event를 stale 검사보다 먼저 조회한다.
- 나중에 공개 종료되었으면 과거 성공 영수증을 현재 공개 상태처럼 표시하지 않는다.
- publish/replace/새 초안 republish는 source hash를 재검증한다. historical republish는 지정한 과거 revision을 사용하며 현재 draft hash 일치는 요구하지 않는다. 현재 소유권·미디어 안전 조건은 필수다.
- withdraw는 미디어 누락이나 초안 오류로 막지 않는다. 권한·상태 버전·대상 revision은 확인한다.
- 동일 표현의 replace는 no-op이다. 이벤트/버전 증가 없이 unchanged를 반환한다. 현재 버전이 같으면 재요청도 같은 판정이고, 이후 상태가 바뀌면 409로 재확인한다. 미래 API는 no-op과 성공 영수증을 구분해야 한다.

| 오류 | SQLSTATE / 향후 HTTP | 처리 |
|---|---|---|
| invalid_input / invalid_action | 22023 / 400 | 입력 수정 |
| service_role_required / forbidden / owner_changed | 42501 / 403 | 권한 확인 |
| article_not_found | P0002 / 404 | 다른 프로젝트 정보 비노출 |
| publication_stale / state_conflict / request_key_conflict | PT409 / 409 | 재확인, 자동 발행 금지 |
| media_not_ready / unsupported_media / preparation_expired | PT409 / 409 | 구체적인 조치 안내 |
| feature_disabled / schema_unavailable | 앱 / 503 | 비활성 유지 |
| unknown_commit_result | 전송 / 502 | uncertain=true, 같은 요청 결과 확인 |

실제 PostgreSQL 40001/40P01은 유지한다. 업무 충돌에 40001을 쓰지 않는다(v1.40 재시도 문제 재발 방지). 향후 DB 재시도를 허용하더라도 같은 key/input으로 횟수를 제한하며 브라우저의 무조건 POST 재시도는 금지한다.

## 5. 공개본 일관성과 편집 경합

1. 원본 집계는 **단일 SQL 문의 한 MVCC snapshot**으로 수행한다. 기사·blocks·links·Composition·placements·프로젝트 기본값·관련 asset/font/audio 메타데이터를 함께 읽어 hash와 원본 묶음을 만든다.
2. 여러 REST GET을 합치거나 article.updated_at만으로 공개본을 식별하지 않는다. 미저장 클라이언트 입력은 포함하지 않는다.
3. commit 잠금 순서: 새 요청키용 advisory lock(별도 namespace) → project FOR UPDATE → article FOR UPDATE → 독립 상태 row → preparation → media ledger ID순. 최초 상태 row도 부모 article 잠금 아래 생성한다.
4. 기존 Composition/asset/font writer는 이 부모 잠금을 공유하지 않는다. 모든 관련 행을 뒤늦게 잠가 완전 직렬화를 주장하지 않는다. commit에서도 **단일 집계문**으로 source hash를 확인하고, 이 검증 문장의 snapshot 시점을 편집과 발행의 순서 기준으로 삼는다.
5. 검증 문장 시작 전 commit된 편집은 409로 잡는다. 검증과 겹쳐 나중에 commit된 편집은 공개 이후의 draft 변경으로 취급한다. 공개하는 것은 확인한 불변 candidate 자체다. 요청 시작부터 DB commit까지 모든 편집을 금지하는 보장은 아니다.
6. 여러 트랜잭션으로 구성된 기존 배치 작업 전체를 새 발행 RPC가 원자화하지는 못한다. UI는 저장 busy/unknown을 차단하고 최종 candidate를 확인시킨다. 다른 작업자의 다중 요청 중간 commit까지 완전히 제외해야 한다면 writer 세대 token/공통 RPC가 별도로 필요하다. A 구현에 묵시적으로 포함하지 않는다.
7. Storage 바이트는 DB snapshot과 별개다. source에 hash가 없으면 pending preparation에서 서버가 파일을 읽어 기대 hash를 확정한다. 보존본 검증과 source 재확인 후 finalize하여 불변 revision을 만든다. 내용 미확정 candidate는 최종 확인 불가다.

project 잠금 때문에 v1.38 저장/reorder, v1.40 정기호 처리와 대기는 발생할 수 있다. 데이터 의미는 바꾸지 않는다. AI/Canva article-first 및 batch-copy와의 잠금 경합은 격리 SQL 통합 테스트로 검증한다. 역순 잠금으로 교착이 생기면 제한된 충돌 오류로 종료하고 기존 RPC를 승인 없이 수정하지 않는다.

승인·active 상태는 candidate에 기록하되 **현재의 이용 중지 검사도 유지**한다. 자산 비활성·폐기·사용 금지를 공개본 고정으로 우회하지 않는다. 향후 reader는 현재 안전 조건 위반 시 해당 매체를 차단하고 draft의 다른 이미지로 대체하지 않는다. 공용 font 비활성화 영향은 기존 계약과 정합성을 결정해야 하며 A에서 변경하지 않는다.

## 6. DB와 Storage 간 준비·실패 복구

1. source capture/preparation을 미공개 상태로 기록한다. 모호한 참조·외부 미디어는 blocker다.
2. 관리 서버가 원본 hash/MIME/size를 확인하고 허용된 private 보존 위치로 write-once 복사한다. 외부 생성 API 호출은 없다.
3. 저장본을 다시 읽어 hash/size/MIME를 검증한 뒤 ledger를 verified로 만든다. HTTP200이나 ETag만으로 바이트 검증을 대체하지 않는다.
4. finalize 함수가 source/manifest를 재검증하고 불변 revision과 ready preparation을 만든다. 사용자는 이 검수본을 확인한다.
5. transition RPC가 manifest 대응·권한·유효기간·state/source 검증, media pin, 공개 포인터 및 event를 한 트랜잭션으로 commit한다. SQL 자체가 Storage 실재/바이트를 검증했다고 주장하지 않는다. trusted server의 검증 기록을 신뢰하는 경계다.
6. Storage 성공·DB 실패: 즉시 파일을 삭제하지 않는다. 같은 키 event 조회 → 미commit 확인 → 명시 재시도 또는 만료 후 GC.
7. DB 성공·응답 유실: pin/event가 남는다. 재전송은 duplicate 반환, 파일 재복사 금지.
8. upload 응답 유실: 예정 path를 GET 검증한다. 동일 hash면 재사용, 다르면 충돌. 존재 불명이면 새 path를 무한 생성하지 않는다.
9. GC는 grace 경과, failed/abandoned, unpinned 준비만 대상으로 한다. ledger row 잠금과 live lease/참조 재검증 → deleting → Storage 삭제 → deleted. commit/finalize는 deleting을 거부한다. 삭제 응답 유실은 존재 확인 후 재개한다. 원본과 공개 이력 있는 revision은 v1 자동 삭제 대상이 아니다. 준비-only 원본 기사 삭제 후 남은 미공개 고아는 3.6의 제한 정리 대상으로 구분한다.
10. DB 장애로 비참조를 확인할 수 없으면 삭제하지 않는다. 공개 파일 누락은 경고/접근 실패로 처리하며 live draft fallback은 금지한다.

private bucket이어도 upsert/delete 권한이 남으면 영구 불변은 보장되지 않는다. 전용 prefix write-once, 기존 삭제 경로에서 보존본 제외, 최소 권한, 보관 감사를 C단계 활성화 조건으로 한다. 새 bucket/policy 필요 시 별도 승인. DB와 Storage 작업은 분산 원자적이지 않다.

## 7. Storage 실설정 및 전달 경로 읽기 전용 조사

2026-10-21 각 환경의 Storage bucket 관리 GET만 수행했다. secret, URL token, 파일명 목록은 기록하지 않는다. 아래는 조사 시점 실측이며 bucket RLS·모든 object 접근·이미 발급된 signed URL과 만료시각까지 증명하지는 않는다.

| bucket | Production qmhvlbpedudpwtznletj | Staging mvrkpmffuhcqwisqvpqi | 독립 공개 처리 |
|---|---|---|---|
| mobile-assets | private · 25 MiB | 없음 | private 보존본+revision proxy. Staging 지원 준비 전 blocker |
| audio-files | private · 50 MiB | private · 50 MiB | 실제 음성 바이트와 manifest hash 검증 |
| ebook-tts-audio | private · 50 MiB | private · 50 MiB | 프로젝트 e-book은 독립 v1 제외 |
| pdf-originals | private · 60 MiB | 없음 | 프로젝트 전체 PDF 제공 금지 |
| page-images | private · 25 MiB | 없음 | 다른 기사 포함 페이지 공개 금지 |
| design-production-assets | private · 10 MiB | private · 10 MiB | AI/Canva/Composition 웹 출력, 기존 path만으로 불변 아님 |
| design-intake-assets | private · 50 MiB | private · 50 MiB | 원본·임시 업로드 파일 공개 금지 |
| fonts | **public · 80 MiB** | **public · 80 MiB** | 공용 웹폰트, 기사 철회로 회수하지 않음. 바이트 보존 별도 검사 |
| brand-assets | **public · 5 MiB** | **public · 5 MiB** | 공개 원본 URL 회수 불가. private 복사도 이전 URL은 회수 못 함 |

- `public-files/preview`는 프로젝트 공개/관리 인증을 검사한다. 회수 대상 프로젝트 파일 응답은 `revocable-file-cache.ts`에 따라 private/no-store, CDN/Vercel-CDN no-store다. **공용 폰트 proxy는 예외로 기존 `public, max-age=300`을 유지**한다. GET의 sharedFont 분기에서 no-store 강제를 건너뛴다. 이전 문서의 폰트까지 no-store로 덮어쓴다는 설명을 정정한다.
- AI/Canva/hero는 server role로 private Storage를 읽고 인증 후 proxy한다. 독립 공개에서는 live Composition 조회를 revision manifest 조회로 바꿔야 한다.
- `article-tts-audio.ts` manifest/segment는 현재 프로젝트 gate와 최신 기사 참조를 사용하므로 그대로 재사용하는 것만으로는 부족하다.
- `newsletter-file-storage.ts`, `font-batch-server.ts`의 signed URL은 코드상 **업로드용**이다. 조사한 src에서 열람용 signed URL 발급은 확인하지 못했다. 기존 발급 URL·외부 URL·다른 서비스는 미확인이다. 신규 독립 경로는 download signed URL을 발급하지 않는다.
- proxy의 no-store는 기존 공개 Storage URL·외부 CDN·서명 URL을 무효화하지 않는다. 다운로드/스크린샷도 회수 불가다.
- HTML 이미지, CSS url(), CTA, 외부 embed를 재귀 검사한다. 외부 이동 링크와 내장 미디어를 구분한다. 출처/권한 불명 미디어, 미해결 상대 경로, 원본 AI/PSD/PDF, 다른 기사 미디어, 미승인 자산, 보존 불가 font, 혼합 e-book은 blocker. 임의 변환이나 대리 공개 금지.
- HTML/이미지/음성/thumbnail/OG/HEAD/Range/조건부 GET/변환 이미지 모두 public state+revision membership을 매 요청 확인한다. withdraw commit 후 인증을 시작한 신규 요청은404. 이미 시작한 stream·화면에 로드된 내용·다른 공개 경로는 즉시 회수 보장 밖이다.
- revision 파일 URL도 현재 공개 pointer와 일치해야 한다. replace 뒤 이전 revision URL은404. 이력 열람은 관리 권한 필요.

## 8. 권한·비활성화·기존 기능 영향

- 향후 API는 기존 HMAC session/same-origin/project unlock을 재사용한다. DB는 trusted actor와 현재 담당자/soft-delete를 재검증한다. 기존 user id/name 담당자 비교·admin 범위를 유지하며 QA 사용자에게 admin을 부여하지 않는다.
- 신규 표/함수에만 grant를 추가한다. 기존 project publish/review/demo/file 권한을 완화하지 않는다. 인증 secret·환경변수는 이번에 변경하지 않는다.
- 서버 gate 기본 off, DB rollout gate 기본 off. 환경 이름만으로 활성화하지 않는다. schema/media/proxy 준비와 명시 승인이 모두 필요하다. DB gate 저장 위치는 구현 승인 시 확정하고 project.status를 재사용하지 않는다.
- A단독으로 API/URL/UI를 노출하지 않는다. 준비 데이터가 기존 기사 조회·저장·발행에 영향을 주지 않아야 한다.
- revision은 새 데이터 보존 범위다. 공개 이력 유무별 삭제 보호(3.6), asset/font 중지, soft-delete 접근 차단, 과거 버전 보관 기간을 구현 전에 결정한다. 기존 저장/삭제 계약을 임의 변경하는 승인은 아니다.

## 9. 구현 PR 및 migration 별도 승인 계획

| 단계 | 범위 | 활성화 |
|---|---|---|
| A1: 다음 승인 대상 | 신규 5표/제약/RLS/RPC/validator/격리DB 테스트 | 기본 off, API 없음 |
| B | snapshot reader/안정 기사 URL/접근 판정 | off 유지, 다른 기사 이동 없음 |
| C | 미디어 준비/보존/proxy/GC | Storage 변경 별도 승인 |
| D | 기존 4.발행에 기사1건/정기호 구분, 최종 확인1회 | A~C 준비 및 승인 뒤 |
| E | Staging 통합 QA→별도 Production rollout | 독립 공개만 단계 활성화 |

A1 승인 요청에는 대상 schema 실측, v1.38/v1.40 선행조건, DDL 목록/예상 차이, backup/restore 가능성, 격리 migration 테스트, 잠금 경합, 삭제/보관 정책, DB gate 저장 위치를 포함한다.

적용 순서: 신규 schema(기존 표 변경 최소화) → 제약/함수/RLS/grant → gate off 검증 → 앱 배포(off) → C 준비 → Staging E2E → 별도 Production DB 승인 → 읽기 전용 확인 → 공개 활성화 승인. 이번에는 SQL 파일을 작성하지 않는다.

복구는 gate off로 신규 독립 접근/작업을 중단하고 정기호를 유지한다. 이전 앱으로 돌아가더라도 신규 표/이력을 drop하지 않는다. 공개 이후 파괴적 DB rollback은 별도 승인이다. 미적용 SQL 파일 되돌리기와 실행 DB 복구는 구분한다. Storage GC를 rollback 수단으로 사용하지 않는다.

## 10. 미해결 위험과 중단 조건

- 읽기 전용 실사에서 양쪽 주요 저장·삭제·정기호 RPC signature/본문 해시와 기준 SQL의 일치, 대상14표 컬럼/주요 제약을 확인했다. 모든 원격 DDL/확장/객체를 완전 감사한 것은 아니며 적용 직전 baseline을 다시 확인한다. 양쪽 supabase_migrations.schema_migrations가 없어 버전 이력만으로 적용 여부를 증명할 수 없다.
- 원격 적용 필수 조건: 백업 보존기간, 최신 성공 시점, PITR 범위/복구 지점, 복구 권한·절차·가능성을 확인해야 한다. 현재 미확인으로 **원격 migration 적용 차단**이다. archive_mode=on은 백업/복구 증거가 아니며 DB 백업이 Storage 바이트까지 보존한다고 가정하지 않는다.
- bucket/objects는 RLS on, 조사한 Storage policy는0, service_role은 BYPASSRLS다. 서비스 역할의 삭제/덮어쓰기는 방지되지 않는다. 전용 보존본 보호·기존 정리 경로와의 분리 없이는 원격 활성화 불가.
- 일반 파일 삭제는 Storage 먼저→DB 기록 삭제다(`newsletter-file-storage.ts:deleteProjectFile`). 로고도 Storage 먼저(`project-design-kit/assets/route.ts:DELETE`), 비로고는 DB 먼저→파일 정리다. 신규 DB FK가 거부해도 먼저 삭제된 파일은 되돌리지 못한다.
- 일반 업로드/signed upload에는 upsert=true, article/ebook TTS에는 x-upsert=true 및 segment 삭제 경로가 있다. 기존 원본·음성 cleanup 경로에 공개본 보존 prefix를 절대 넘기지 않는다. 보존본은 write-once/삭제 전 pin 검증, 기존 저장/생성 계약은 별도 유지한다.
- Storage 객체 메타데이터에서 sha256 기록은 확인하지 못했다. ETag/version은 바이트 불변/과거 버전 복구 증거가 아니다. 보존본의 실제 바이트 hash 및 유지 가능성을 검증한다.
- Staging font_assets/font_families의 RLS off+anon/authenticated CRUD grant는 별도 보안 이슈 [#245](https://github.com/pcs039/mobile_newsletter_studio/issues/245)로 분리한다. 이번 PR에서 변경하지 않는다. 실효 anon HTTP 권한은 미확인이고 실제 CRUD 쓰기 검증을 하지 않았다.
- hash 없는 원본 후보 확정, 파일/후보 크기 상한, TTL/grace, 보존 용량은 C단계에서 실측. 준비 TTL30분/GC24시간은 제안이며 미승인.
- 다중 요청 Composition 편집의 중간 commit 제외, 기존 asset/font 중지가 과거 공개본에 미치는 영향은 결정 필요. 현재 안전 조건을 완화하지 않는다.
- 공개 이력 삭제 보호의 UX, renderer 업데이트의 시각 차이, 공용 font 보존, 공개 brand URL의 회수 한계를 명시한다.
- gate/권한/보호 미디어 조건이 불명확하면 fail-closed. 정기호 경로를 우회해 보완하지 않는다.

A 구현·SQL 작성·DB 적용·Storage 설정/복사·API 공개·기능 활성화는 이 PR에 포함하지 않는다. 문서 승인 뒤 필요한 범위를 별도 승인 요청한다.

## 11. 원격 적용 전 필수 체크리스트

- [ ] 백업·PITR·Storage 별도 복구 가능성 확인, 복구 절차 확보
- [ ] 신규 표/RPC의 RLS/grant/불변 trigger·DB gate off 검증
- [ ] 기존 단일 FK+DB 소유권 검증과 원본 project 이동 방어 확정
- [ ] 준비-only 삭제 성공과 공개 이력 삭제 차단, 기존 RPC/API 오류 계약 확정
- [ ] 보존본의 삭제·upsert 방지, 일반 업로드/TTS/파일 삭제 경로와 분리
- [ ] 격리 PostgreSQL 동시성·중복·응답 유실·Composition·삭제/GC-pin 경합 통과
- [ ] 기존 정기호 발행·검수·시연·공개 파일/공용 font 캐시 회귀 통과
- [ ] 미확인 Staging 폰트 실효 권한과 별도 권한 보정 계획 정리(별도 승인)

체크리스트 미완료는 원격 적용/활성화 승인이 아니다. A1 격리 구현도 별도 승인 이후 시작한다.
