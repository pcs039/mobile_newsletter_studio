# 독립 발행 A2 — 격리 구현 결과

기준 A1: PR #246 / `07f9818f63e14ac6da0e3da6ff08190233394f45`.
설계: [A2 계약](article-independent-publication-a2-contract-v1.md).
이 구현은 A1을 base로 하는 별도 stacked PR이며 A1은 병합/변경하지 않는다.

## 실행 경계

- 실제 PostgreSQL은 매 실행 새 loopback `mns_a1_a2_*` DB·무작위 암호·임시 디렉터리에서만 실행한다.
- v1.42 설치와 RPC는 A1의 service_role/READ COMMITTED/명시적 격리 세션 가드를 유지한다.
- object store는 메모리 Map 기반 **private 모의 Storage**다. Supabase client·원격 adapter·fetch·환경변수 fallback이 없다.
- Production/원격 Staging DB·Storage·인증/환경변수 변경, 원격 발행·철회, 생성 API 호출은 하지 않았다.
- HTTP 공개 API/URL, 작성자 UI/발행 버튼, 실제 reader 연결은 추가하지 않는다. 앱의 기존 reader·파일·정기호 경로는 그대로다.

## 단계별 구현

| 단계 | 구현 |
|---|---|
| 1. Snapshot | 허용 필드 capture, 동일 MVCC 조회, bounded canonical JSON, Node/SQL source·render hash 교차 검증 |
| 2. Media | 예정 경로·SHA-256·bytes·MIME·디코딩/형식 facts, pending/verified/pinned/deleting/deleted, lease |
| 3. 준비 연결 | prepare → trusted Node validator → candidate stage → 사본 생성/재검증 → verified → finalize |
| 4. 접근 판정 | 내부 article/project/revision/file membership, active pointer·안전 상태·현재 권리 확인 |
| 5. 경합/장애 | 실제 세션 lock barrier, 복사 성공/DB 실패·응답 유실 재시도, pin/GC, 기존 저장·삭제·정기호 회귀 |

### Snapshot 및 실제 데이터 관계

일반 본문 이미지의 asset_id는 `newsletter_assets`를 참조한다. Composition의 asset_id는
`newsletter_project_design_assets`를 참조한다. 두 표의 UUID를 같은 자산으로 매핑하거나 복제하지 않는다.
각 출처를 photo/asset으로 분리하여 project·파일 경로·승인 조건을 검사한다.

기사 제목/요약/본문, 문단/사진/버튼/지도 링크, 공개 공공정보, 표시 방식/제목 표시,
정렬·동작·연락처 필드와 공개 지원 Composition 슬롯을 별도 revision JSON에 고정한다.
전화번호·웹 링크와 버튼 label은 기존 public-article-url helper를 재사용한다. 현재 reader가
지원하지 않는 mailto는 설계상의 후보였지만 이번 구현에서 새로 활성화하지 않고 차단한다.
일반 저장 시 추가되는 presentation_mode/show_public_title/body_design metadata는 기존 validator와
호환되게 처리하며, 불명 metadata는 준비 capture 저장 전에 거부한다.

제목/본문/캡션/버튼의 원래 폰트 ID와 실제 fallback 결과를 분리한다. 선택 family의 face만
weight/style/format/파일 ID로 보존하며 선택 파일 weight를 제목·본문 CSS weight로 취급하지 않는다.
폰트 CSS family와 face 선언을 재구성할 메타데이터를 보존하지만 전체 stylesheet나 browser의
플랫폼별 glyph 결과까지 고정했다고 주장하지 않는다. reader adapter/실제 웹폰트 QA는 후속이다.

준비 capture는 public 표시 필드와 dependency만 포함한다. 원시 project password/token/provider
payload, 숨김 block 내용은 공개 revision에 넣지 않는다. 내부 source descriptor의 bucket/path도
공개 snapshot에는 없다. 실제 공개 경로에 넘길 DTO adapter는 아직 연결하지 않았다.

canonical v1은 UTF-8 key 순서, 의미 있는 array 순서, 명시적 null, UTC 원본 시각,
숫자 절댓값 1e12 이하/소수 6자리, 깊이32/총1MiB로 제한한다. Unicode 임의 정규화는 하지 않는다.
실제 Node와 PostgreSQL 고정 fixture를 비교한다. sourceHash와 render payloadHash는 분리되며
후자는 provenance·예정 file ID 대신 검증된 바이트 descriptor를 사용한다. 같은 표현 replace는
이벤트·버전 증가 없는 unchanged 결과를 반환한다.

### 파일 보존과 검증

