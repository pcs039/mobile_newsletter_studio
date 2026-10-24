# 독립 발행 A2 — snapshot·미디어 보존 설계 및 테스트 계약

2026-10-21. 기준 main `449ee01cdc76cd4b5638413bde76e6ce2f3fc5b7`.
A1: [구현·검증](article-independent-publication-a1-implementation-v1.md), PR #246.
상위 계약: [A단계 설계](article-independent-publication-stage-a-v1.md),
[기존 테스트 ID](article-independent-publication-stage-a-tests-v1.md).

**설계만 준비했다. A2 SQL·worker·API·URL·UI는 구현하지 않았고 원격 변경도 없다.**
A1의 `a1-text-v1`/`a1-no-reader` revision을 실제 공개본으로 재해석하지 않는다.
A2 실제 구현은 별도 브랜치·PR에서 진행한다. A1과 A2 모두 기본 비활성이다.

## 1. 코드 근거와 고정 경계

| 현행 근거 | 관찰 및 A2 계약 |
|---|---|
| `src/components/public-mobile-article-reader.tsx`의 ArticleCard/renderContentBlock | 기사 표시 DTO, 문단·공공정보·CTA·대표/본문/Canva full-layout, 음성과 글자 확대를 사용. DTO adapter를 재사용하고 별도 renderer를 만들지 않음 |
| `src/lib/article-composition-repository.ts` | 공개 경로는 ready Composition, active/approved 디자인 자산, 지원 슬롯을 검사. 편집용 Draft 허용과 공개 허용을 분리 |
| `src/lib/article-text-design.ts`, `article-hero-background.ts` | 검증된 HTML 텍스트 설정·배경/상단 배치 값을 복사. 임의 settings JSON을 실행하지 않음 |
| `src/lib/font-css.ts` | 선택 asset ID, family/asset 활성·웹 사용 조건, CSS family/face를 사용. 선택 파일 weight를 실제 제목·본문 CSS weight로 오인하지 않음 |
| ArticleCard의 폰트 fallback | 제목/본문은 기사→프로젝트, 캡션/버튼은 해당 기사 역할→기사 본문→프로젝트 본문. 선택 ID와 해석된 결과를 함께 기록 |
| `src/lib/newsletter-file-storage.ts:deleteProjectFile` | Storage 삭제가 DB row 삭제보다 먼저. DB FK만으로 보존 파일 바이트 보호 불가 |
| `src/lib/article-tts-audio.ts` | segment 업로드에 x-upsert=true 및 기존 파일 정리 경로 있음. 공개본을 기존 경로에 두면 불변 보장 불가 |
| `src/lib/revocable-file-cache.ts` | 회수 대상 파일 private/no-store + CDN/Vercel-CDN no-store. 공용 font proxy의 기존 public,max-age=300은 정기호 경로에서 유지 |

### 무엇을 보존하고 무엇을 다시 검사하는가

