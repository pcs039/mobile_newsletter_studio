# 전체 디자인 복사 Stage B-1 — 격리 서버 계약

기반 main: `e54ec309353c6355481d1338a500718d3c2a7c29`(문서 PR #254 병합).
설계 기준: [Stage A](article-full-design-reuse-stage-a.md).

**이 단계는 로컬 PostgreSQL 계약 시제품이다. 운영용 migration, 공개 RPC/API, UI, Storage 동작이 아니다.** `supabase/`에는 SQL을 추가하지 않는다. 기존 v1.27/v1.28/v1.38 및 발행 RPC는 수정하지 않는다.

## 1. 구현 파일과 실행 경계

- [contract.sql](../tests/fixtures/full-design-copy-b1/contract.sql): 격리 schema `b1_isolated`, 요청 receipt 및 내부 함수.
- [postgres.cjs](../tests/fixtures/full-design-copy-b1/postgres.cjs): 임시 디렉터리·무작위 비밀번호·loopback 전용 embedded PostgreSQL. 원격 URL/키를 받지 않는다.
- [통합 테스트](../tests/full-design-copy-b1-sql.test.cjs): 실제 서로 다른 PostgreSQL 연결과 `pg_stat_activity`의 lock wait로 경합 확인.

SQL 설치와 진입 함수 모두 `mns_b1_...` DB명, loopback 연결, `newsletter.b1_isolated=on`을 요구한다. 호출은 추가로 `auth.role()=service_role`이어야 한다. 이는 오적용 방지 장치이며 신뢰할 수 없는 DB 관리자에 대한 보안 경계가 아니다. 서비스 실행 코드에서 파일을 읽거나 설치하는 경로가 없다. 원격 설치용 SQL로 이름만 바꿔 재사용하지 않는다.

기본 전체 테스트는 로컬 SQL runtime이 없으면 PostgreSQL 항목을 skip한다. 따라서 SQL 검증에는 아래처럼 runtime을 명시하고 **skip=0**을 확인한다. 앱 의존성·lockfile에는 embedded PostgreSQL을 추가하지 않는다.

```sh
FULL_DESIGN_B1_SQL_RUNTIME=/private/tmp/mns-a1-runtime/node_modules \
  node --test tests/full-design-copy-b1-sql.test.cjs
```

runtime에는 로컬 `embedded-postgres`, `pg`가 필요하다. PostgreSQL은 테스트 종료 시 중지하고 해당 테스트가 만든 디렉터리만 정리한다. 운영/원격 DB에 접속하거나 실제 기사·폰트를 사용하지 않는다.

## 2. 진입 계약

`b1_isolated.copy_contract(p_action text, p_project uuid, p_source uuid, p_target uuid, p_actor jsonb, p_request_key uuid, p_expected_source text, p_expected_target text) → jsonb`

| action | 입력 / 결과 |
|---|---|
| `prepare` | 프로젝트·원본·대상·trusted actor. 잠금과 검증 후 `outcome=prepared`, `sourceRevision`, `targetRevision`, `plan` 반환. 데이터/receipt write 없음 |
| `execute` | 동일 식별자·actor + UUID requestKey + 준비 revision 2개. 모든 변경과 receipt를 한 트랜잭션에 기록. `outcome=success`, `replayed=false`, 고정 `result` 반환 |
| `result` | 원래 요청과 동일한 key·식별자·revision. 완료 receipt가 있으면 동일 결과 반환. 없으면 `outcome=unknown`, `reason=no_committed_receipt`. 성공/실패를 추정하지 않음 |

`p_actor={id,name,role}`의 role은 현재 앱의 `admin/user`만 허용한다. user는 프로젝트 담당자 이름/ID와 공백 제거·소문자 비교, admin은 기존 관리자 권한을 따른다. **이 JSON은 인증 수단이 아니다.** 향후 서버가 HMAC 세션, same-origin, `requireProjectApiAccess()`의 담당 권한·프로젝트 잠금 해제를 먼저 검증하고 직접 구성해야 한다. 브라우저에서 받은 actor를 전달하는 HTTP 경로는 구현하지 않았다. 비밀키는 테스트에 사용하지 않는다.

SECURITY DEFINER 진입 함수 하나만 service_role에 EXECUTE를 허용한다. helper 실행 및 receipt 직접 CRUD는 service_role에도 허용하지 않는다. receipt는 RLS 활성·정책 없음·비서버 ACL 없음이며 함수 소유자의 제한된 경로로만 기록/조회한다. 모든 함수의 search_path는 고정한다. 향후 운영 owner/default grants/PostgREST 노출 schema 검증은 별도다.

## 3. 미공개 프로젝트 판정

B-1은 아래를 모두 요구한다.

1. 프로젝트가 존재하고 deleted_at/archived_at이 null.
2. status가 정확히 `draft`, published_at이 null. `private/in_review/archived/published`는 허용하지 않는다.
3. 정기호 publication event 테이블이 있으면 해당 프로젝트의 이력이 없어야 한다. 취소 뒤 published_at이 null이라는 사실만으로 최초 준비 상태라고 보지 않는다.
4. 향후 A1 `newsletter_article_publications`가 설치돼 있으면 **전체 B-1을 fail-closed** 한다. 독립 발행 상태·revision의 잠금/반영 계약을 검토하기 전 draft 프로젝트라는 이유로 허용하지 않는다.

현재 공용 reader는 regular 기사 status와 별개로 발행된 프로젝트를 공개할 수 있고, 폰트·정렬은 Composition ready에 종속되지 않는다. 그러므로 article=draft/Composition=draft로 프로젝트 검사를 대체하지 않는다. 공개 경로·승인·시연/검수 접근 조건은 그대로다. 현재 앱이 기존 공개본의 폰트 렌더링을 유예해 준다고 주장하지 않는다.

## 4. 정확한 write 범위

- 원본/대상은 같은 프로젝트의 서로 다른 기사. 원본 배치 1~100개, 단일 슬롯 중복 없음.
- 배치는 기존 asset ID, slot, sort_order, is_visible, 허용 settings로 교체. 위치/색상/회전/확대/투명도 등의 기존 validator 범위를 SQL에서 검사한다. 원본 settings의 임의 URL/CSS/HTML 키를 복사하지 않는다.
- 같은 프로젝트 active Draft/Approved 웹용 제작 자산만 허용. archived·로고·원본 형식·잘못된 bucket/path/MIME·슬롯 종류 불일치 차단. Draft는 편집용 배치일 뿐 공개 승인으로 승계되지 않는다.
- textDesign의 captionStyled/bodyEmphasis/numberShape/각 Enabled만 원본에서 복사. 대상 subtitle/number/label 문자열은 그대로 보존. 대상 문구가 비어 있으면 Enabled를 false로 정규화. 문자열 길이는 JS의 UTF-16 길이 기준도 검사한다. productionPattern은 enum만 저장하고 패턴 적용 함수로 대상 라벨을 덮지 않는다.
- layout_key는 현행 `standard`만 지원.
- 기사 폰트 ID 4개와 정렬 4개만 UPDATE. nullable ID를 그대로 복사하므로 같은 프로젝트의 상속 규칙을 유지. font/family active·webfont 허용·등록 경로·형식 검사. 글자 크기/CSS weight/style 저장 모델을 추가하지 않는다.
- 대상 Composition status=draft, 알 수 없는 기존 대상 settings 키 유지. 원본의 불명확한 settings 키는 이전하지 않는다.
- 제목·요약·본문·발행 상태·순서·블록·링크·CTA·오디오·원본 기사는 UPDATE하지 않는다. 대상 article/Composition/placement의 수정 시각 및 새 placement ID는 변경된다. 새로운 대상 Composition 생성은 기존 project/article FK·유일성 제약을 이용한다.

파일 실재·바이트·폰트 호환성 검증은 하지 않는다. 등록 메타데이터 유효성을 실제 Storage 보존/정상 렌더링 증거로 취급하지 않는다. 이슈 #239 범위는 그대로다.

## 5. revision·잠금·원자성

revision은 SQL 내부 SHA-256 지문이다. 기사 row, 블록·링크, 프로젝트 row(상속/권한/상태 포함), Composition/배치, 참조 자산·폰트·패밀리의 원시 JSONB를 ID 순서로 집계한다. UI 표시용 updated 문자열이나 기사 updated_at만 사용하지 않는다. timestamp 표현은 UTC로 고정한다. Node와 공유하는 새로운 canonical 포맷을 만들지 않으며 향후 포맷 변경은 계약 버전 변경으로 취급한다. prepare는 원시 프로젝트 row나 비밀정보를 반환하지 않는다.

1. execute/result는 `(project,actor,key)`에 대한 transaction advisory lock을 잡는다. key hash 충돌은 불필요한 직렬화만 일으키며 receipt PK가 실제 중복을 구분한다.
2. 프로젝트 row FOR UPDATE → 기사 ID 순서 → Composition article ID 순서 → placement ID 순서 → asset ID → font ID → family ID 순서.
3. 기존 A 복사는 기사부터 잠근 뒤 새 Composition의 project FK를 확인할 수 있다. B가 project를 잡은 뒤 기사 잠금을 기다리면 역전 위험이 있으므로 **기사 잠금은 NOWAIT**, 충돌 시 `PT409/design_copy_busy`로 거절한다. 기존 A RPC 변경 없이 격리 다중 연결 테스트로 이 경우를 확인한다.
4. Composition/placement row 잠금 및 부모 FK와 asset/font/family SHARE 잠금으로 실행 중 관련 수정·삭제를 직렬화한다. 잠금 후 원본·대상 revision을 다시 계산하고 비교한다.
5. 기사 표현 필드·Composition·배치 교체·성공 receipt를 하나의 함수 transaction에 처리한다. receipt INSERT 실패를 주입하면 앞선 디자인 변경도 모두 rollback됨을 검사한다.

**모든 기존 writer의 전체 잠금 그래프를 증명한 것은 아니다.** REST의 여러 요청에 걸친 Composition 생성/변경, 아직 존재하지 않는 row의 INSERT·FK 검사, 프로젝트 삭제 및 향후 A1 trigger는 별도 통합 검증 대상이다. SQL의 실제 `40P01`/`40001`·lock timeout은 업무 오류 코드로 위장하지 않는다. DB가 abort한 요청은 부분 성공이 아니지만, 클라이언트 응답이 없으면 임의로 실패라고 단정하지 않고 receipt로 확인한다. 자동 반복 실행은 없다.

기존 B-1의 project lock은 같은 프로젝트 B 요청을 직렬화한다. 이번 모델은 single-target 검증용이며 운영 처리량/긴 트랜잭션 허용성을 검증한 결과가 아니다. 원격 적용 전에는 격리 prototype의 잠금과 owner/권한을 운영용 계약으로 다시 검토한다.

## 6. 중복·응답 유실·오류

receipt PK는 `(project_id,actor_id,request_key)`. 요청 해시는 source/target 및 기대 revision·계약 버전을 포함한다. 같은 key/요청은 최신 원본의 stale 검사보다 **기존 완료 결과 재사용을 우선**하며 article/배치를 다시 쓰지 않는다. 같은 key/다른 요청은 `PT409/request_key_conflict`다.

프로젝트 접근 권한·삭제/보관 상태는 재조회 때도 검사한다. 완료 후 프로젝트가 발행되면 결과 자체는 조회할 수 있지만 새로운 복사는 차단한다. receipt가 없는 result는 실행 중 잠금을 기다린 뒤에도 unknown을 반환한다. 독립된 GET에서 현재 배치가 비슷하다는 사실로 이전 요청 성공을 확정하지 않는다.

| 분류 | SQL / 클라이언트 의미 |
|---|---|
| 정상 | `prepared` 또는 `success`; replay 여부와 동일 고정 결과 |
| 업무 충돌 | `PT409`: stale, busy, source_empty, 공개 상태/이력, 자산·폰트 제약, key 충돌 등. 서버가 명확히 전달한 거절만 거절로 표시 |
| 잘못된 입력 | `22023`; identifier/actor 권한은 별도 `42501`/`PT404` |
| 미확정 | transport timeout/응답 유실/결과 조회 실패/미기록 receipt. 원래 key와 요청을 유지하고 자동 재실행 금지 |

receipt 보존 기간·개인정보 최소화·사용자 ID 변경·프로젝트 삭제 후 접근/보관 정책은 운영 구현 전에 확정한다. 이번 시제품 receipt에는 article/project FK를 추가하지 않아 기존 삭제를 막지 않는다. 실제 삭제 후 결과 조회는 프로젝트 권한 검사에 따라 제한되므로 운영 복구/retention 정책 없이 원격 적용하지 않는다. 거절·진행 중 요청을 별도 성공 이력으로 INSERT하지 않는다.

PR #253 A의 요청/응답, copyOutcome, 운영 잠금 복구는 변경하지 않는다. B receipt를 기존 A의 성공 판정이나 잠금 해제로 사용하지 않는다. A의 명시적 결과 조회 문제까지 해결했다고 주장하지 않는다.

## 7. 검증 범위와 한계

실제 로컬 PostgreSQL에서 다음을 검증한다.

- 내용/블록/링크/source 보존, 독립 font ID/null 상속, 대상 문자열 보존/빈 문자열 정규화, 대상 settings 유지, 배치 교체.
- 공개/보관/삭제/이력·다른 프로젝트/actor·빈 원본·비활성/미승인 상태 계약·잘못된 설정 및 폰트 차단.
- source/target/placement/asset/family/defaults 및 블록/링크 변경 후 stale; timezone 독립 지문.
- 동일 key 동시 execute, 결과 조회의 commit 대기, 다른 key의 동일 snapshot 충돌, 응답을 버린 후 결과 재조회, receipt 실패 후 동일 key 재시도.
- 기존 v1.38 저장·v1.21 삭제·v1.27 배치 복사와 실제 다중 연결 경합, 기존 A 신규 Composition 생성 시 잠금 역전 회피.
- service_role 진입만 허용, helper/receipt 직접 접근 차단, anon/authenticated 차단, 설치/호출 guard.

현재 테스트용 선행 schema는 필요한 실제 컬럼/FK/enum을 갖춘 최소 fixture이며, v1.21/25/26/27/28/38 원본 SQL을 로드한다. 원격 전체 schema와 같다고 주장하지 않는다. 기존 자동화 회귀 통과는 실제 원격 기사·파일·공개 출력 E2E의 대체 증거가 아니다.

## 8. 기존 OPEN PR과 후속 진입 조건

A1 #246의 article 소유권/삭제 trigger, project/article 잠금, 독립 state를 B가 자동 우회하면 안 된다. 현재는 A1 테이블이 발견되면 신규 B를 차단한다. A2 #247의 불변 snapshot/renderer version은 편집본과 별개이며 B가 공개 revision을 수정/replace하지 않는다. C1 #248의 Storage/이미지/TTS 파일은 이번에 변경·가져오지 않는다. PR #226/#229/#246–249는 보존한다.

B-2 서버/API/UI 전에 필요한 사항:

1. 현행 HMAC·same-origin·프로젝트 권한/잠금 해제와 trusted actor 공급을 연결하고 권한 만료·응답 유실 오류 계약 검증.
2. A1/A2 병합 순서와 공개 상태 gate를 명시적으로 결정. 미발행/이력 없는 draft 외 범위 확장 금지.
3. 전체 writer의 Composition 생성·FK·삭제·승인·폰트 변경 경합을 추가 검증. 실제 deadlock/timeout의 재확인 UX 확정.
4. 운영 receipt 테이블·owner/grants·retention·삭제 정책·백업/rollback 검토 후 **별도 migration 승인**. 이 fixture SQL을 그대로 배포하지 않음.
5. PR #253의 잠금/초안 보호와 기사 폰트 Context baseline 연동 설계. 임의 full article save, Context/RSC 구조 변경 금지.
6. Staging 적용·인증 UI·실제 폰트/자산 렌더링·저장 재진입은 별도 승인·QA. Production 적용은 추가 승인.

B-1 PR은 OPEN으로 유지하고 병합하지 않는다. remote migration·Storage write·실제 복사·발행·UI 활성화는 수행하지 않는다.

## 9. 이번 실행 결과

- PR #254 merge: `e54ec309353c6355481d1338a500718d3c2a7c29`. GitHub Production deployment `7281095406`의 동일 SHA/success 및 최신 Production 배포 기록 확인. 운영 `/login` HEAD HTTP 200 확인. 관리자 데이터 쓰기는 수행하지 않음.
- B-1: 격리 PostgreSQL 테스트 27/27(전체 실행 안의 guard 테스트·통합 suite 포함), skip 0. 다중 연결의 실제 lock wait를 관측함.
- 기존 PGlite SQL과 신규 PostgreSQL을 포함한 전체 테스트 **569/569, skip 0**. `CANVA_SQL_TEST_RUNTIME`과 `FULL_DESIGN_B1_SQL_RUNTIME`을 명시해 실행.
- TypeScript 통과, lint 오류 0(기존 warning 3개), Webpack production build 통과. 실행 앱 코드·dependency·원격 설정 변경 없음.
- 문서 상대 링크와 diff 검사 통과. 별도 B-1 PR은 미병합으로 보존. Production/Staging의 실제 전체복사·저장·발행 E2E는 수행하지 않았으며, 운영 가능한 기능으로 보고하지 않음.