모의 source bucket은 `a2-isolated-source` 하나뿐이다. 원격/private/public bucket 이름을 받아
네트워크로 읽는 기능은 없다. 특히 실제 공용 fonts/brand-assets 참조는 자동 허용하지 않는다.

목적지: `projects/{project}/articles/{article}/preparations/{prep}/{file}/{sha256}`.
같은 path의 다른 bytes는 덮어쓸 수 없다. 반환 Buffer도 복사하여 외부 변경이 원본 Map에 닿지 않는다.
사본 삭제는 DB GC 판정 후 모듈 내부 capability로만 실행한다.

- 파일 16MiB, 한 준비 64MiB, manifest 최대200개. 이는 격리 v1 한도이며 원격 운영 한도 승인이 아니다.
- PNG/JPEG/WebP: MIME signature + Next에 포함된 Sharp 엔진으로 실제 디코딩·치수·pixel 상한 검사.
- WAV: PCM 구조·길이·sample rate·channel/bit depth·block alignment 검사.
- MP3: bounded ID3/MPEG Layer III frame·전체 길이·duration 검사. 음성의 의미나 실제 재생 QA는 아니다.
- TTF/OTF/WOFF/WOFF2: signature와 기존 fontkit metadata parser로 검사. browser OTS 호환성/이슈 #239 해결을 주장하지 않는다.
- 복사 전후 원본 해시, 보존본 해시·크기·MIME·facts를 재확인한다. 필요한 사본 하나라도 미완료면 revision을 만들지 않는다.
- 저장 AI 음성의 text hash는 기존 ko-v1 정규화 규칙을 재사용한다. synthetic WAV fixture로 manifest 연결을 검증했으며 새 TTS 생성은 하지 않았다.

Storage 성공/DB 실패 시 예약 path와 사본을 남긴다. 동일 준비·lease로 재시도하면 같은 객체를
재사용한다. DB commit 후 응답 유실은 같은 requestKey 영수증과 현재 상태를 분리 반환한다.
불명 상태에서 원본/사본을 임의 삭제하거나 새 key로 무한 재발행하지 않는다.

### pin·GC·원본 안전 정책

publish는 media row를 ID 순서대로 잠그고 pin·active revision·이벤트를 같은 DB transaction으로
commit한다. GC도 같은 row를 잠근다. pinned 또는 실제 공개 이력에서 참조하는 file은 삭제하지 않는다.
GC가 deleting을 먼저 잡으면 뒤의 publish는 거부한다. 삭제 응답 유실은 같은 token으로 재개할 수 있다.
grace 1일은 격리 fixture 정책이며 운영 retention 결정은 남아 있다.

준비-only 기사 삭제 후 ledger의 preparation FK는 SET NULL로 남고 미공개 revision도 보존한다.
file GC는 lease/grace/공개 이력을 확인한다. 고아 revision row 자체의 제한 삭제 함수는 이번에 제공하지 않는다.

원본 변경은 별도 보존 bytes를 바꾸지 않는다. 원본 row를 정리하려면 pinned 사본에 대한
명시적 cleanup 확인이 있어야 하며, 이유 없는 row 부재는 접근을 막는다. 사용 중지·미승인·
소속 변경을 삭제로 감출 수 없도록 원본 표 5개에 additive safety trigger를 둔다.
해당 origin의 ledger에 origin_revoked를 단조롭게 기록하므로 기존 cleanup 확인이 있어도
나중의 사용 중지를 삭제로 되돌릴 수 없다. 기존 원본 수정/삭제 결과나 정기호 RPC 정의는 바꾸지 않는다.
원격 설치 시 이 신규 trigger의 부하·잠금/권리 정책 검토가 별도로 필요하다.

내부 file 판정은 정기호 published와 독립적으로 현재 독립 state·active revision·manifest
membership·article/project 안전 상태·origin 정책을 확인한다. 다음 요청은 withdraw/replace 뒤
이전 revision을 읽지 못한다. byte hash 검사도 판정 뒤 수행한다. 이미 내려받은 사본이나 다른
정기호/공개 원본 URL은 회수하지 못한다. HTTP 캐시 헤더는 기존 정책을 바꾸지 않고 후속 연결한다.

## 변경 파일