| 분류 | 불변 revision에 고정 | 저장하지 않거나 매 요청 검사 |
|---|---|---|
| 기사 | 실제 표시 제목, display title 선택 결과, 요약, 본문, 정렬, 유형 표시·동작 토큰, 공공정보 | 초안 전체 row, 내부 메모, 담당자 연락처 등 비표시 항목은 제외. 표시용 연락처는 기존 공개 규칙대로 명시 선택 |
| 블록·링크·CTA | 표시 순서, visibility 확정 결과, 지원 block DTO, label/action/정규화된 안전한 target, 렌더링용 metadata allowlist | 숨김 block의 본문, provider payload, 임의 metadata 제외. 기사 외 파일/다른 기사 URL 권한 우회 금지 |
| Composition | ready/공개 적격 결과, 지원 슬롯의 배치·크기·회전·투명도·순서, 허용된 text/background 설정 | 편집만 가능한 title_icon/body_decoration/footer_banner는 지원 확대하지 않고 미포함 사유 기록. 임의 fallback 자산 금지 |
| 프로젝트 상속 | 필요한 제목/기관/색상·스타일 토큰, 역할별 폰트 해석 결과 | 비밀번호·해시·검수/시연 토큰·recipient·전체 프로젝트 설정 제외. 현재 프로젝트 soft-delete/archived는 상위 접근 차단 |
| 글꼴 | 원래 asset/family ID, 역할별 resolved family/실제 typography 토큰, 필요한 face의 weight/style/format/CSS family와 file ID/hash | 전체 라이브러리 복사 금지. font CSS의 src는 revision file ID로 재구성. 현재 안전상 이용 중지 여부는 별도 검증 |
| 이미지 | 화면 및 확대보기에 필요한 원본/출력 역할, alt/caption, dimensions, fit/crop, file ID/hash | 원본 AI/PSD/EPS/PDF·생성 입력·기관 비공개 자산은 제외. 원본 파일을 자동 변환하지 않음 |
| 음성 | 선택 음성 source, segment 순서·duration·text association·file ID/hash, 필요한 transcript와 stale 표시 결과 | 기존 manifest를 현재 기사로 다시 조회하지 않음. 원본 텍스트·segment 불일치면 blocker |
| provenance | 원본 article/block/link/asset/audio/font ID, source hash, 생성 provenance의 허용된 ID/key, 변환이 있다면 버전 | secret, raw API 응답, signed URL을 보관하지 않음. 원본 row FK로 snapshot child를 재구성하지 않음 |
| 정책/독자 상태 | 준비·공개 시점의 승인/활성화 증거, 유효기간 등 확정한 공개 조건 | 현재 독립 state/active revision, 프로젝트 안전 상태, 이용 중지 정책은 live. 글자 확대·이전/다음·관심분야는 revision 콘텐츠가 아님 |

동적 설문 제출·프로젝트 전체 e-book·외부 embed·정책을 해석할 수 없는 CTA는 첫 A2에서 blocker.
외부 http(s)/tel/mailto 이동 링크는 기존 validator를 통과한 명시적 동작만 보존한다.
외부 페이지 내용까지 고정되거나 철회된다고 안내하지 않는다.

## 2. Snapshot envelope와 해시

제안 버전은 `a2-content-v1`, `a2-manifest-v1`. renderer version은 실제 adapter·공통 reader·
스타일 토큰·검증기 버전 조합으로 산정하고 배포 SHA만으로 호환성을 추정하지 않는다.
현재/지원 과거 버전만 허용하며 알 수 없는 버전은 차단한다.

논리 구조:

```text
snapshotSchemaVersion / rendererVersion / validatorVersion / canonicalVersion
article: display fields + ordered public blocks + links + publicInfo
presentation: text design + supported Composition + resolved project defaults
typography: selected IDs + resolved roles + relevant face descriptors
mediaManifest: file ID / role / sha256 / bytes / MIME / dimensions or duration
provenance: original IDs + sourceHash + approval/policy evidence
```

세 해시를 분리한다.

1. sourceHash: MVCC로 읽은 편집 원본과 실제 의존성 전체. 원본 ID·updated_at 포함, 비밀 원문은 해시 입력·저장 모두 allowlist.
2. payloadHash: 실제 render DTO·resolved defaults·CSS/face 메타데이터·버전. 원본 row timestamp만 바뀌면 의미 없는 replace를 만들지 않음.
3. manifestHash: 역할·순서·file ID와 검증된 바이트 해시/형식/크기. DB JSON의 ready=true를 바이트 검증 증거로 취급하지 않음.

객체 키 정렬, 배열 순서(sort_order,id 또는 segment 순서), UTF-8, 명시적 null,
UTC 시간, 문자열 임의 요약/Unicode 정규화 금지, 유한 숫자만 허용하는 canonical v1을 고정한다.
CSS/배치 숫자의 표현 규칙도 확정한다. Node와 PostgreSQL의 서로 독립된 고정 fixture가 동일
바이트·해시를 내야 한다. A1의 SQL JSONB text 해시 일치만으로 이 조건을 통과시키지 않는다.

## 3. 일관된 준비와 불변성

