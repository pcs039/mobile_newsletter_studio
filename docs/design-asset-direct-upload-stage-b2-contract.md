# 제작 자산 직접 업로드 Stage B-2 — 운영 계약 초안

기준: PR #258 merge `dafbdacd25bbd27701de207643756a7fc8e2b169`, 2026-10-24.
[Stage A](design-asset-direct-upload-stage-a.md) / [B-1 사전 검증](design-asset-direct-upload-stage-b1.md).
이번 변경은 문서·SQL 초안·로컬 테스트뿐이다. 운영 API/UI·의존성·기존 SQL은 수정하지 않았으며 원격 DB/Storage에 적용하지 않았다.

## 1. 선행 병합

PR #258 head `1869e16f337e9bb86486d61f0e2fe253e53230de`의 OPEN/MERGEABLE/Vercel SUCCESS, 문서·격리 테스트 4개 파일과 91/91 통과·skip 0을 재확인해 merge commit 병합했다.
[Production 배포](https://vercel.com/joseph-park-s-projects/mobile_newsletter_studio/FrNB3tAvLpKFqXH2vB9Y61B37QH2)는 동일 merge SHA의 Ready / Latest / Current Domains 운영 도메인 연결을 확인했다. main/origin/main을 동기화한 뒤 B-2 브랜치를 만들었다.

## 2. MVP 및 경계 확정

- 같은 프로젝트의 **PNG/JPEG/WebP 제작 자산 단건**만 대상으로 한다. 제작 자산 종류는 기존 background/illustration/icon/card_frame/banner/pattern/decoration을 유지한다.
- 로고, SVG, AI/PSD/EPS/PDF, 원본/참고 자료, 일괄 업로드, 외부 URL import는 제외한다. 기존 업로드 API/화면은 그대로 유지한다.
- 첫 MVP 전송은 **standard signed upload**다. 10MiB까지의 바이트 전송에서 Function 본문 제한을 피하는 것이 첫 목표이며 TUS는 후속이다. 불안정한 모바일 네트워크에서 standard 전송이 중단되면 자동으로 새 자산을 만들지 않고 같은 세션을 확인한다.
- 파일 검증은 승인 판단이 아니다. 신규 경로의 등록 기본값 제안은 draft/inactive, Composition 적용 없음이다. Stage A/B-1과 동일한 제안으로 기존 POST의 active=true 기본값, 기존 승인·활성화·visible·ready 조건을 변경하지 않는다. 신규 경로에서 활성화 단계가 어떻게 안내될지는 B-3 UI 노출 전에 확인해야 한다.

## 3. Storage 격리·권한

**전용 private 임시 버킷 `design-upload-quarantine`을 권장안으로 선택한다.** 아직 생성하지 않았다. 기존 intake 버킷은 원본·참고 자료·폰트 임시 파일과 함께 쓰이므로 새 미검증 객체의 prefix 접근/GC 범위를 공유하지 않는 편이 명확하다. 이 버킷의 생성·정책 적용은 별도 승인 대상이다.

| 객체 | 경로 계약 | 접근 |
| --- | --- | --- |
| 미검증 입력 | `projects/<projectUUID>/design-upload-v1/<sessionUUID>/input.<canonicalExt>` | 이 한 경로의 signed upload만 브라우저에 발급. public URL/임시 download URL/관리자 proxy ID를 만들지 않음 |
| 검증 후 출력 | 기존 private production 버킷의 `projects/<projectUUID>/production/<type>/direct-v1/<sessionUUID>/<generation>.<ext>` | 서버만 쓰기, no-upsert. 다른 worker는 다른 generation 경로. 승인된 자산 row가 생기기 전 어떤 공개 경로에도 연결하지 않음 |
| 독립 발행 보존본 | C1의 별도 버킷/prefix | 사용하지 않음. 업로드 GC가 C1 보존 namespace를 탐색·정리하지 않음 |

임시 버킷은 public=false, 10MiB, PNG/JPEG/WebP MIME만 허용하는 제안이다. **anon/authenticated에 일반 INSERT/SELECT/UPDATE/DELETE를 열어 주지 않는다.** 앱의 HMAC 인증은 Supabase Auth가 아니며, 기존 서버가 권한을 확인해 service-role로 제한된 capability만 발급한다. service-role 키는 클라이언트·테스트 실행기에 전달하지 않는다. 역할 상속까지 포함한 실효 ACL/RLS와 signed 경로 권한은 원격 적용 전에 검증해야 한다.

버킷 경로·프로젝트·종류·final 경로는 서버가 결정한다. 파일명은 NFC로 정규화한 표시 정보일 뿐 경로로 사용하지 않는다. query/body의 bucket/path, actor role, 승인·active 값, 검증 proof는 클라이언트가 지정할 수 없다. capability는 로그/분석/trace/referrer/PR에서 제외하고 제어 응답은 no-store다.

### 만료·재시도

앱 intent 30분(제안)과 [signed token 2시간](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)은 다르다. 발급 때 `upsert:false`를 지정하고 기존 객체는 덮어쓰지 않는다. [uploadToSignedUrl의 옵션 계약](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl)은 실제 token 변조·upsert 헤더 확대 공격 검증을 대신하지 않는다.

[TUS upload URL은 최대 24시간](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)이며 첫 MVP에서 발급하지 않는다. 이미 시작한 standard 요청도 토큰 만료와 동시에 취소됐다고 가정하지 않는다. GC의 `not_before=capabilityDeadline+5분`은 **최소 대기 조건일 뿐 삭제 허가가 아니다**. provider의 진행 중 요청 종료 조건이 확인되거나 해당 전송/worker의 종료를 안전하게 입증하지 못하면 정리 보류다. 원격 GC는 초기 gate 기본 off로 제안한다.

## 4. 영속 데이터·권한·삭제

[SQL 초안](../tests/fixtures/design-upload-b2-draft.sql)은 배포 가능한 migration이 아니다. 테스트는 별도 schema `upload_b2_draft`를 사용하며, 실제 기존 자산·Composition SQL에 연결해 제약을 비교한다. 미래 운영 테이블명/schema 노출/migration 번호는 승인 시 확정한다.

| 내부 테이블 | 주요 계약 |
| --- | --- |
| sessions | UUID PK; UNIQUE(project,actor,requestKey); immutable allowlist intent/hash; MIME·size·policy; 고정 temp 경로; generation별 final 경로; phase/lease/deadline; 검증 요약; receipt; asset/project 삭제 시각 |
| cleanup_jobs | session·generation·bucket/path·사유·not_before·정리 상태; UNIQUE(bucket,path). 이전 worker 출력과 여러 객체를 별도로 추적하기 위한 내부 manifest이며 별도 자산 테이블이 아님 |

세션은 기존 `auth.users`가 아닌 HMAC actor 문자열 ID를 저장한다. request digest는 SQL이 버전이 있는 허용 배열을 정규화해 계산한다. Node JSON 직렬화 해시와 같다고 가정하지 않는다. 같은 key/같은 입력은 같은 세션, 다른 입력은 PT409다. 바이트가 같아도 다른 key의 자산을 자동 합치지 않는다.

입력·receipt 변경 보호 trigger, 상태 CHECK, byte 1..10MiB, 해시 형식, MIME/type allowlist를 둔다. project/created 및 만료·정리 부분 인덱스를 제안한다. 일반 서버에는 새 이력 테이블 DELETE 권한을 주지 않으며 receipt/tombstone 보존·장기 purge는 별도 유지보수 계약이다. anon/authenticated ACL 회수와 RLS 활성화를 각각 적용하고, 로컬 함수는 SECURITY INVOKER·고정 `search_path=pg_catalog`·완전 수식 테이블명을 사용했다. 실제 service_role 상속·공용 schema default grant는 아직 원격 검증하지 않았다.

### 프로젝트·자산 삭제

단순 project CASCADE FK는 cleanup 경로를 잃게 하고 RESTRICT는 기존 삭제를 깨뜨린다. 따라서 **세션/manifest에 cascade FK를 두지 않고**, prepare/claim/commit에서 프로젝트를 잠가 존재·소속·삭제 상태를 확인하는 초안을 선택했다. assetId도 receipt와 함께 역사적 식별자로 남기며 자산 삭제에 따라 receipt를 지우지 않는다.

- 현재 [프로젝트 DELETE](../src/app/api/projects/route.ts)는 [archiveNewsletterProject](../src/lib/newsletter-repository.ts)를 통해 status=archived와 deleted_at을 PATCH하는 soft delete다. 신규 확정 시 deleted_at/archived를 다시 확인한다. 미확정 객체는 만료 처리로 정리 후보에 들어가며 soft delete만으로 기존 파일을 즉시 제거하지 않는다.
- 운영 계약 초안에는 향후 raw hard delete/cascade에 대비한 **새 lifecycle trigger**를 포함했다. 프로젝트/자산이 삭제되면 이력은 보존하고 cleanup manifest만 남긴다. 기존 함수/RPC/Storage 삭제를 실행하는 trigger가 아니다. 이 trigger를 실제 기존 테이블에 추가하는 행위는 별도 migration 승인·전체 삭제 회귀 대상이다.
- 자산의 기존 비로고 삭제는 DB 성공 후 파일 삭제다. 기존 Composition FK를 유지한다. 새 manifest가 기존 성공한 파일 삭제를 다시 만나면 404도 정리 완료로 취급하되 다른 참조/소속을 먼저 확인해야 한다. 이번에는 실제 cleanup 실행 함수를 구현하지 않았다.
- 원본 로고와 일반 파일 삭제의 Storage-first 흐름은 이번 대상 밖이다. DB 실패 시 파일이 먼저 지워지는 위험을 새 큐가 해결했다고 보고하지 않는다. generic project-file API의 kind별 고정 버킷/기록 검증과 새 경로가 섞이지 않도록 유지한다.

## 5. 상태·원자성·잠금

`prepared → verifying → stored → registered`; 별도로 rejected/cancelled/expired. registered는 receipt가 존재하고 바뀌지 않는다. 등록 후 자산 삭제·비활성화에 대한 재시도가 자산을 생성/활성화하지 않는다. status API는 receipt의 역사적 성공과 현재 자산의 같은 프로젝트 내 존재/상태를 따로 표시해야 한다.

| 연산 | 초안 의미 |
| --- | --- |
| prepare | 앱 인증·origin·프로젝트 잠금 검사 후 영속 intent를 만들고 그 뒤에만 token 발급. 같은 requestKey 발급 응답 유실 복구 |
| reserve_capability | 같은 세션의 token 발급 시도 전 deadline을 영속적으로 확보. prepared/intent 유효 상태에서 최대 3회, 검증 시작 후 재발급 거절. 외부 발급 실패도 횟수를 소모하며 자동 무한 재시도 없음 |
| claim | 프로젝트 SHARE → 존재하는 자산 UPDATE → 세션 UPDATE 순으로 잠금. worker generation/60초 lease 발급. 오래된 출력 경로는 정리 manifest로 추적 |
| mark_stored | 서버 verifier가 실제 바이트·hash·MIME·디코딩·출력 재다운로드 검증을 마친 후에만 내부 proof 기록. proof는 허용 필드만 저장 |
| commit_asset | 권한·프로젝트 삭제·세션 lease/generation 재확인 후 기존 자산 INSERT와 receipt를 단일 DB commit. Storage 작업은 이미 별도 수행한 상태 |
| expire | 활성 lease/등록 receipt를 보존하고 만료 세션을 fence, 객체 정리 후보만 기록. 직접 파일 삭제 없음 |

네트워크 I/O 동안 DB 잠금을 유지하지 않는다. lease takeover 때 이전 worker의 Storage 업로드가 실제로 멈추는 것은 아니므로 출력 경로를 generation별로 분리한다. stale worker의 DB 확정은 거절하고 이미 생긴 객체는 보수적으로 남겨 복구한다.

capability 예약은 provider의 시계/진행 중 요청을 입증하지 않는다. 발급 호출의 허용 시간 안에 완료하지 못하면 새 token을 브라우저에 전달하지 않고 결과 확인으로 돌린다. 만료된 세션의 prepare 결과를 조회했다고 새 token을 발급하면 안 된다. 실제 provider TTL/재발급·응답 유실은 원격 검증 전 차단 사항이다.

기존 writer 전체가 같은 advisory lock을 따르는 것으로 가정하지 않는다. [PostgreSQL의 행 잠금·교착 처리](https://www.postgresql.org/docs/17/explicit-locking.html)를 사용하며 실제 기존 row UPDATE/DELETE/FK와의 대기를 테스트했다. 실제 40001/40P01은 업무상 PT409로 덮어쓰지 않는다. 중단된 트랜잭션은 rollback하고 동일 requestKey 결과 조회 후 제한적으로 재시도한다. 모든 writer/관리자 직접 SQL에 대한 무교착 보장은 아직 하지 않는다.

## 6. 실제 PostgreSQL 다중 연결 결과

[테스트](../tests/design-upload-b2-postgres.test.cjs)는 PGlite가 아닌 **PostgreSQL 17.11**을 실행한다. 임시 DB와 private Unix socket만 사용하고 TCP listen은 껐다. 서로 다른 backend PID를 가진 연결들의 `pg_blocking_pids()`로 실제 대기를 확인했다. 테스트 종료 시 연결·서버·임시 데이터는 정리된다. 시스템 서비스로 등록하지 않았다.

로컬 도구는 Homebrew PostgreSQL 17과 저장소 밖의 pg 8.16.3을 사용했다. Homebrew 설치 과정에서 기본 로컬 클러스터 디렉터리도 생성되지만 사용/기동하지 않았으며 테스트는 별도 임시 클러스터에서만 수행했다. 운영 DB 접속 정보나 앱 환경 파일은 테스트에 읽어 들이지 않는다.

기존 v1.15/22/23/25/26/32 SQL을 수정 없이 로컬에 로드했다. 프로젝트/기사/버킷은 최소 bootstrap이며, 기존 REST/UI/발행 RPC 전체 환경이나 원격 Supabase는 아니다. 기존 writer 검증은 같은 자산 테이블의 INSERT/PATCH 상당 UPDATE/DELETE, 프로젝트 soft/hard delete, 기존 Composition trigger/FK에 한정한다.

검증 항목:

- 동시 같은 key prepare 1세션, 다른 입력 PT409; 다른 프로젝트/소유자/형식/검증 불일치 거절.
- token 재발급 예약 횟수 제한, 검증 시작 이후 재발급 거절. 실제 token은 발급하지 않음.
- 동시 finalize 1자산·1receipt; commit 결과를 버리고 연결을 닫은 뒤 다른 연결에서 복구. 실제 패킷 손실 프록시는 사용하지 않았다.
- asset+receipt rollback 후 재시도; lease takeover 뒤 stale worker 거절 및 이전 출력 manifest.
- expire/commit 양방향 순서, 프로젝트 hard delete/commit 양방향 순서, soft delete/archived/담당자 변경 뒤 stale 확정 거절.
- 기존 자산 PATCH 이후 receipt 재요청이 이름·승인·active 값을 덮어쓰지 않음; DELETE 이후 receipt 재요청이 자산을 되살리지 않음; 기존 POST 상당 INSERT 공존.
- 실제 **DEFERRABLE INITIALLY DEFERRED** Composition FK: 삭제가 먼저 확정되면 대기하던 새 배치 commit이 23503, 이미 확정된 배치가 있으면 DELETE commit이 23503. 후자의 cleanup journal도 rollback. INSERT 시점에 FK 검사가 끝났다고 가정하지 않음.
- 비서버 ACL 42501, 함수의 no SECURITY DEFINER/search_path, immutable intent/receipt, 서버의 세션 DELETE 거절.

재현 예시(앱 의존성 변경 없음):

```sh
# PostgreSQL 17 바이너리는 별도 설치. brew services start는 사용하지 않음.
npm install --prefix /private/tmp/design-upload-b2-runtime --no-audit --no-fund pg@8.16.3
DESIGN_UPLOAD_B2_PG_BIN=/opt/homebrew/opt/postgresql@17/bin DESIGN_UPLOAD_B2_PG_RUNTIME=/private/tmp/design-upload-b2-runtime/node_modules/pg node --test tests/design-upload-b2-postgres.test.cjs
```

SQL 파일은 테스트용 DB 이름/GUC 가드가 없으면 거절한다. 이 가드는 원격 사용 허가나 보안 경계가 아니다. `supabase/` 밖에 있고 앱/배포에서 실행하지 않는다.

## 7. 파일 검증·Sharp·자원

신규 경로의 제안 상한은 입력 10MiB, 각 축 8192 이하, 총 16Mpixel, 단일 프레임이다. 기존 업로드의 허용치를 바꾸지 않는다. 클라이언트 MIME/size, Storage metadata/HEAD만으로 통과시키지 않는다. 서버 bounded stream에서 byte count/SHA256 → magic/MIME 일치 → 실제 디코더 metadata와 full decode → server-only 출력 저장/no-upsert/재다운로드 hash 순서로 검증한다.

첫 MVP는 원본 바이트를 보존하며 임의 재인코딩·EXIF 제거·방향/색·품질 변환을 하지 않는다. metadata는 신뢰 자료가 아니며, 저장할 검증 요약만 allowlist한다. SVG/XML·다중 프레임/애니메이션은 거절한다. 손상 파일 corpus와 악의적 metadata의 추가 검증은 필요하다.

현재 main은 Next 16.3.4의 optional dependency로 Sharp 0.35.4를 포함한다. lockfile에는 Linux x64/arm64 패키지가 있지만 **이번 실행은 Node 26.3.0 / macOS arm64**다. B-3에서 공식 Sharp를 직접 운영 의존성으로 선언하고 Node runtime·native binary·Linux Preview 실제 실행을 검증해야 한다. Next 내부 image-optimizer 모듈이나 C1 코드를 가져오지 않는다.

[로컬 budget probe](../tests/design-upload-b2-image-budget.test.cjs)는 각 형식 4000×4000 단색 합성 이미지를 별도 child에서 full decode했다. 단일 측정 예시는 다음과 같다. 실제 사진·악의적 데이터·Vercel 성능 기준이나 hard memory 상한이 아니다.

| 형식 | 입력 bytes | decode 경과 ms | CPU ms | child peak RSS KiB |
| --- | ---: | ---: | ---: | ---: |
| PNG | 224454 | 63 | 221 | 130896 |
| JPEG | 94019 | 69 | 231 | 130688 |
| WebP | 28522 | 105 | 277 | 319680 |

작은 압축 파일도 수백 MB 메모리를 쓸 수 있다. 4096×4096 단색 PNG가 바이트 제한 이내여도 pixel 상한으로 거절되는 것을 확인했다. JS loop child의 deadline/SIGKILL은 로컬에서 확인했지만 실제 native decoder hang corpus나 Vercel에서의 child 격리·종료는 미검증이다.

B-3 권고: 한 Function 인스턴스당 decode 동시 1, 승인된 제한 queue/요청 rate·세션 바이트 quota, bounded read와 별도 decode deadline. 현재 60초 DB lease를 초과하는 작업은 같은 generation으로 조용히 계속하지 않는다. CPU/RSS hard limit·native 취소를 보장할 수 없는 배포 환경이면 pixel/byte 상한을 더 낮추거나 해당 경로를 활성화하지 않는다. 표의 수치만으로 10MiB 모든 이미지의 안정성을 보장하지 않는다.

Sharp의 concurrency/cache 같은 전역 설정을 기존 앱 프로세스에 무차별 적용하지 않는다. 별도 verifier worker 안에서 제한을 검증해야 기존 이미지 전달/확대보기/C1과의 영향을 분리할 수 있다.

## 8. B-3 변경 파일과 기존 계약 보호

예상 신규 파일은 `project-design-kit/uploads/{prepare,finalize,status}`의 JSON route, server-only session repository/Storage adapter/verifier/복구 모듈, 승인 후 migration 및 통합 테스트다. 구체 route명·schema 노출은 B-3에서 확정한다. 이번에 생성하지 않았다.

- [기존 제작 API](../src/app/api/project-design-kit/assets/route.ts), [쓰기 helper](../src/lib/project-design-asset-write.ts): POST/PATCH/DELETE 응답·승인·기존 active 기본값 유지. 기존 endpoint를 직접 업로드로 몰래 교체하지 않는다.
- [프로젝트 접근](../src/lib/project-api-access.ts), [same-origin helper](../src/lib/article-image-api-origin.ts): 기존 HMAC·담당자·프로젝트 잠금 재사용. SQL의 actor JSON은 로그인 증명이 아니며 서버에서 신뢰한 사용자만 구성해야 한다. status도 매번 권한 검사, 다른 프로젝트 현재 자산 정보를 receipt로 유출하지 않음.
- Composition 참조·ready/visible·공개 reader 승인 필터는 유지. 새 자산은 자동 배치하지 않는다. 기존 글꼴/기사 본문/발행 상태는 건드리지 않는다.
- C1 #248: `assets/route.ts`, `newsletter-file-storage.ts`, `supabase-config.ts`, `image-delivery-server.ts`, TTS 및 package/lock과 접점. C1의 preservation 버킷/prefix를 쓰지 않고 namespace 과잉 차단 결함도 이번에 고치지 않는다. Sharp 직접 의존성 추가 전 C1과 재비교 필요.
- #255 전체 디자인 복사의 project/asset ID 검증과 독립적이다. upload session을 복사 RPC에 섞거나 프로젝트 경계를 풀지 않는다. 둘 모두 원격 적용 전 같은 자산 생명주기·삭제 경합을 재검증해야 한다.

## 9. 원격 적용 전 차단 조건

1. 신규 두 테이블·새 lifecycle trigger·권한·보존 기간·purge 및 프로젝트 hard delete 대응에 대한 별도 migration 승인/복구 계획. draft SQL을 그대로 원격 적용하지 않음.
2. 전용 private 버킷 생성/제한/ACL 승인, 실제 object RLS·역할 상속·프록시 우회 차단 검증. Production/Staging 분리와 백업·복구 확인.
3. signed token의 정확한 경로 범위·헤더 변조·upsert·전송 중 만료/응답 유실을 Staging에서 실측. 확인 전 GC gate off. TUS는 별도 구현·승인.
4. Linux/Vercel 공식 Sharp 실행, 악성/손상 PNG/JPEG/WebP corpus·메모리/CPU/동시 부하·timeout/child 종료 검증. 현재 로컬 측정은 참고치뿐.
5. 서버 prepare/finalize/status의 HMAC/origin/잠금·소유권·quota·토큰 redaction, 실제 Storage 성공/DB 실패/브라우저 응답 유실/worker 재시작 통합 테스트.
6. 실제 저장소의 늦은 객체·중복 전송·server final 객체 해시 검증, 참조 재확인·GC claim/fencing·삭제 후 404·재발급 replay 방지. cleanup manifest 기록을 실제 파일 회수 완료로 보고하지 않음.
7. 기존 전체 기사/폰트/미리보기/기관 검수/시연/정기호 회귀와 배포 복구 경로. 신규 UI 노출·remote gate 활성화는 별도 단계.

최종 선택 통합 검증은 **113/113 통과, skip 0**이다. 기존 A/B-1·관련 회귀 91개에 실제 PostgreSQL 21개(상위 테스트 포함), image budget probe 1개를 추가했다. 신규 CJS ESLint·문서 링크·diff check 통과. 앱 런타임 변경이 없으므로 전체 앱 build/TypeScript는 반복하지 않았다. 로컬 테스트 성공과 Vercel Preview 빌드·원격 업로드 E2E는 별개의 결과다.

B-2 결과는 로컬 계약 검증이며 운영 업로드 구현 완료가 아니다. 기존 OPEN PR·stash와 실제 기사/파일은 보존하며, 이 PR은 병합하지 않는다.
