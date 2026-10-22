# 독립 발행 C1: 비공개 Supabase 보존 adapter 및 기존 파일 경로 보호

기준: A2 #247 `1e2e1683f79569a7268998df3ee08335d7b1c589`. C1은 A2를 base로 하는 stacked PR이다.
A1/A2는 수정·병합하지 않는다. 원격 DB/Storage, 버킷, 정책, 환경변수, 공개 URL/UI는 변경하지 않는다.

## 구현 경계

`SupabasePublicationStore`는 Supabase REST Storage wire adapter다. URL/project ref,
용도별 credentials provider, source bucket allowlist, transport를 명시적으로 주입한다.
환경변수 조회·전역 Supabase client·자동 실행·버킷 생성·signed URL 발급은 없다.
테스트는 fake credentials와 메모리 object map을 사용하는 transport만 주입한다.
실제 `fetch`를 주입하면 원격 요청을 만들 수 있지만 앱 route/worker에는 연결하지 않았다.

DB는 `PreservationLedger` port로 분리한다. 이 port는 단순 boolean 권한 확인이 아니다.
연결 구현은 다음 계약을 반드시 보장해야 한다.

- `source`: 서버 인증에서 구성한 actor/assignee, project/article/preparation/file 소속,
  캡처된 source ID/path, 준비 유효기간·revision, 활성/승인/철회 tombstone 검사.
- `find/reserve`: 준비+file unique, hash/길이/MIME/facts를 동결한 durable reservation,
  동일 요청 reuse, 준비 전체의 200개/64MiB 예산 및 만료 관리. source resolver가 임의 파일 경로를 허용하지 않는다.
- `exclusive`: ledger row를 재조회하고 lease와 상태를 확인한 뒤 callback이 끝날 때까지
  실제 DB 잠금 또는 동등한 검증된 fencing을 유지한다. pin/GC도 동일 잠금에 참여한다.
- `verified`: 재다운로드 무결성 검증 뒤 DB 상태를 갱신한다. DB 실패가 Storage를 rollback했다고 처리하지 않는다.
- `access`: 요청 article/project/revision/file membership, active published revision, 원본 이용중지 정책 검사.
- `gc`: grace/lease/공개 이력 pin 검사, deleting claim 후 callback, 실제 삭제 확인 뒤 deleted 확정.
  callback 실패 시 claim을 보존/재시도하며 새 보존 요청을 허용하지 않는다.

**Production용 ledger/인증 binding은 아직 없다.** A2 RPC는 여전히 loopback·격리 DB guard를 가진다.
C1에서 이를 해제하거나 새 원격 RPC를 만들지 않았다. 원격 연결 승인은 이 binding과 권한·트랜잭션
검토 후 별도로 받아야 한다. 메모리 mutex를 운영 pin/GC 보호로 사용해서는 안 된다.

## 버킷과 경로

- 전용 private bucket 계약: `article-publication-preserved` (실제 생성 안 함).
- 물리 경로: `independent-publications/v1/projects/{projectId}/articles/{articleId}/preparations/{preparationId}/{fileId}/{sha256}`.
- 허용하는 Supabase origin은 명시한 20자리 ref의 `https://{ref}.supabase.co` 한 곳이다.
- source는 allowlist bucket + DB가 허용한 `projects/{projectId}/...` 경로만 허용한다.
  외부 URL, signed URL, traversal, percent/역슬래시/query/control 경로는 거부한다.
- 기존 global font/slug 기반 경로 등은 임의 project 매핑하지 않는다. 별도 소유권 resolver가 없으면 차단한다.
- 원본과 보존 경로를 공유하지 않는다. 이미지 확대보기에서도 기존 generic proxy로 보존 파일을 제공하지 않는다.

작업 시작 시 bucket metadata가 private임을 확인한다. private 설정만으로 WORM은 보장되지 않는다.
service_role은 RLS를 우회하므로 read/insert/delete credential 분리와 기존 broad-key 경로 차단을
별도 검토해야 한다. C1의 코드 검사만으로 콘솔·외부 도구의 삭제까지 막는다고 주장하지 않는다.

## 검증·업로드·복구

1. ledger가 허용한 원본을 authenticated GET으로 제한된 stream에 읽는다.
2. 16MiB 상한, HTTP 200/Content-Length/Content-Type/부분 응답/압축 여부,
   SHA-256·MIME signature·이미지 decode·기존 오디오/폰트 검증을 수행한다.
3. DB reservation을 먼저 commit한다. 경로/descriptor/lease를 검증한다.
4. ledger exclusive 구간에서 보존 파일의 존재를 조회한다. 기존 객체는 재다운로드 검증하고 재사용한다.
5. 없으면 원본을 다시 검증하고 `x-upsert:false` POST한다. 성공·충돌·응답 유실 모두
   예약 경로 재다운로드 검증으로 결과를 확인한다. 덮어쓰기나 임의 새 경로 우회는 하지 않는다.
6. 실제 보존 bytes의 hash/MIME/길이/facts 및 복사 직후 원본을 재확인한 뒤 verified를 기록한다.

provider 응답 본문·credentials·signed URL을 오류 메시지에 넣지 않는다. redirect:error,
cache:no-store, 20초 request timeout과 이미지 decode 7초 제한을 사용한다.
손상/부분 객체는 verified로 만들지 않고 격리한다. 자동 덮어쓰기·즉시 삭제 없이 orphan GC로 보낸다.
프로세스 재시작 시 durable reservation을 재조회해 같은 객체로 복구한다.
원격 404의 비정상 지연, transport timeout, rate limit, 중단된 upload의 후속 완료는 실제 환경에서 추가 검증해야 한다.