prepare는 article/project뿐 아니라 block/link, Composition/placements, 관련 design asset,
상속 기본값, 사용 face, 음성 row/manifest 메타데이터를 **한 DB snapshot**에서 읽는다.
여러 REST GET을 합쳐 같은 시점이라고 주장하지 않는다. 용량·개수·재귀 깊이 상한을 검사하며,
검증 불가능한 metadata/URL은 조용히 누락하지 않고 구체적인 blocker로 반환한다.

미디어 원본은 capture 후 별도 시점에 읽는다. 그 사이 원본 교체가 가능하므로 복사 전후
source dependency hash와 실제 원본/목적지 바이트 hash를 재검증한다. 변경되면 준비를 실패시키고
새 후보 확인을 요구한다. DB와 Storage가 하나의 트랜잭션이라고 가정하지 않는다.

finalize는 모든 필요한 file이 verified이고 source/manifest가 여전히 일치할 때만 revision을 만든다.
전용 media worker 입력에는 실제 바이트 검증 기록만 허용한다. 임의 client sha/ready/status를
신뢰하지 않는다. 필요한 미디어를 못 보존하면 텍스트-only로 묵시 축소하여 성공하지 않는다.

Composition의 여러 REST 요청 간 committed 중간 상태는 기존 계약의 한계다.
최종 확인 시 편집·자동 저장 진행/오류/결과 불명 상태를 막고 안정된 후보를 보여줘야 한다.
모든 writer 직렬화 또는 editor transaction token이 필요하면 별도 변경 승인을 받는다.

## 4. Private 보존 경로와 원본 분리

권장: **새 private 보존 bucket**(가칭 article-publication-media) + 다음 구조.

```text
projects/{projectUUID}/articles/{articleUUID}/preparations/{preparationUUID}/{fileUUID}/{sha256}.{validatedExtension}
```

이 bucket이 실제로 존재한다고 가정하지 않는다. 새 bucket/정책/한도 설정은 별도 승인 대상이다.
기존 private bucket의 별도 prefix를 쓰는 대안도 가능하지만 기존 업로드·TTS·삭제 API가 해당
prefix를 절대 입력받지 못하는 검증과 파일 크기/MIME 정책의 적합성을 먼저 증명해야 한다.

- 원본 row/path/해시는 변경하지 않는다. 보존 대상은 선택 기사에 실제 필요한 파일만.
- 목적지 key를 사전 ledger에 예약하고 upsert=false. overwrite/rename/원본 path 재사용 금지.
- source와 destination을 스트리밍 SHA-256으로 검증. bytes, sniffed MIME, 확장자,
  이미지 실제 치수/디코딩, 음성 codec/manifest 일치 검사. ETag·HTTP200·Content-Type만 신뢰하지 않음.
- 파일당/전체 준비 용량·개수·duration·동시성·메모리·시간 상한을 측정 후 확정.
  Range206/잘린 전송/다중 redirect/압축폭탄은 완전성 검증 없이는 실패.
- 원본 asset ID는 provenance로 유지하되 기존 source 파일이 교체·삭제돼도 공개본은
  private copy를 읽는다. 보존본을 원본 asset의 기존 cleanup 대상 경로로 되돌려 넣지 않는다.
- v1은 revision 간 사본 자동 공유/해시 dedup을 하지 않는다. 같은 과거 revision의 republish는
  기존 pinned file을 재사용한다. 프로젝트가 달라도 hash가 같다는 이유로 공유하지 않는다.
- 정기호는 기존 원본·live 렌더링을 유지. 독립 revision은 별도 사본을 소유한다.
  독립 withdraw가 정기호 원본을 삭제하거나 정기호 공개를 취소하지 않는다.

일반 service_role Storage 자격증명은 넓은 우회 권한을 가질 수 있다. 앱의 upsert=false만으로
관리자/키 유출까지 막는 WORM 보존을 주장하지 않는다. 원격 적용 전 실제 Storage RLS·worker
권한·기존 service 경로 전수 방어·백업 및 복구·변경 감사를 확정해야 한다.

## 5. ledger·pin·GC 및 장애 복구