- `src/lib/article-publication-canonical.ts`: canonical/source/render 해시, file ID.
- `src/lib/article-publication-snapshot.ts`: pure candidate·미디어 요구사항 builder.
- `src/lib/article-publication-media.ts`: 모의 private object store·검증·worker·내부 read/GC.
- `supabase/schema_v1_42_article_publication_a2_isolated.sql`: 격리 capture/prepare/stage/reserve/verify/finalize/transition/access/GC/cleanup, A1 신규 표 확장, safety trigger.
- `tests/article-publication-a2-{fixtures,postgres}.cjs`: synthetic 데이터·파일 및 실제 PostgreSQL fixture.
- `tests/article-publication-a2-{snapshot,sql}.test.cjs`: 단위·통합·다중 연결 테스트.
- 본 문서. 기존 실행 파일·정기호/검수/시연 RPC·dependency/lockfile 변경 없음.

## 22개 설계 시나리오의 검증 범위

| ID | 격리 결과 |
|---|---|
| 01~03 | mixed content 허용 필드, HTML/URL 차단, ready/approved Composition·지원 슬롯 검증 |
| 04 | synthetic private font face 보존, 4개 역할/상속, family 사용 중지 차단. 실제 browser 글꼴 QA는 미수행 |
| 05~07 | deterministic hash, Node/DB canonical·render hash 일치, 초안/child 수정 후 불변, 단일 writer 전후 snapshot |
| 08~11 | 복사 중 원본 변경 차단, 잘린/잘못된 bytes, overwrite 금지, Storage 성공/DB 실패·응답 유실 재시도 |
| 12 | 실제 두 PostgreSQL 연결의 pin-first/GC-first barrier. GC-first에서 준비 갱신은 명시적인 fault fixture |
| 13~15 | 준비-only 삭제/orphan GC, 원본 변경·정리 후 보존, 사용 중지 후 삭제로 재허용 불가 |
| 16~17 | 다른 project/article/revision/file·미선택 source path 차단, withdraw/replace·archived 후 내부 read 거부 |
| 18~19 | 외부/public source 거부, 모듈에 remote fetch 없음, 기존 Storage-first 실패와 별도 사본 유지. 실제 기존 업로드/TTS 경로의 원격 prefix 방어는 미연결 |
| 20 | service_role/ACL·중복·응답 유실·실제 동시 발행·lease 검증 |
| 21 | renderer/schema version 차단만 실행. 공통 reader 연결·390/520/768/1440·실제 웹폰트/확대 QA는 UI/URL 후속 단계 |
| 22 | 기존 v1.21/38/29/30/40 SQL을 함께 로드해 저장/순서/삭제·정기호 직접 발행 회귀. 기존 전체 검수·시연 테스트도 실행 |

단위 9/9 + 실제 PostgreSQL 통합 28/28 = **A2 37/37**.
전체 **588/588**, 실패/skip 0. A1 45개도 변경 없이 실행했다.
TypeScript/lint/Webpack build/diff check 통과. 기존 lint warning 3개는 범위 밖이며 신규 warning은 없다.

## 미완료·원격 적용 차단 조건

1. 실제 Supabase 보존 bucket·RLS·worker 최소 권한, overwrite/delete 방어·백업/PITR/Storage 복구 미검증.
2. 실제 전체 파일 형식·용량·스트리밍 worker·분산 job/lease 재시작 및 원격 GC 검증 미완료.
3. 원본 cleanup/이용 중지 trigger의 운영 권리 정책과 재허용 절차, 고아 revision 정리 정책 확정 필요.
4. 기존 삭제·upsert·TTS cleanup의 보존 namespace 분리는 모의 환경에서만 구현. 원격 경로 연결 전에 전수 검사 필요.
5. 공용 bucket/font, 외부 이미지·signed URL, SVG/AI/PSD/PDF, 영상·설문, 알 수 없는 AI/Canva full-layout metadata는 이번 제한 builder에서 차단한다. 무손실 adapter를 별도로 검증해야 한다.
6. 실제 공통 reader adapter·CSS/웹폰트·접근 HTTP/HEAD/Range/304/캐시·브라우저 E2E 미완료. version 문자열만으로 시각 일치를 증명하지 않는다.
7. 기존 복수 REST Composition 작업 전체의 원자성, 모든 기존 writer와 교착/운영 성능 검증은 남아 있다.

따라서 이것은 **격리 내부 보존·접근 계약 PR**이며 Production rollout 준비 완료가 아니다.
실제 원격 설치·Storage 설정·reader 연결·공개 gate는 별도 승인 전까지 금지한다.

## 2026-10-22 최종 감사 및 다음 단계

### 확인된 정합성 결함과 최소 보정

