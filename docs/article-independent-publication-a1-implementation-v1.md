# 독립 발행 A1 — 격리 DB 구현 및 검증

2026-10-21. 기준 main/PR #244 merge: `449ee01cdc76cd4b5638413bde76e6ce2f3fc5b7`.

설계: [A단계 계약](article-independent-publication-stage-a-v1.md),
[테스트 명세](article-independent-publication-stage-a-tests-v1.md).

## 적용 경계

이번 변경은 **원격 적용 불가 상태의 A1 코어**다. SQL은 로컬 loopback PostgreSQL의
`mns_a1_*` 데이터베이스에만 설치할 수 있다. 설치 시 원격 주소·다른 DB 이름이면 DDL 전에
거부한다. RPC 역시 service_role 및 같은 격리 DB 조건과 세션의 명시적인
`newsletter.a1_isolated_test=on`을 요구한다. 세션 설정은 인증을 대신하지 않으며,
테스트 외 서버/API/UI/환경변수에는 설정하지 않는다. 기본값은 비활성이다.

Production/Staging migration, 원격 Storage 변경, 실제 발행은 실행하지 않았다.
기존 정기호 RPC·기사 저장/삭제 RPC·공개 reader·작성자 UI·인증은 변경하지 않았다.
SQL이 저장소에 들어가는 것만으로 자동 적용되지 않는다.

## 신규 데이터와 RPC

| 신규 표 | 계약 |
|---|---|
| newsletter_article_publications | 기사별 never_published / published / withdrawn, CAS state_version, active/last revision |
| newsletter_article_publication_revisions | 기사별 revision_no, 불변 text snapshot, source/payload SHA-256, schema/renderer version |
| newsletter_article_publication_events | request_key 영수증, 요청 해시·actor·상태 전후·revision, append-only |
| newsletter_article_publication_preparations | 별도 preparation_key, pending/ready/committed, actor·intent·원본 해시·30분 만료 |
| newsletter_article_publication_media | 후속 준비용 pending ledger만. worker/verified/pin/GC 기능 없음 |

service_role에 실행 권한을 주는 함수는 세 개다.

1. `prepare_article_publication`: 담당자·소속·현재 상태를 확인하고 후보 준비. 동일 준비키는 재사용,
   다른 입력은 PT409. 역사적 재공개는 실제 공개 이벤트가 있는 같은 기사 revision만 선택 가능.
2. `finalize_article_publication_preparation`: 후보 상태·만료·원본 해시 재확인 후 revision 한 건 확정.
   동일 후보 재시도는 기존 revision 반환. 미디어 준비 완료를 외부 입력으로 주장할 인자가 없다.
3. `transition_article_publication_atomic`: publish/replace/withdraw/republish.
   명시적 확인, 기대 state_version, 후보·원본 해시, 현재 권한을 확인한다.

이름·signature는 SQL 파일이 기준이며 아직 HTTP DTO 계약이 아니다. actor는 향후 신뢰된 서버가
기존 세션에서 주입해야 한다. DB가 HMAC 로그인 세션을 인증하는 것으로 취급하지 않는다.

새 표 전체 RLS enable. PUBLIC/anon/authenticated 직접 접근 및 함수 실행 금지.
service_role은 표 SELECT 및 위 RPC만 허용한다. helper 실행·직접 INSERT/UPDATE/DELETE는 불허한다.
revision/event UPDATE·DELETE는 owner 경로도 trigger로 차단한다. 미공개 고아 후보 정리 함수도
이번에는 제공하지 않는다. 기존 표의 ACL·RLS·기존 함수 정의는 바꾸지 않는다.

## 상태·중복·경합

publish는 never_published, replace/withdraw는 published, republish는 withdrawn에서만 가능하다.
성공 mutation마다 state_version과 event가 정확히 한 번 증가한다. withdraw는 active 포인터만
비우고 last revision·이력·원본을 보존한다. 최초 발행 시각은 보존한다.

요청키 advisory lock → project → article → state → preparation 순서로 잠근다.
같은 키·같은 actor와 입력은 당시 영수증을 반환하고 현재 상태/버전을 별도 표시한다.
응답 유실 재요청도 새 이벤트를 만들지 않는다. 같은 키의 입력 변경은 PT409다.
현재 권한을 잃으면 과거 영수증도 반환하지 않는다. 업무 충돌은 PT409이며 PostgreSQL의
40001/40P01을 변환하거나 자동 반복하지 않는다. 이벤트 INSERT 실패는 포인터 변경도 rollback한다.