A1 pending ledger는 그대로 활성화하지 않는다. A2 별도 SQL에서 source/destination descriptor,
sha256/bytes/MIME, role, manifest identity, verification evidence, lease/attempt,
frozen_revision, lifecycle을 제한된 함수와 제약으로 확장한다. 일반 table write는 계속 금지한다.

상태 예: planned → copying → verified → pinned. 실패 준비는 failed/abandoned,
GC는 eligible → deleting → deleted. **pinned의 GC 전환은 v1에서 없다.** withdraw와 replace로
비활성화된 과거 공개본도 이력용으로 보존하며 자동 orphan으로 재분류하지 않는다.

- publish/republish와 GC는 같은 ledger row 잠금을 같은 file ID 순서로 획득.
  준비 lease·만료·state/source version·manifest membership을 다시 확인한다.
- pin은 publication pointer/event와 같은 DB transaction에서 commit. deleting 또는 lease
  소유권이 바뀐 file은 pin 불가. GC는 이미 pinned면 삭제 작업을 시작할 수 없다.
- GC가 deleting을 먼저 확정하면 이후 pin을 거부한다. worker가 Storage delete 후 DB 응답을
  잃어도 그 file을 다시 verified로 돌리지 않고 존재 확인·삭제 재개만 수행한다.
- Storage 성공/DB 실패: 사전 예약한 path와 ledger를 남기고 성공 이벤트 조회→현재 상태 확인.
  DB 결과 불명인 동안 즉시 삭제·새 path 무한 생성 금지. 같은 hash 사본이면 재사용.
- DB 성공/응답 유실: 같은 requestKey로 당시 영수증과 현재 상태 반환. 파일 복사·event INSERT 0.
- 준비-only 기사/project 삭제 후 revision/ledger는 orphan으로 남을 수 있다. 실제 공개 이벤트 참조0,
  pointer0, lease 종료, grace 충족을 재확인하는 전용 제한 함수에서만 정리한다.
  grace/retention 수치는 용량·복구 정책 결정 전 확정하지 않는다.
- 보존 file 누락/변조 시 공개 실패·안전한 경고/운영 알림. live draft 파일로 자동 대체하지 않는다.

## 6. 원본 삭제와 안전상 사용 중지

원본 삭제 후에도 공개본 유지와, inactive/revoked 자산 우회 금지는 별개다.
복사 당시 approval/active 증거와 지속 가능한 origin policy 식별자를 ledger에 보존한다.
단순 file 교체/정리와 기관의 사용 중지·권리 회수를 동일한 이벤트로 해석하지 않는다.

권장 계약: 승인된 원본 정리 경로가 pin/hash 검증 후 source-cleanup tombstone을 기록하면
원본 부재에도 보존본 사용 가능. 명시적인 사용 중지는 해당 origin과 연결된 독립 file 접근을
차단한다. source row가 이유 없이 사라지거나 안전 상태를 해석할 수 없으면 fail-closed.
기존 Storage-first 삭제 경로와 이 정책을 연결하지 못하면 원격 활성화 차단이다.
이 durable policy/tombstone 저장 범위는 A2 구현 전에 별도 확정해야 한다.

## 7. revision membership 및 철회

향후 공개 요청은 순서대로 다음을 서버에서 검사한다.

1. DB/application gate, URL scope, 현재 independent published 상태.
2. 프로젝트 soft-delete/archived 및 권리·자산 이용 중지.
3. URL의 revision이 현재 active revision인지, file ID가 해당 불변 manifest의 올바른 role인지.
4. ledger pinned/hash/size/MIME와 Storage 객체 일치. 다른 기사/준비 file ID 거부.

브라우저에는 Storage path·service key·download signed URL을 제공하지 않는다.
HTML/OG/확대보기/음성 manifest·segment/HEAD/Range/조건부 GET/변환 요청 모두 동일한
membership 검증을 거친다. 파일 캐시 hit도 권한 검사를 건너뛰지 않는다.
회수 가능한 응답은 private,no-store,max-age=0 + 두 CDN no-store. 권한 거부도 캐시하지 않는다.

