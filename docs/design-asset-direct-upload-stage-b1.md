# 제작 자산 직접 업로드 Stage B-1 — 사전 검증

기준 main: `88a1237fc78b53983e976515da5183e0f1cd5585` (PR #257 merge, 2026-10-24).
[Stage A](design-asset-direct-upload-stage-a.md)의 후속이다. 운영 API/UI, 원격 DB/Storage, 버킷·인증 설정은 변경하지 않았다. SQL은 `tests/fixtures/`의 로컬 계약 표본이며 migration이 아니다.

## 1. PR #257 병합 및 재확인

- 지정 head `3dc7e7361eda60bd4d18fd2eb555e8cb511dde97`, OPEN/MERGEABLE, Vercel SUCCESS, 문서 1개·격리 CJS 2개만 확인 후 merge commit 병합.
- 최초 재실행: 총 74개 중 73 통과, 1 skip. `CANVA_SQL_TEST_RUNTIME` 미지정으로 기존 Composition SQL 테스트를 건너뛴 것이다. 기능 실패가 아니다.
- 이번 B-1에서 외부 임시 디렉터리에 PGlite 0.3.14를 준비하고 같은 테스트도 실행해 skip을 해소했다. 앱 의존성·lockfile은 변경하지 않았다.
- [Production 배포](https://vercel.com/joseph-park-s-projects/mobile_newsletter_studio/5d6SfhDm8cfpVe138nz7TLu8qSrq): Ready / Latest / Current Domains에 운영 도메인, Source SHA가 위 merge SHA임을 대시보드에서 확인. 배포·승격 설정을 조작하지 않았다.

## 2. 공식 Supabase 계약과 확인 범위

| 방식 | 인증·전송 | 이번 판정 |
| --- | --- | --- |
| 일반 upload | 호출자 JWT와 Storage INSERT 권한으로 객체 전송. 앱 HMAC 쿠키는 Supabase JWT가 아님 | service_role을 브라우저에 전달하는 방식 금지 |
| signed upload | 서버가 특정 bucket/path의 제한된 bearer token 발급, 브라우저는 해당 토큰으로 전송 | [공식 문서](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)상 2시간. 발급 전 앱 로그인·프로젝트·잠금 검사 필수 |
| uploadToSignedUrl | 사전 발급한 경로·토큰으로 업로드, 다시 일반 사용자 권한을 전달하지 않음 | [upsert 설정은 발급 시 결정](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl). 임의 클라이언트 헤더의 확대 허용 여부는 실제 공격형 테스트 전 미확인 |
| TUS | 대용량/불안정 네트워크의 chunk 재개. signed token을 `x-signature`로 사용 가능 | [공식 안내](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) 기준 6MB 초과 권고, chunk 6MiB, Storage 전용 호스트 권고. 이번에는 TUS 전송 안 함 |

TUS는 같은 upload URL 동시 전송 및 같은 경로의 다른 upload URL 경합에서 충돌을 반환한다. 이는 **자산 DB 중복 등록 방지**를 대신하지 않는다. `upsert:false`는 해당 경로의 기존 객체 덮어쓰기를 막는 계약이지 다른 키·다른 경로의 동일 바이트 등록 방지, 파일 무해성, 장기 불변성 보장이 아니다. service_role의 다른 삭제·upsert 경로는 별도 통제가 필요하다.

### 수명과 완료 판단 — Stage A의 추가 보완

앱 intent 30분(제안), signed token 2시간, TUS upload URL은 최대 24시간이라는 서로 다른 수명을 갖는다. **토큰 2시간+5분만 기다리면 모든 전송이 종료됐다고 가정하면 안 된다.** 토큰 만료 후 기존 TUS PATCH/HEAD 및 진행 중 요청의 정확한 거절 시점은 환경에서 확인해야 한다. 서버가 알지 못하는 늦은 전송 가능성이 있으면 GC를 보류한다.

`upload` 성공 응답, TUS 최종 offset/length 또는 객체 HEAD는 전송 결과 단서다. 어느 것도 검증·자산 등록 성공이 아니다. 끊긴 전송은 같은 세션의 상태를 먼저 조회하고 재개한다. 완료 여부가 불명확할 때 새 requestKey로 자동 재업로드하지 않는다. TUS URL/fingerprint도 토큰처럼 로그·분석·trace에서 제외하고 성공/만료 후 안전하게 정리한다.

파일 크기는 [프로젝트 전역 상한과 버킷 상한](https://supabase.com/docs/guides/storage/uploads/file-limits), 서버 정책 상한을 모두 만족해야 한다. 버킷 MIME 제한은 클라이언트가 신고한 타입과 실제 디코딩 검증을 동일하게 만드는 보장이 아니다. 최대 요금제 수치나 전송 프로토콜 상한을 이 앱의 지원 용량으로 표시하지 않는다.

## 3. 실제 읽기 전용 설정 조회

로컬 환경 파일이 가리키는 Production ref `qmhvlbpedudpwtznletj`, Staging ref `mvrkpmffuhcqwisqvpqi`에 service-role 인증 GET `/storage/v1/bucket`만 요청했다. 파일 목록/바이트를 읽거나 업로드하지 않았다. 비밀값은 출력·기록하지 않았다. 이 조회가 현재 Vercel의 모든 환경변수 범위까지 검증한 것은 아니다.

| 버킷 | 두 환경 실제 public | 파일 상한 | 허용 MIME |
| --- | --- | --- | --- |
| brand-assets | true | 5MiB | PNG/JPEG/WebP |
| design-intake-assets | false | 50MiB | PDF/PostScript/octet-stream/SVG/PSD/PNG/JPEG/WebP |
| design-production-assets | false | 10MiB | SVG/PNG/JPEG/WebP |

로고 API가 허용하는 SVG와 실제 brand-assets MIME 제한 사이에 차이가 있다. 이번 작업에서 SVG 업로드를 시도하거나 설정을 바꾸지 않았다. 신규 경로에 로고/SVG를 포함시키지 않는 이유다.

**미확인:** 요금제·사용량·전역 파일 제한·실제 Storage object 정책/RLS/grants/역할 상속·signed token의 변조/만료/경합 실효성·백업 복구. private 설정과 service-role GET 성공만으로 anon 접근 차단 전체를 입증하지 않는다. 실제 권한 조회/최소 권한 검증은 원격 적용 전 필요하다. 이번 원격 쓰기 검증은 0건이다.

## 4. 영속 세션 권장 데이터 계약

새 테이블명은 제안이며 아직 운영 테이블이 아니다. 서버 내부 세션 한 종류와 기존 자산 테이블을 사용한다. Storage를 DB 트랜잭션 안에서 원자적으로 변경한다고 가정하지 않는다.

| 필드 묶음 | 제안 제약/인덱스 |
| --- | --- |
| session UUID, project UUID, actor ID, request UUID, intent digest | PK session, UNIQUE(project,actor,request). actor는 기존 HMAC 사용자의 문자열 ID이며 auth.users FK를 임의 추가하지 않음 |
| 허용 입력 JSON/policyVersion | 정렬된 허용 필드 기반 canonical hash. 같은 key·다른 입력 PT409, 이전 입력을 덮어쓰지 않음 |
| temp bucket/path, final bucket/path, generation별 작업 경로 | UNIQUE(bucket,path), 서버 UUID 생성, 클라이언트 path 무시. type/parent/project 조합 재검사 |
| 기대 hash/size/MIME, 검증 hash/size/MIME/width/height | size 양수·정책 상한, SHA256 형식, 허용 MIME/format 일치. 구조 검사와 실제 디코딩 둘 다 |
| state, generation, leaseUntil, intentExpires, transportDeadline, transportClosed | 상태 CHECK·단조 generation·lease fencing. transportClosed는 서버가 입증한 전송 종료, 클라이언트 주장 불가 |
| assetId, receipt, registeredAt, 오류 코드, cleanup 상태/재시도 시각 | assetId 세션별 고정. 등록 시 자산+receipt atomic commit. 등록 후 자산 삭제에도 receipt/tombstone 보존 |
| janitor 대상 | receipt 없는 상태의 transportDeadline/nextRetry 부분 인덱스. project/actor 생성일 조회 인덱스, 활성 세션 수·바이트 quota |

**FK/삭제 결정은 원격 적용 차단 항목이다.** assetId에 CASCADE FK를 걸면 자산 삭제가 idempotency 기록을 없애므로 금지한다. 단순 RESTRICT도 기존 삭제를 막는다. receipt에는 역사적 ID를 보존하고 조회 시 현재 자산 존재 상태를 별도로 표시하는 안을 권장한다. 프로젝트 FK를 RESTRICT로 추가하면 기존 프로젝트 삭제가 실패하고 CASCADE면 고아 객체 정리에 필요한 경로를 잃을 수 있다. 기존 삭제 프로세스에 cleanup manifest/세션 종료를 연결하는 계약을 먼저 확정해야 한다. 로컬 SQL은 이를 구현한 운영 schema가 아니다.

### 상태/경합

`prepared → verifying(lease/generation) → storage_ready → registered`; 거절/만료/정리 상태는 등록 성공과 구분한다. 저장소 결과 불명은 terminal failure가 아니다.

1. prepare는 사용자·origin·프로젝트 권한 검사 후 UNIQUE 키로 생성/기존 세션 반환. 서버가 계산한 digest 비교 후 capability 발급. 발급 응답 유실도 같은 세션으로 복구하고 무제한 토큰 연장을 금지한다.
2. finalize claim은 세션 row lock, 현재 상태·intent 만료 검사, generation 증가. Storage I/O 중 DB 트랜잭션을 장시간 열어두지 않는다.
3. 검증/서버 전용 final 쓰기는 해당 generation의 작업 경로에서 수행한다. hash 재검증 후 commit 트랜잭션에서 프로젝트→부모 자산→세션 등 전역 잠금 순서를 정하고 같은 권한/소속·generation·lease·상태를 다시 검사한다. 기존 삭제 RPC 잠금 순서와 deadlock 검증이 필요하다.
4. 자산 INSERT와 receipt 기록은 한 DB commit이다. 응답 유실은 receipt 재조회, 같은 key 재시도는 저장된 결과 반환. 이전 자산이 삭제/비활성화되었으면 복원하지 않는다.
5. GC는 lease fencing과 transport 종료 및 모든 참조를 재검사한다. DB에서 worker를 fence해도 이미 전송 중인 Storage 요청까지 취소되지는 않는다. generation별 출력과 복구 manifest, 미확인 객체의 보수적 보존이 필요하다. DB 접근 실패 시 삭제 금지.

권한은 서버 API에서 기존 HMAC·same-origin·프로젝트 담당자/잠금 검증, DB 내부에서 project/parent/asset FK와 상태/CAS 검증으로 나눈다. SQL 함수에 전달한 actor 문자열이 로그인 증명이 되는 것은 아니다. 향후 RPC는 service-only EXECUTE, 고정 search_path 및 최소 권한을 검토하며 비서버 테이블 ACL 회수와 RLS를 각각 적용해야 한다.

## 5. 로컬 SQL 검증 — 운영 RPC 구현 아님

[SQL 표본](../tests/fixtures/design-upload-b1-local.sql)은 가짜 schema/자산 테이블/역할만 사용한다. fixture GUC가 없으면 설치 거절. `supabase/`나 migration 폴더에 넣지 않았고 앱에서 import하지 않는다. 로컬 권한이 있는 사용자가 가드를 설정할 수 있으므로 원격 보안 경계라고 주장하지 않는다.

[테스트](../tests/design-upload-b1-sql.test.cjs)는 외부 임시 디렉터리의 PGlite 0.3.14로 실행했다. 요청 UNIQUE·크기/해시 CHECK, 중복 claim 거절, lease takeover 후 generation 차단, 자산/receipt rollback, 커밋 응답 유실 후 같은 결과, 파일 기반 DB 재시작 후 결과, 자산 삭제 후 부활 방지, transport 종료 전 GC 차단, 비서버 ACL 거절(42501)/서버 접근을 검증했다.

PGlite는 PostgreSQL 기반 임베디드 단일 실행 환경이다. 실제 다중 연결 lock 경합, 운영 FK, Supabase service_role/실제 HMAC 인증, Storage 성공/DB 실패의 원격 복구, janitor 실삭제를 검증한 것은 아니다. `commit_verified` 표본은 바이트 검증을 구현하지 않으므로 운영 사용 불가다.

재현(런타임은 저장소 밖에 설치):

```sh
npm install --prefix /private/tmp/design-upload-b1-runtime --no-audit --no-fund @electric-sql/pglite@0.3.14
DESIGN_UPLOAD_B1_SQL_RUNTIME=/private/tmp/design-upload-b1-runtime/node_modules/@electric-sql/pglite node --test tests/design-upload-b1-sql.test.cjs
```

## 6. 파일 검증·리소스·복구

| 방법 | 장점 | 한계/판정 |
| --- | --- | --- |
| 확장자·Storage metadata·HEAD | 작은 제어 요청/사전 필터 | 악의적 MIME·내용 판정 불가 |
| magic/hash/크기·PNG chunk/CRC | bytes 동일성·구조 손상 검출 | 디코딩·압축 폭탄·브라우저 호환성의 증거 아님 |
| 공식 Sharp metadata | 실제 format·폭/높이·pages 확인 | [metadata는 압축 픽셀을 디코딩하지 않음](https://sharp.pixelplumbing.com/api-input/) |
| 공식 Sharp full decode | PNG/JPEG/WebP 손상 검출·pixel 제한 가능 | [constructor](https://sharp.pixelplumbing.com/api-constructor/)의 `limitInputPixels`, `failOn:'warning'`, sequentialRead 등 명시. CPU/메모리/timeout 별도 제한 필요 |
| 재인코딩/메타데이터 제거 | EXIF 제거·정규화 가능 | hash/바이트·방향/색·품질 변경. 원본과 결과 hash를 분리하고 사용자 파일을 조용히 교체하지 않음 |

[이미지 실험](../tests/design-upload-b1-image.test.cjs): 현재 Next lockfile의 optional Sharp 0.35.4를 공식 API로만 사용, 앱 의존성 변경 없음. PNG/JPEG/WebP 합성 파일(32×24) 실제 decode, MIME/hash/크기 불일치, HTML/SVG 위장, metadata 통과 후 full decode 실패, pixel 상한 거절, EXIF 제거·회전 후 바이트 변경을 확인했다. C1 구현 코드는 사용하지 않았다. Stage B 실제 런타임 채택 시 sharp를 직접 의존성으로 선언하고 배포 native binary·취약점 업데이트 책임을 확보해야 한다.

입력 10MiB가 decode 메모리 10MiB라는 뜻은 아니다. 40Mpixel×4채널만 약 160MB이며 입력·복사·디코더 작업 메모리는 추가다. 병렬 3개를 그대로 서버 검증에 적용하지 않는다. bounded stream/byte 상한·timeout·pixel/channel/page 상한, 작업당 및 전체 동시성 제한과 process/container 리소스 제한이 필요하다. 작은 fixture 테스트로 RSS 상한·대용량 부하를 입증하지 않았다. timeout 후 native 작업이 즉시 중단되는지도 검증 전 미확인이다.

SVG는 외부 참조·스크립트·XML/CSS 위험 때문에 새 경로에서 거절한다. 애니메이션·다중 페이지, 특이 색공간·ICC·EXIF 방향, 손상 JPEG/WebP corpus는 후속 테스트가 필요하다. 실제 PNG/JPEG/WebP 검증을 곧 자산 승인으로 연결하지 않는다.

검증 후 server-only final 객체는 no-upsert 저장·재다운로드 hash 검증. DB 결과 불명 시 파일 즉시 삭제 금지. 같은 세션에서 조회/복구하고 최종 자산 ID를 재사용한다. canonical metadata/검증 policy version을 영속 기록하여 다른 정책으로 과거 receipt를 재해석하지 않는다. grace 경과만으로 모르는 Storage 객체를 전역 삭제하지 않는다.

## 7. 통합 영향·충돌 지점

| 파일/계약 | 실제 연결과 Stage B 요구 |
| --- | --- |
| [기존 자산 API](../src/app/api/project-design-kit/assets/route.ts), [쓰기 helper](../src/lib/project-design-asset-write.ts) | 기존 POST multipart·upload→INSERT 유지. 새 JSON routes/session repository 별도, 기존 승인/PATCH·목록·delete 응답 의미 변경 금지 |
| [프로젝트 권한](../src/lib/project-api-access.ts), [앱 인증](../src/lib/app-auth.ts) | HMAC user+assignee/관리자+잠금 재사용. Supabase anon INSERT policy로 대체 금지. finalize까지 권한 재검사 |
| [편집 파일 proxy](../src/app/api/project-files/preview/route.ts) | 자산 row/path→프로젝트 소속 조회 후 앱 권한 검사. 격리 경로를 자산 테이블에 등록하지 않아야 함. final 등록 전 임시 객체 ID mapper 추가 금지 |
| [공개 파일 proxy](../src/app/api/public-files/preview/route.ts), hero/Composition reader | 일반 allowlist와 별도 hero 접근 경로를 모두 확인해야 함. private만으로 안전 단정 금지. 승인·활성·ready/visible 및 기존 공개 조건 유지 |
| [v1.26 FK](../supabase/schema_v1_26_composition_asset_delete_integrity.sql) | `NO ACTION DEFERRABLE INITIALLY DEFERRED` 유지. 비로고 DB삭제 성공 전 파일 삭제 금지. 세션·receipt·GC의 추가 FK/삭제 의미는 별도 승인 |
| 원본/참고 자료·로고/Canva import | 별도 보안·public 버킷·생성 provenance 계약. 첫 전환 범위 제외. font temp 업로드 전역 dedup을 제작 자산에 복제하지 않음 |
| C1 #248 | `assets/route.ts`, `newsletter-file-storage.ts`, `supabase-config.ts`, `image-delivery-server.ts`, TTS·package/lock 충돌. C1 preservation namespace와 quarantine namespace 분리. C1 예약어 조각 과잉 차단 결함은 아직 별도 미해결 |
| #255 전체 디자인 복사 | 자산 ID/소속/종류·상태 및 삭제 경합과 접점. 기존 복사 RPC를 새 upload 세션으로 확장하지 않음 |

C1 diff는 현재 head `bab9dc5d2a5ba968ddc3fda43bada25816cf2d64`의 파일 목록·namespace 함수를 읽기만 했다. A1→A2→C1 기존 계획을 업로드 준비 때문에 실행하지 않으며, 공통 파일 수정 전 실제 병합 상태를 다시 비교한다.

## 8. 검증 결과 및 다음 단계 차단 조건

선택 통합 실행 **91/91 통과, skip 0**: Stage A 19개, B-1 SQL 10개(상위 테스트 포함), 이미지 7개 및 기존 회귀. 신규 CJS ESLint·문서 링크·diff check 확인. 런타임 변경이 없으므로 전체 TypeScript/앱 build는 반복하지 않았다. Vercel의 PR Preview 결과와 로컬 테스트를 구분한다.

원격 Staging 쓰기 전 필수:

1. 영속 세션 migration/실제 FK·삭제·권한/복구 절차 별도 승인. 실제 PostgreSQL 다중 연결 finalize/GC/프로젝트 삭제/승인/권한 변경 경합 통과.
2. 전용 private quarantine 또는 기존 private prefix의 실효 격리 검증 및 설정 승인. 현재 테이블·Storage object RLS/ACL 확인, 서비스 키 브라우저 미노출.
3. token/header 변조·다른 경로·overwrite·2시간/24시간/진행 중 전송·TUS 재개/CORS 실측. 전송 종료를 입증할 수 없다면 GC 보류.
4. bounded decode/full read·대용량/손상 corpus·메모리/CPU/병렬 부하·서버 timeout·native binary 배포 확인. 상한 증액은 별도 판단.
5. Storage 성공/DB 실패·커밋 응답 유실·worker 종료·재시작·고아 파일 정리의 실제 복구. 기존 프로젝트/자산 삭제와 Composition 참조 불변.
6. Staging/Production 배포 환경 분리, 백업·복구 가능성, quota/rate limit 및 모니터링의 토큰 redaction 확인. 샘플 파일 쓰기 E2E는 별도 승인 후 실행.

이번 단계는 **운영 연결 준비 완료가 아니라 차단 조건을 구체화한 사전 검증**이다. 운영 API/UI 및 파일을 전혀 변경하지 않았고 기존 OPEN PR·stash를 보존한다. B-1 PR은 OPEN으로 유지하며 병합하지 않는다.