같은 render payload의 replace는 unchanged로 반환하며 이벤트·버전 증가가 없다.
이 no-op 영수증을 별도 보관하지 않는다. 상태가 바뀐 뒤 예전 no-op 요청을 다시 보내면
stale/재확인으로 처리하며 과거 성공으로 가장하지 않는다.

## 소유권과 기존 삭제

기존 article에 복합 UNIQUE나 인덱스를 추가하지 않는다. 신규 표 INSERT/UPDATE의 DB validator가
실제 article.project_id를 검사하고 신규 identity 변경을 막는다. 신규 표 사이의 revision 참조는
복합 UNIQUE/FK로 같은 article/project를 보장한다.

기존 `newsletter_articles`에는 소속 변경·삭제 보호 trigger 한 개만 추가한다.
Composition이 없는 기사도 준비/이력/ledger가 있으면 project 이동을 막는다.

- 독립 데이터 없음: 기존 hard delete 유지.
- pending/ready 준비만 있음: 기존 삭제 RPC 성공, state/preparation cascade 정리.
  미공개 revision은 불변 고아로 보존하고 pending ledger의 preparation FK만 SET NULL한다.
- 실제 publish 이력 있음: withdrawn 포함 hard delete PT409, project 삭제도 event FK로 보호.
- archived/soft-delete: 신규 발행·준비 거부. 권한 있는 withdraw는 격리 계약에서 허용.
  실제 독립 URL/파일 접근 차단은 B/C 단계이므로 아직 검증한 기능이 아니다.

기존 삭제 API의 친절한 이력 보호 안내는 후속 과제다. 현재 DB 거부를 일반 오류로 표시할 수
있으므로 이 trigger를 원격에 먼저 적용하면 안 된다. 원격 적용 전 삭제 API 오류 계약이 필요하다.

## 스냅샷과 미디어 차단

단일 STABLE SQL 문장으로 article/project, 순서가 고정된 block/link,
Composition/placement/design kit 의존성을 같은 MVCC snapshot에서 읽는다. Composition만 바뀌고
article.updated_at이 같아도 source_hash가 달라진다. timestamp는 capture 함수 안에서 UTC로 고정한다.
SHA-256은 PostgreSQL JSONB text 직렬화 기준이며 테스트에서 동일 UTF-8 바이트의 Node 해시와 비교한다.
향후 서버가 별도 JSON 직렬화로 해시를 재계산해도 같다는 보장은 아직 하지 않는다.

저장 가능한 A1 snapshot은 **텍스트 전용 제한 스키마**다. source는 전체 의존성 해시로 비교하되
보존 payload는 허용한 기사·프로젝트 표시 필드와 문단만 포함한다. 프로젝트 password/secret과
provider payload를 복사하지 않는다. snapshot 최대 1MiB, payload 최대 512KiB.
제목/본문을 자동 요약·변환하지 않는다. renderer_version=`a1-no-reader`이므로 기존 reader에
그대로 전달하거나 정식 공개 snapshot으로 사용하면 안 된다.

폰트·음성·이미지 참조, Composition/design kit, 비문단 block, HTML/URL/CSS 미디어 표현,
CTA/link, 미해결 metadata 또는 pending ledger가 있으면 `media_or_render_contract_not_ready`
또는 `article_publication_media_not_ready`로 차단한다. 역사적 재공개도 ledger가 있으면 차단한다.
빈 제목·구조가 잘못된 public_info·설문/페이지 의존성도 텍스트 제한 스키마로 통과시키지 않는다.
외부가 ledger를 verified/pinned로 바꾸는 함수·권한·테스트 우회는 없다.

따라서 제목/본문/블록/링크/Composition/폰트/미디어 전체의 **실제 불변 공개본 보존은 미완료**다.
지금 검증한 것은 상태 코어와 차단 계약이다. 전체 snapshot, 바이트 검증, 보존 prefix,
Storage-first 삭제/upsert 방어, lease/GC-pin 경합(C13/M04~M09)은 후속 A2/C 조건이다.
DB FK나 이번 ledger가 Storage 파일을 보호한다고 주장하지 않는다.