withdraw commit 이후 인증을 시작한 신규 요청은 차단한다. old revision은 replace 후 차단한다.
이미 다운로드한 바이트·진행 중 stream·스크린샷·별도로 공개된 정기호/원본 URL까지 회수하지 못한다.
CDN purge를 권한 검증 대체 수단으로 사용하지 않는다.

외부 이미지/공개 bucket 파일/기존 signed URL은 다음처럼 처리한다.

- 원본 접근 권한·출처·안전한 복사 허용이 확인된 공개 bucket 파일만 private copy 후보.
  새 사본을 만들었다고 기존 public URL도 회수됐다고 주장하지 않음.
- 외부 이미지 임의 fetch 금지. SSRF/redirect/DNS 재바인딩 방어·권리·완전성 미확정이면 blocker.
- 기존 signed URL은 snapshot/log에 저장하지 않음. 만료/회수·발급 범위를 확인 못하면 blocker.
- fonts의 기존 public proxy/기사 ID는 유지. 독립 snapshot에서 byte 고정을 요구하는 face는
  별도 copy/file ID로 제공해야 하며 기존 공용 폰트 정책을 바꾸지 않음. 폰트 안전 정책 미결정도 blocker.

## 8. A2 격리 구현 분할과 예상 파일

| 순서 | 범위 | 예상 파일(신규 이름 잠정) |
|---|---|---|
| A2a | 실제 reader DTO 의존성 분류, validator·canonical fixture, snapshot capture | `src/lib/article-publication-snapshot.ts`, `src/lib/article-publication-canonical.ts`, 관련 테스트 |
| A2b | ledger/준비 상태 SQL·제약·pin/GC lease. A1 원격 가드 유지 | 새 `supabase/schema_v1_42_*` 격리 SQL, SQL 다중 연결 테스트 |
| A2c | 로컬 object-store adapter, 스트리밍 검증·복사·장애 복구만 | `src/lib/article-publication-media.ts`, 로컬 object-store fixture/tests |
| 후속 B/C | 공통 reader adapter와 protected file membership, 실제 원격 보존 검증 | 별도 승인 PR. 현재 public reader·파일 API 변경 안 함 |
| 후속 D | 기존 4. 발행에서 기사 1건 선택·단 한 번 확인·URL/철회 | 새로운 상위 메뉴/설정/발행 화면 없음 |

파일명과 migration 번호는 실제 구현 시작 시 최신 main에서 확인한다. 모든 A2a/b/c도 별도
브랜치·PR 승인 후 구현한다. 최초 A2는 메모리/임시 디렉터리 object store만 사용하고 실제
Supabase endpoint·환경변수를 읽지 않는다. 제안 Storage 이름/권한을 원격에 만들지 않는다.

## 9. A2 테스트 계약 (현재 미구현·미실행)

