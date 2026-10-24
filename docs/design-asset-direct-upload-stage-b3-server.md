# 제작 자산 직접 업로드 B-3 — 기본 OFF 서버 기반

기준 main: PR #259 merge `88739500c604349664b71db44942e242c5301d50`.
[B-2 계약](design-asset-direct-upload-stage-b2-contract.md)을 실제 서버 모듈과 migration **파일**로 구현했다. Production/Staging migration·버킷 생성·설정 변경·실제 업로드는 수행하지 않았다. UI와 기존 업로드 API는 변경하지 않았다.

## 1. 선행 병합과 실제 schema 사전 확인

PR #259 지정 head `8ab315f0526b3ad6b62c342b334f519e6fe8dd41`, 문서/격리 SQL/테스트 4개 파일, OPEN/MERGEABLE/Vercel SUCCESS와 113/113·skip 0을 확인해 merge commit 병합했다. 동일 merge SHA의 Production 배포/도메인을 확인했다.

Supabase Production `qmhvlbpedudpwtznletj`, Staging `mvrkpmffuhcqwisqvpqi`에서 catalog SELECT만 실행했다. 사용자/기사 데이터·비밀값을 조회하지 않았다. 결과:

- 컬럼 타입/nullable/default 의미, 관련 FK·CHECK·trigger 함수 signature/hash, RLS·역할 속성은 두 환경에서 동일. 프로젝트 컬럼 순서와 PostgreSQL patch version(17.6/17.11)은 다르다.
- 기존 자산 project FK는 CASCADE, parent FK는 SET NULL. Composition→자산 FK는 NO ACTION, DEFERRABLE INITIALLY DEFERRED. 현재 SQL과 일치한다.
- v1.24 처리 이력 input/output→자산 FK는 SET NULL, project/type 변경 보호 trigger도 존재한다. B-2 최소 fixture에 빠진 이 제약을 이번 migration 테스트에 추가했다. 운영 schema를 임의 보정하지 않았다.
- service_role의 기존 관련 테이블 CRUD 및 BYPASSRLS를 확인했다. 자산/프로젝트에는 anon/authenticated SELECT grant가 있고 RLS는 활성화돼 있다. 이 grant만으로 실제 익명 데이터 노출을 판정하지 않았으며, 기존 권한은 변경하지 않았다.
- 신규 upload session/cleanup 테이블은 아직 없다. 실제 object RLS/CORS·provider 요청 만료·업로드 동작은 조회만으로 검증되지 않았다.

## 2. 동작과 기본 OFF

서버 환경변수 `DESIGN_ASSET_DIRECT_UPLOAD_ENABLED`가 정확히 `true`일 때만 동작한다. 미설정/false는 기본 **404 disabled / private,no-store**다. 환경변수 파일이나 Vercel 값을 변경하지 않았다. OFF 검사 전에 사용자 조회, DB/Storage 호출, verifier 실행을 하지 않는다. 서비스 모듈도 OFF를 재검사한다.

| 새 경로 | 입력/결과 |
| --- | --- |
| `POST /api/project-design-kit/uploads/prepare` | projectId/requestKey/fileName/assetType/mime/size/sha256만 허용. UUID·NFC 이름·확장자·종류·크기 검증. 세션을 영속 생성한 뒤 제한된 PUT URL 반환 |
| `GET /api/project-design-kit/uploads/status` | projectId + sessionId 또는 requestKey. 응답 유실 시 세션/receipt 조회. 파일 경로·검증 내부값·토큰을 반환하지 않음 |
| `POST /api/project-design-kit/uploads/finalize` | projectId/sessionId. source 바이트 검증→generation 출력 보존→출력 재읽기→proof→DB asset/receipt 확정 |

기존 HMAC 사용자와 `requireProjectApiAccess`의 담당자/관리자·프로젝트 잠금 검사, 기존 same-origin 검사를 재사용한다. POST는 Origin 필수, GET은 Origin 또는 브라우저의 `Sec-Fetch-Site:same-origin`을 통해 기존 host/proto 검사에 연결한다. cross-site 조회나 임의 actor/role/bucket/path 필드는 허용하지 않는다. JSON 본문은 스트림에서 4KiB까지만 읽는다.

등록 결과는 draft/inactive, 자동 승인·배치·발행 없음이다. 기존 POST의 active 기본값과 PATCH/DELETE, Composition ready/visible·공개 승인 조건은 그대로다. 저장 결과와 현재 자산 존재 여부는 구분한다. 삭제된 자산을 receipt 재시도로 다시 만들지 않는다.