GC는 ledger의 deleting/fencing claim 안에서 DELETE하고 authenticated GET 404를 확인한다.
응답이 불명확하면 deleted로 확정하지 않는다. Storage의 네트워크 요청은 DB rollback 대상이 아니다.
원격 업로드가 timeout 뒤 계속 진행하는 경우의 delayed completion/quarantine sweep도 원격 적용 전 조건이다.
현재 adapter는 bucket listing 또는 임의 prefix 전체 삭제 API를 제공하지 않는다.

## 공식 Sharp

`sharp@0.35.4`를 명시적 고정 dependency로 선언했다. 기존 transitive 설치 버전과 동일하며
package-lock의 optional 표지만 direct dependency에 맞춰 변경된다.
A2 decoder는 공식 `sharp(bytes, {limitInputPixels:8000000, failOn:'warning'})`와 raw decode를 사용한다.
Next 내부 모듈 import와 shared concurrency/cache 변경은 제거한다.
기존 image delivery도 공식 Sharp로 교체하되 rotate/확대 금지/7초 제한/WebP quality,
AVIF quality 비율·effort 3, 작은 결과 선택·PNG fallback·인증 후 캐시 계약은 유지했다.
폰트 metadata 검증은 Chrome OTS QA를 대신하지 않으며 이슈 #239는 범위 밖이다.

공식 참고: [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/),
[Supabase upload](https://supabase.com/docs/guides/storage/uploads/standard-uploads),
[Storage RLS](https://supabase.com/docs/guides/storage/security/access-control).
Node 런타임이 필요하고 Edge 실행은 지원하지 않는다. 배포 시 플랫폼별 optional native Sharp/libvips
패키지를 제외하지 않아야 한다. 로컬 macOS 빌드와 Vercel Linux Preview는 구분해 기록한다.

## 기존 삭제·upsert·파일 제공 보호

| 기존 경로 | 보정 및 영향 |
|---|---|
| 기사 이미지/업로드 음성/페이지 파일 삭제 | `newsletter-file-storage`의 path 검사에서 보존 namespace 거부. DELETE body의 prefixes도 기존 안전 경로 필터를 통과해야 한다. 정상 원본 삭제 계약은 유지. |
| Design Asset 원본 삭제 | 기존 bucket allowlist 유지 + 보존 bucket/prefix 거부. 원본 row 삭제의 이용중지 tombstone은 A2 remote 설치 승인 전에는 미연결. |
| 원본 upsert·signed upload·Canva/GPT 저장 | 공통 `getSupabaseStorageEndpoint`에서 보존 bucket/prefix와 인코딩 alias 거부. 기존 normal bucket upsert 동작 유지. |
| 기사 TTS / e-book TTS 정리 | 기존 path filter에 보존 namespace 거부 추가. 정상 segment 정리는 유지, 원격 생성 호출은 하지 않음. |
| 공개/관리자/검수/시연 proxy 및 확대 | 공통 endpoint guard로 보존 namespace 제공 금지. 향후 독립 revision 전용 membership 검사 경로만 허용. 기존 공용 fonts cache는 변경하지 않음. |
| 보존 GC | 별도 injected credential과 ledger claim만 사용. 기존 cleanup helper를 호출하지 않음. |

실제 기존 Storage 파일은 건드리지 않았다. 원본 편집 row 삭제/비활성화가 과거 공개본 접근에 미치는
정책은 A2 origin_revoked/cleanup_confirmed 계약을 유지한다. C1이 삭제 허용/승인 의미를 새로 만들지 않는다.

## 테스트와 원격 적용 전 조건

모의 transport: 원본 삭제/변경 뒤 사본 유지, upsert=false, hash/MIME/길이/stream 불일치,
동시 보존, 업로드 응답 유실, DB 실패 후 재시작, 손상 사본/불완전 업로드,
미허용 경로·project·private 설정·접근 종료·삭제 응답 유실·legacy 삭제 차단을 검증한다.
실제 PostgreSQL 테스트는 A2 표/RPC를 설치한 loopback DB에서 보존 callback 중 GC의 row-lock 대기와
pin 이후 GC 거부를 확인한다. HTTP transport·파일은 전부 모의이며 실 Supabase 요청은 없다.
fixture는 A2의 logical destination에 고정 prefix를 붙인다. 최종 DB binding은 물리 경로/버킷·버전
매핑을 별도로 검증해야 하며 해당 fixture binding을 운영 구현으로 취급하지 않는다.

원격 적용 전에는 private bucket/용도별 최소 권한, production ledger binding,
모든 cleanup의 namespace 전수 검토, Storage 복구/백업·보존기간, 지연 업로드/GC reconciliation,
실제 bucket API/RLS/404/Range/HEAD/캐시·철회 검증이 필요하다.
signed URL은 발급하지 않고 public URL/UI도 연결하지 않는다. 이미 다운로드한 파일이나 별도 공용 원본은 회수할 수 없다.

최종 로컬 결과: C1 **17/17**(모의 transport 16 + 실제 PostgreSQL 경합 1),
전체 **608/608**, 실패/skip 0. TypeScript·lint·Webpack Production build·diff check 통과.
기존 lint warning 3개 외 신규 warning은 없다. 실제 Supabase 연결·Storage/RLS 변경·원격 발행은 미수행이다.