기존 복수 REST Composition 편집의 중간 committed 상태까지 원자화하지 않는다.
capture 이후 commit한 편집은 draft로 남을 수 있다. 기존 모든 writer를 직렬화했다는 의미가 아니다.
AI/Canva article-first 잠금과의 실제 통합 경합(C12)은 추가 검증 대상이다.

## 격리 검증 방법

외부 임시 경로에 `embedded-postgres@18.4.0-beta.17`, `pg@8`, `@electric-sql/pglite`를 설치했다.
앱의 package.json/lockfile/dependency는 변경하지 않았다. 테스트는 기존 DB URL·Supabase 키를
읽지 않으며 매 실행마다 임시 디렉터리·무작위 암호·loopback 포트·새 DB를 만든 뒤 종료한다.

```sh
ARTICLE_PUBLICATION_SQL_RUNTIME=/absolute/path/to/isolated/node_modules \
  node --test tests/article-independent-publication-sql.test.cjs
```

실제 PostgreSQL 다중 연결로 parent lock을 잡고 pg_stat_activity에서 양쪽 Lock wait를 확인한 뒤
해제한다. PGlite 한 연결의 Promise.all을 다중 세션 증거로 사용하지 않는다.
옵트인 runtime이 없으면 A1 SQL 검증은 skip으로 표시되며 통과 증거로 세지 않는다.

확인 범위:

- S01/S03~S11/S13, I01~I06/I08/I09: 상태·revision·CAS·중복·응답 유실·역사적 재공개.
- C01~C05/C16: 같은 키/다른 키 발행, replace/withdraw, withdraw/withdraw, 기존 삭제 경합.
- S14a/b/c/e, C15: 이력 없는 삭제, 준비-only 삭제·ledger 보존, 이력 삭제 차단, 소속 변경 보호.
- C06/C07/C08/C10: 원본/문단/Composition/default 색상 변경, 단일 writer 전후 일관성.
- A01/S12: 실제 role SELECT/RPC/직접 mutation 권한, RLS, 불변 trigger.
- S02/M03: 실제 미디어가 필요한 후보 finalize/commit 차단. media worker 성공은 검증하지 않음.
- R01/R02/R09/R10 일부: 실제 기존 v1.21/v1.38/v1.29/v1.30/v1.40 SQL을 같은 격리 DB에 로드,
  기존 함수 정의/signature/ACL 동일, 기사 저장 순서·append·삭제, 정기호 직접 발행·기관 검수 회귀.

독립 URL·보호 파일·미디어 보존·HTTP409·브라우저 화면은 미구현이다. 기존 시연/공개 기능 회귀는
전체 기존 자동화 테스트로 확인하며 새 독립 공개 E2E로 보고하지 않는다.

## 원격 적용 전 추가 조건

1. 백업/PITR/DB 및 Storage 복구 절차 확인과 별도 원격 적용 승인.
2. 전체 snapshot schema/renderer/hash 검증 및 미디어 준비 완료 계약.
3. 보존 파일 write-once/pin/GC/upsert/삭제 차단과 원격 권한 확인.
4. 기존 hard delete의 사용자 안내/API 오류 계약 및 전체 writer 교착 테스트.
5. B/C reader/file authorization 구현 후 scope·철회·캐시·회수 E2E.
6. DB/application gate 및 실제 서버 actor 주입 경계 검증. 이번 local-only gate를 원격용으로 변경할 때 별도 검토.

A1 PR은 OPEN으로 유지한다. 위 조건을 충족하기 전 원격 SQL 실행·공개 기능 활성화는 금지한다.

## 실행 결과

- A1 실제 격리 PostgreSQL: **38/38**, 실패/skip 0.
- 전체 기존+신규 테스트: **544/544**, 실패/skip 0. 기존 SQL 회귀에는 격리 PGlite도 사용했다.
- TypeScript, lint, Webpack build, diff check 통과. lint는 기존 파일 warning 3개(오류 0), 변경 파일 warning 0.
- PR #244는 문서 3개만 merge commit으로 병합, 동일 SHA Production Ready/Latest/Current 확인.
- 이슈 #245는 보정 증거·실제 업로드/브라우저 쓰기 E2E 미검증을 기록하고 completed 종료.
- Production/원격 Staging DB·Storage·인증·환경변수 변경 0. PR #226/#229 및 기존 stash 2개 보존.