## 3. 파일·Storage 경계

지원: 단건 PNG/JPEG/WebP, 1..10MiB, 8bit·채널 4 이하·단일 프레임, 각 축 8192 이하/총 16Mpixel. SVG·로고·AI/PSD/EPS/PDF·원본·일괄은 제외한다. APNG/WebP animation도 거절한다. 기존 API의 허용 범위를 축소한 것이 아니라 새 경로의 첫 검증 정책이다.

전용 private `design-upload-quarantine`(미생성)을 요구하며 private production 버킷으로만 final을 저장한다. adapter는 버킷 존재·private·10MiB 상한·MIME을 확인하고 불일치 시 거절한다. 자동 버킷 생성/수정은 없다. signed URL은 정확한 origin/path/token만 허용하고 `upsert:false`로 발급한다. service key는 서버 헤더에만 사용하며 capability는 준비 요청의 응답으로만 전달한다. 로그·분석 이벤트·DB에 토큰을 기록하지 않는다.

- temp: `projects/<project>/design-upload-v1/<session>/input.<ext>`
- final: `projects/<project>/production/<type>/direct-v1/<session>/<generation>.<ext>`

MIME header만 믿지 않는다. bounded read로 실제 크기/SHA256을 확인하고 공식 Sharp의 metadata+full decode를 실행한다. metadata-only 검증, 자동 축약/재인코딩/EXIF 제거는 하지 않는다. 출력도 다시 읽어 동일 바이트인지 확인한 뒤 DB 등록한다. 기존 객체 충돌은 덮어쓰지 않으며 원격 오류를 임의 rollback으로 안내하지 않는다.

## 4. 자원 제한·배포 제약

Sharp 0.35.4를 명시적 운영 의존성으로 추가했다. 기존 Next optional dependency 및 C1 PR과 같은 버전이며 버전을 올리지 않았다. C1 코드를 복사하지 않았다.

verifier는 credential 없는 별도 Node child에서 Sharp concurrency=1/cache=false로 디코딩한다. 앱 전체 Sharp 설정은 바꾸지 않는다. 한 인스턴스에서 동시에 두 decode를 시작하면 pending으로 거절한다. child 8초 SIGKILL, 파일 I/O별 8초, 전체 요청 45초, DB lease 60초 및 worker generation 최대 3회다. child의 비정상 종료/리소스 문제는 파일 불량으로 단정하지 않는다.

Webpack trace에 Sharp/native 라이브러리가 포함되는 것을 확인했다. `createRequire`는 Next가 추적 가능한 `import.meta.url` 형태를 사용한다. 테스트 loader의 해당 URL 처리만 보강했다. **Linux/Vercel에서 flag ON child 실행·hard RSS 상한·native hang corpus는 미검증**이다. 로컬 timeout/byte/pixel 상한이 배포 환경의 메모리 안전성을 입증하지 않으므로 이 검증 전 Staging gate 활성화도 별도 승인이 필요하다.

## 5. migration 파일과 복구

[v1.41 파일](../supabase/schema_v1_41_design_asset_direct_upload.sql)은 아직 원격에 적용하지 않았다. 전용 private DB schema의 sessions/cleanup_jobs, 상태·immutable intent/receipt·고유 requestKey, service-only RPC 7개와 내부 함수, 삭제 journal trigger를 추가하는 안이다. 기존 자산 테이블·발행 RPC·Storage 정책/버킷은 수정하지 않는다. 기존 테이블의 **AFTER DELETE trigger 2개 추가**는 실제 적용 전 별도 검토/승인 대상이다.

RPC는 service-only EXECUTE, SECURITY INVOKER, 고정 search_path 및 완전 수식 테이블명을 사용한다. actor JSON은 인증 수단이 아니며 API가 기존 HMAC 인증 결과에서만 구성한다. 신규 schema의 anon/authenticated ACL을 회수하고 두 테이블 RLS를 활성화한다. 기존 테이블 ACL은 변경하지 않는다.