| ID | 시나리오 | 기대 결과 및 연결 |
|---|---|---|
| A2-01 | mixed article 전체 의존성 | 필요한 표시 정보만 보존. 숨김/다른 기사/secret/provider 데이터 0. M01/M10 |
| A2-02 | 각 block/CTA/HTML·publicInfo 타입 | 기존 renderer와 내용·순서 일치. unsupported 명확 차단. 임의 script/URL 실행 0 |
| A2-03 | Composition/public 슬롯 | ready·approved·active 및 공개 지원만. Draft/미지원 슬롯 미확대. C07/M12 |
| A2-04 | 4개 역할 폰트 상속·CSS | 실제 CSS weight와 파일 metadata 구분. 관련 family/face만, 기존 ID 유지. C08/R09 |
| A2-05 | 원본+snapshot 두 번 capture | 같은 입력 동일 canonical bytes/hash. source-only timestamp 변화와 payload 변화 구분 |
| A2-06 | DB/Node canonical cross fixture | 순서/Unicode/null/숫자/UTC 경계 일치, unknown version fail-closed. M01 |
| A2-07 | multi-table writer commit 경합 | 혼합 snapshot 0, Composition 단독 변경 stale. 복수 REST의 한계 기록. C06~C11 |
| A2-08 | 복사 중 원본 upsert/delete | source/destination hash·MIME·size 재검증 실패 시 finalize/event 0. M04/M09 |
| A2-09 | 잘린/206/오류 MIME/잘못된 이미지/오디오 | verified 불가, 원본/Storage 무단 변경 0. M13 |
| A2-10 | destination 중복 및 overwrite 시도 | upsert=false. 같은 의도·hash만 재개, 다른 hash 충돌 |
| A2-11 | Storage 성공·DB 실패/응답 유실 | 예약 사본 보존, 결과 조회 전 삭제 0. 재시도 사본/event 중복 0. M05/M06 |
| A2-12 | pin vs GC 양방향 barrier | pin 또는 deleting 하나만 승리. pinned 삭제 0. C13/M07/M08 |
| A2-13 | 준비-only article/project 삭제 | orphan ledger 보존, lease/grace/참조 검사 전 GC 불가. S14b/d |
| A2-14 | 원본 삭제/변경 후 공개본 bytes | 승인된 cleanup tombstone 이후 pinned 사본/hash 유지. 비공개 원본 fallback 0. M09 |
| A2-15 | 이용 중지·출처 불명 | 사본 존재와 무관하게 접근 차단. font·asset 현재 정책 미해석 시 blocker. M12 |
| A2-16 | 정기호/독립/다른 기사 file ID | membership 오용 차단, 정기호 파일/공개 상태 변화 0. A03/A04/R05/R06 |
| A2-17 | withdraw/replace 후 old file | 새 GET/HEAD/Range/304/변환 cache 모두 차단. 정기호 공개 유지. A05~A07 |
| A2-18 | 외부/public/signed 출처 | SSRF·상대 URL·다른 프로젝트·구 signed URL의 회수 한계를 차단/문서화. M10/M11 |
| A2-19 | 기존 삭제·TTS·upload cleanup | 보존 namespace 입력 거부, 기존 원본 작업 회귀 없음. Storage-first 위험 재현. M06~M09 |
| A2-20 | 권한·만료·동시 상태전이 | service worker 최소 권한, lease wall clock, request key 재사용, stale/소유권/삭제 경합. A01/C01~C05/C14~C16 |
| A2-21 | renderer 호환·실제 웹폰트·혼합 기사 | adapter를 공통 ArticleCard와 비교, 390/520/768/1440·글자 확대. 별도 승인 후 browser QA |
| A2-22 | 기존 정기호/검수/시연/파일·font 캐시 | 기존 R01~R10 유지. 새 독립 공개 성공으로 오인 보고하지 않음 |

SQL은 실제 PostgreSQL 다중 연결 barrier, object store는 byte-level fault injection으로 검증한다.
A2-17/21의 실제 HTTP·브라우저·원격 검증은 B/C 및 별도 Staging 승인 후 실행한다.
모의 object-store 성공을 Supabase Storage 보호 완료로 보고하지 않는다.

## 10. 원격 적용 전 차단 조건과 사용자 결정

- 백업/PITR·Storage 별도 복구·권한/보존 기간 미확인 상태에서는 migration/활성화 금지.
- 새 private bucket 또는 기존 prefix 대안, 실제 용량/MIME/worker 최소 권한에 별도 승인 필요.
- source-cleanup tombstone·이용 중지 정책, 폰트 byte 보존·현재 차단 정책 미확정.
- 전체 snapshot/renderer/canonical version 및 배포 호환 fixture 미완성.
- 기존 모든 삭제/upsert/TTS cleanup 경로의 보존 namespace 차단과 GC-pin 경합 미검증.
- 기존 article hard delete 보호의 API/UI 안내, READ COMMITTED 지원 범위·writer 교착 검증 필요.
- revision membership·철회·캐시·anonymous 파일 E2E 미완료. 공개 gate는 계속 off.

이번 문서로 bucket 생성·정책 변경·원격 DB 실행·새 UI/URL 활성화는 승인되지 않는다.
작성자 동선은 향후 **기존 4. 발행 → 이 기사 1건 확인 → 최종 확인 한 번**을 유지한다.