- 메타데이터 없는 이미지 기사의 presentation fallback을 기존 repository와 동일한 `mixed`로 보정했다. 명시적 `text/image/mixed`는 유지한다.
- 글꼴 capture에 `detected_weight/detected_style`을 포함하고 기존 `mapFontAssetRowToFontAsset` 우선순위와 맞췄다. 패밀리 미지정 파일의 CSS 이름도 `DD_Font_{id}` 규칙으로 고정한다. 글꼴 ID 선택으로 기사 CSS 굵기를 새로 변경하는 기능은 아니다.
- 단위 2개와 실제 PostgreSQL capture/finalize 회귀 1개를 추가했다. 기존 reader, 폰트 CSS, 저장/발행 RPC는 수정하지 않았다.

보정 후 A2 **40/40**, 전체 **591/591** 통과(실패/skip 0).
TypeScript·lint·Webpack build·diff check 통과. 기존 lint warning 3개 외 신규 warning 0.
실제 PostgreSQL 다중 연결과 기존 SQL WASM 회귀를 모두 실행했다.

### 코드 감사 판단

| 대상 | 확인 결과 / 남은 경계 |
|---|---|
| Node/SQL canonical | UTF-8 key 정렬, 문자열 escape, 6자리 소수/크기 제한과 render hash의 교차 런타임 fixture 통과. 임의 JSON/범용 표준 canonicalizer로 취급하지 않는다. |
| snapshot | 허용 필드, 지원 block/slot, 상속값과 font face를 고정. survey·opaque metadata·외부 파일·알 수 없는 HTML/CSS는 차단한다. 실제 reader adapter와 시각 비교는 미완료다. |
| 소유권/권한 | 같은 project/article/source와 active revision manifest membership 검사. service_role 전용 RPC 및 격리 가드 유지. 호출자가 전달하는 actor context를 향후 HTTP 인증에서 서버가 구성해야 한다. |
| bytes | SHA-256, 길이, MIME signature 및 이미지 실제 decode 검사. MP3는 frame 구조, 폰트는 fontkit metadata 검증이며 재생/Chrome OTS 통과를 대신하지 않는다. |
| 재요청 | 동일 key 영수증, 복사 성공/DB 실패, 응답 유실 후 동일 사본 재사용 검증. worker 재시작 시 lease 만료 대기·분산 재개는 추가 검증 필요다. |
| pin/GC | 실제 다중 연결 row-lock 경합 검증. 공개 이력 pin은 GC 거부, 준비-only 고아 file은 grace 이후 정리. 고아 revision row GC와 운영 retention은 미정이다. |
| 접근 종료 | withdraw/replace 뒤 이전 revision의 새로운 내부 read 거부. 이미 다운로드한 bytes와 별도 공개 원본 URL은 회수 불가다. |