- prepare는 프로젝트를 잠가 quota/중복을 직렬화한다. 프로젝트당 활성 세션 최대 8개, 최근 24시간 생성 최대 20개를 제안 구현했다. 기존 업로드 제한을 변경하지 않는다.
- token 발급 예약 최대 3회, 앱 intent 30분과 token 수명을 구분한다. provider 호출 전 보수적인 deadline을 남긴다. 이것이 진행 중 전송 종료를 보장하지 않는다.
- 자산 INSERT/receipt는 한 DB 트랜잭션이다. Storage 성공 후 DB 실패면 객체를 남기고 상태를 조회한다. stored 응답 유실 시 출력 해시를 재검증해 확정한다. registered 응답 유실은 receipt 재사용이다.
- lease takeover는 다른 generation 경로를 사용해 늦은 worker가 현재 공개 경로를 덮어쓰지 않게 한다. 오류·삭제·만료는 cleanup 후보만 기록한다.
- **Storage DELETE/자동 GC 구현과 cron은 없다.** provider 만료·진행 중 전송·late object 안전성이 검증되기 전 파일 정리를 활성화하지 않는다.
- 프로젝트/자산 FK로 receipt를 cascade 삭제하지 않는다. 기존 자산 삭제 및 hard project delete 후에도 이력/정리 경로를 보존한다. 실제 프로젝트 DELETE API는 기존 soft archive를 유지한다.

적용 전 prerequisites가 다르면 transaction을 중단하도록 작성했다. 재실행으로 덮어쓰는 migration이 아니다. 실제 적용 뒤 문제가 생기면 gate를 OFF하고 ledger/파일을 보존한다. schema DROP·파일 삭제 같은 파괴적 rollback은 자동 수행하지 않는다. v1.41 번호는 향후 미병합 migration과 충돌하지 않는지 실제 적용 직전에 다시 확인한다.

## 6. 검증과 한계

- 선행 PR #259: 113/113·skip 0 재확인 후 병합.
- 전체 회귀: **616/616 통과, skip 0**. 신규 서버/route/실제 child 검증 14개 포함.
- 운영 migration을 사용하는 실제 PostgreSQL 다중 연결: 23개(상위 포함) 통과. v1.24 FK/guard, service-only wrappers, requestKey 상태 조회, quota, proof allowlist, 기존 writer/Composition/삭제 경합 및 미등록 ID 충돌 시 기존 파일의 오정리 방지를 포함한다.
- Storage adapter는 모의 fetch로 경로·버킷·upsert·실패·응답 유실을 검증했다. 실제 원격 업로드 성공으로 보고하지 않는다. 실제 SQL 테스트의 DB 복구와 모의 Storage 테스트는 별도 검증이다.
- TypeScript·Webpack build·diff check 통과. 최초 createRequire build 경고를 수정해 최종 build에는 신규 경고가 없다. lint 오류 0, 기존 경고 3개 유지.
- 빌드된 로컬 서버에서 새 API 3개 OFF→404/no-store 확인. 기존 운영 기사·파일을 수정하지 않았다. Preview는 기본 OFF 상태의 배포만 확인하며 ON 업로드 E2E는 실시하지 않는다.

SQL 재현: 기존 B-2 PostgreSQL 명령에 `DESIGN_UPLOAD_B3_MIGRATION_TEST=1`을 추가하면 v1.41과 v1.24 포함 환경을 검증한다. 운영 환경 파일/비밀키를 테스트 실행기에 전달하지 않는다.

## 7. 보존·Staging 전 필수 승인

변경은 신규 uploads 경로, 전용 contract/route/server/storage/verifier 모듈, v1.41 파일, 테스트·문서·Sharp 직접 의존성이다. 기존 assets POST/PATCH/DELETE, newsletter-file-storage, image-delivery, reader, Composition, 기사 저장·폰트·TTS·발행 코드는 변경하지 않았다. C1과 겹치는 것은 package/lock의 Sharp 의존성뿐이며 향후 병합 시 재비교해야 한다. #255 전체 디자인 복사와 upload session은 연결하지 않는다.

다음은 아직 승인/검증 전이다:

1. Staging migration 적용 및 새 삭제 journal trigger·신규 권한·백업/복구 검토.
2. 전용 quarantine 버킷 생성/MIME·크기·실제 RLS/ACL·서비스 권한 승인. 기존 production 버킷은 임의 변경하지 않음.
3. 고정 Staging 배포·기능 gate의 제한적 활성화, quota/상한 운영 수치 확인.
4. 실제 signed token/upsert/다른 프로젝트·전송 중 만료·응답 유실·CORS·Linux child·메모리/부하 E2E.
5. 기존 글꼴/기사/Composition/처리 이력·승인·공개 reader 회귀와 실제 파일 접근 차단 확인.
6. GC는 별도 설계·검증·승인. 기존 파일이나 보존 namespace를 자동 정리하지 않음.

B-3 PR은 OPEN으로 유지하고 병합하지 않는다. 실제 기사/프로젝트/DB/Storage 데이터·인증·환경변수 설정은 변경하지 않았다.