`next/dist/server/image-optimizer#getSharp`는 현재 고정 Next 16.3.4에서 실행되지만 Next 내부 API다.
해당 helper는 shared Sharp cache/concurrency에도 관여한다. 공식 Next 공개 이미지 API를
서버 파일 검증 API로 사용할 근거는 없다. 원격 adapter PR에서 `sharp`를 명시적 dependency로
선언하고 공식 constructor `sharp(bytes, {limitInputPixels, failOn})` + raw decode로 대체하는 것을
권장한다. 현재 transitive 설치에 의존한 deep import를 장기 worker 계약으로 승인하지 않는다.
이번 감사에서는 dependency나 동작하는 격리 decoder를 불필요하게 변경하지 않았다.
공식 근거: [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/),
[Next Sharp deployment guide](https://nextjs.org/docs/messages/sharp-missing-in-production).

### Vercel 검사 미등록 조사

최초 head `eb728dc4cea5da57a52fcaaeaacb2f482b3cfb6e`에는 이후 Vercel SUCCESS가 등록됐고,
대시보드에서 Preview Ready 배포 `AJMVubE2bCV5R3D7vFa7aA1CHsWq`를 확인했다.
배포 시작은 2026-10-22 00:36:20 KST, Preview Comments 완료는 00:38:27 KST다.
최초 PR 생성 직후 조회의 0건은 최종 실패/제외 판정이 아니었다. 제공자 내부 이벤트 전달 지연의
정확한 원인은 조회한 화면/API만으로 확정할 수 없다.

읽기 전용으로 확인한 설정은 Git repository 연결, Commit Status ON,
Preview Branch Tracking ON / All unassigned branches, Ignored Build Step Automatic이다.
저장소 `vercel.json`은 없으며 stacked base를 제외하는 설정은 발견하지 않았다.
설정·환경변수·배포를 변경하지 않았다. 로컬 build 통과와 원격 Preview 성공은 별개로 기록한다.

### 모의 Storage와 원격 연결의 차이

| 항목 | 모의 구현 | 실제 연결 전에 필요한 조건 |
|---|---|---|
| private / 권한 | 프로세스 내부 Map, remote client 없음 | 별도 private 보존 bucket, anon/auth 직접 접근 금지, worker 권한 분리. service_role은 RLS 우회 가능하므로 RLS만으로 불변성을 보장하지 않는다. |
| overwrite | 기존 path의 다른 bytes 거부 | 생성은 upsert=false. 이미 존재하면 충돌을 무조건 성공으로 간주하지 말고 재다운로드 hash/MIME/길이 일치 시에만 재사용. broad key로 overwrite/delete 가능한 경로를 제거/제한해야 한다. |
| 검증 | Buffer 복제 후 재검증 | streaming/메모리 제한, 응답 중단/압축/MIME/크기 검증, 저장된 객체 재다운로드와 SHA-256 확인. 단순 ETag는 SHA-256 대체 불가. |
| Storage 성공 / DB 실패 | 예약 path와 bytes 잔존 | 예약 ledger를 먼저 commit, 사본 생성·재검증 후 verified/finalize. worker crash·timeout 뒤 동일 path로 reconciliation, pin/GC 공통 잠금과 fencing 필요. |
| 삭제 보호 | 비공개 Symbol과 DB GC 결정 | 보존 namespace는 기존 upload/upsert/delete/TTS cleanup에서 접근 금지. private은 WORM 의미가 아니다. DB transaction은 Storage 작업을 rollback하지 않는다. |
| 공개 접근 | 내부 DB 판정 후 Map read | revision membership 확인 후 서버 proxy로 제공. 원본/signed URL redirect 금지. GET/HEAD/Range/조건부 요청마다 철회 판정, no-store 및 CDN 헤더 검증 필요. |
| 원본 변화 | 별도 사본으로 bytes 유지 | 원본 bucket과 물리 경로 분리, 원본 cleanup 확인/tombstone 정책 및 백업/복구 실증. 이미 공용 bucket에 노출된 원본은 독립 발행 철회로 회수 불가. |

Supabase 문서상 private 파일은 인증 download 또는 signed URL로 제공하며 signed URL은 만료까지
유효하므로, 즉시 철회를 보장할 독립 공개 경로에서는 URL을 브라우저에 전달하지 않는 쪽을 권장한다.
[권한 문서](https://supabase.com/docs/guides/storage/security/access-control),
[업로드 문서](https://supabase.com/docs/guides/storage/uploads/standard-uploads),
[다운로드 문서](https://supabase.com/docs/guides/storage/serving/downloads).
이번에는 원격 bucket·object·정책을 생성/수정하거나 실제 파일을 업로드하지 않았다.

### 최소 PR 및 적용 순서 제안

1. A1 → A2 순서로 코드 검토. 두 SQL은 격리 설치/실행 가드를 가진 개발용이므로 병합 승인이 원격 migration 승인은 아니다. 원격 적용용 설치·권한·feature gate는 별도 승인·PR이 필요하다.
2. private 보존 adapter와 기존 삭제/upsert/TTS 정리 경로 보호를 먼저 구현한다. 두 변경은 함께 검증돼야 하며 writer와 GC credential/namespace 분리, 복구와 retention을 확정한다. 아직 공개 API/UI는 연결하지 않는다.
3. 서버 revision/file 접근 service와 HTTP 계약을 gate OFF로 구현한다. 사용자 인증에서 context 구성, project/article/revision/file 검사, GET/HEAD/Range/304/no-store·철회 경합 검증을 포함한다.
4. 공통 reader용 snapshot adapter와 단일 기사 URL을 gate OFF로 추가한다. snapshot schema/renderer와 실제 typography/blocks/CTA/음성의 무손실 표현 및 타 비공개 기사 navigation 차단을 검증한다.
5. 별도 승인된 Staging bucket/migration/배포에만 통합 연결한다. 실제 발행/교체/철회/재공개·다운로드·중복·장애·GC·원본 삭제 E2E와 기존 정기호 회귀를 통과한 뒤 Production rollout 승인을 요청한다.

A1/A2는 각각 전체 회귀·Preview·권한/삭제 경합 검토 후 순서대로 병합할 수 있으나,
이번 작업에서는 둘 다 OPEN으로 유지한다. 현재 원격 적용은 backup/PITR/Storage 복구 확인,
원본 및 보존 파일 권한 분리, 기존 모든 cleanup 경로 보호, reader/HTTP 검증 미완료로 차단한다.
