# 개발 체크포인트 및 화성시·신안군 샘플 작업 인계

기록일: 2026-10-22 (Asia/Seoul). Repository: `pcs039/mobile_newsletter_studio`.
이번 작업은 문서 보존과 샘플 전용 브랜치 준비에 한정한다. 독립 발행 코드 보정·병합·원격 적용·샘플 데이터 변경은 하지 않는다.

## 1. 보존 기준

- 최신 확인 main = origin/main = `449ee01cdc76cd4b5638413bde76e6ce2f3fc5b7`.
- 시작 브랜치: `codex/article-independent-publication-c1`, HEAD `bab9dc5d2a5ba968ddc3fda43bada25816cf2d64`, working tree clean.
- 문서 브랜치: `codex/development-handoff-2026-10-22`. main에서 분기한 문서 전용 PR, 미병합 유지.
- 샘플 준비 브랜치: `codex/hwaseong-sinan-proposal-samples`, 위 main에서 분기. 문서 PR과 독립 발행 코드를 포함하지 않는다. 실제 디자인/데이터 변경은 아직 없다.
- 기존 stash는 적용·삭제·재작성하지 않는다.
  - `a330dcb89d1a043b6c7430ac711b48242176fc1b`
  - `66e70a2e33a3f594b71716359470d69774e761b7`

| 작업 | 보존 브랜치 / head | 현재 상태와 판단 |
|---|---|---|
| [A1 #246](https://github.com/pcs039/mobile_newsletter_studio/pull/246) | `codex/article-independent-publication-a1` / `07f9818f63e14ac6da0e3da6ff08190233394f45` | 격리 상태·revision·이벤트·권한·삭제 경합 검증 완료, OPEN·미병합 |
| [A2 #247](https://github.com/pcs039/mobile_newsletter_studio/pull/247) | `codex/article-independent-publication-a2` / `1e2e1683f79569a7268998df3ee08335d7b1c589` | snapshot/모의 private 미디어/pin·GC 격리 검증 완료, OPEN·미병합 |
| [C1 #248](https://github.com/pcs039/mobile_newsletter_studio/pull/248) | `codex/article-independent-publication-c1` / `bab9dc5d2a5ba968ddc3fda43bada25816cf2d64` | 모의 Supabase 및 실제 로컬 PostgreSQL 검증 완료, namespace 과잉 차단 결함으로 병합 보류, OPEN |
| [디자인 설계 #226](https://github.com/pcs039/mobile_newsletter_studio/pull/226) | `codex/article-design-ux-simplification-v1` / `4d6a0e6f04d29456cefa080b2db69d4431101e3e` | OPEN 유지, 참고만 사용 |
| [직접 발행 설계 #229](https://github.com/pcs039/mobile_newsletter_studio/pull/229) | `codex/author-direct-publishing-design-v1` / `5e11066f75ddc966bd0b246b5b963b97f459daab` | OPEN 유지, 변경 없음 |

A1 base=main, A2 base=A1, C1 base=A2. 기준 head의 GitHub MERGEABLE/CLEAN 및 Vercel SUCCESS를 확인했다.
이 상태가 결함 해소 또는 실제 Supabase/독립 공개 동작 검증 완료를 의미하지 않는다.

## 2. 마지막 검증과 실행 범위

- C1 head에서 마지막 전체 회귀 **608/608**, 실패/skip 0. A1/A2/C1 격리 및 기존 기능 테스트 포함.
- TypeScript·lint·Webpack Production build·diff check 통과. 기존 lint warning 3개 외 신규 warning 없음.
- main의 기존 이미지 encoder와 C1 공식 Sharp 구현을 비교: GPT/Canva × 480/960/1600 × WebP/AVIF, 총 12건 byte 동일. 입력은 로컬 합성 PNG이며 실제 기관 자료의 Retina 시각 QA는 아니다.
- 기존 정기호 발행/기관 검수 RPC 정의 및 DB 권한 계약 변경 없음. 독립 발행 SQL v1.41/v1.42는 원격 미적용이며 기존 앱 route에서 독립 발행 RPC를 호출하지 않는다.
- 실제 Supabase 보존 adapter는 운영용 ledger/인증 binding이 없다. 테스트의 Storage HTTP는 모의 transport이며 Production/Staging 비밀키를 사용하지 않았다.
- 이번 독립 발행 단계의 실제 Production/Staging DB·Storage 원격 적용, 새 버킷 생성, 실제 독립 발행·철회는 미실시다. 기존 서비스 데이터·인증·환경변수·Production 배포를 변경하지 않았다.
- 저장소에서 자동 SQL 적용 workflow/배포 script는 발견하지 못했다. 루트 `supabase/schema_v1_*.sql`은 수동 문서 경로이며 CLI 자동 migrations 디렉터리에 있지 않다. 설치 시 DB 이름/loopback, 실행 시 service_role/격리 GUC/READ COMMITTED 가드가 있다. 외부에서 별도 관리하는 자동화는 미확인이다.

## 3. C1 미해결 결함 — 먼저 보정하고 재검증

`src/lib/article-publication-storage-policy.ts`의 `isPublicationStorageReference`는 예약어 조각을
경로 위치와 관계없이 차단한다. 이 검사가 공통 Storage endpoint와 파일/TTS path filter에 연결돼
있으므로, 정상 원본 파일의 조회·업로드·삭제·정리도 이름 충돌로 거부할 수 있다.

재현 예:

- 일반 `mobile-assets` 버킷의 `independent-publications/176-example.png`는 **허용되어야 하지만 현재 차단**된다.
- 일반 `fonts` 버킷의 `library/independent-publications/font.woff2`도 현재 차단된다.
- 프로젝트 slug `independent-publications`는 기존 slug 정규화에 유효하며, 기존 파일 업로드는 `{slug}/{timestamp}-{uuid}.{ext}`를 사용한다. 실제 Production에 해당 이름의 자료가 존재하는지는 조회하지 않았다.

최소 보정 방향:

1. 전용 버킷 이름 `article-publication-preserved`는 정확히 식별해 기존 generic 제공/수정/삭제 경로에서 차단한다.
2. 보존 경로는 정확한 `independent-publications/v1/` namespace 경계에만 적용하고, 일반 경로의 같은 이름 조각을 무조건 차단하지 않는다.
3. bucket과 object path, Supabase endpoint 문법, DELETE body의 path를 구분한다. 단순 예약어 삭제나 정상 경로 임시 예외 추가로 해결하지 않는다.
4. URL 인코딩, 다중 인코딩, 슬래시·역슬래시·경로 변형으로 보호 경계를 우회할 수 없어야 한다. authenticated/public/sign 경로와 DELETE body도 검증한다.
5. 정상 프로젝트 slug·폰트 폴더 허용과 전용 버킷/prefix 차단을 모두 회귀 테스트에 추가한다. 전체 테스트·TS/lint/build·Preview를 다시 확인한다.

기존 608개 테스트에는 이 정상 경로 충돌 사례가 없다. 전체 테스트 통과와 별도로 발견한 미해결 결함이며, 이번 체크포인트에서 코드를 수정하지 않는다.

## 4. 디자인 개발과의 충돌 지도

main 대비 누적 독립 발행 변경은 28개 경로다. A1은 문서/격리 SQL/테스트 4개,
A2는 신규 문서/라이브러리/격리 SQL/테스트 9개, C1은 18개(앞 단계 파일 일부 포함)다.
main과 세 head의 조상 관계는 정상이며 현 시점 Git 충돌은 없다. 이후 디자인 개발에서 다음 파일을
수정하면 C1과 직접적인 diff 또는 동작 충돌이 생길 수 있다.

| 영역 | 직접 겹치는 파일 | 디자인 작업 지침 |
|---|---|---|
| 이미지 전달/압축 | `src/lib/image-delivery-server.ts`, `tests/image-delivery.test.cjs` | C1은 Next 내부 encoder를 공식 Sharp로 교체한다. resize/quality/AVIF/PNG fallback/캐시 변경은 별도 비교·재검증 필요 |
| native dependency | `package.json`, `package-lock.json` | C1의 sharp@0.35.4 direct dependency와 플랫폼별 native 설치를 보존. lockfile 전체 재생성 피하기 |
| Storage 공통 연결 | `src/lib/supabase-config.ts` | 모든 기존 이미지·다운로드·폰트 proxy 및 업로드에 간접 영향. C1 예약 namespace 판별 결함을 디자인 브랜치에 가져오지 않기 |
| 일반 이미지/음성/페이지 파일 | `src/lib/newsletter-file-storage.ts` | upload/upsert·삭제·download 경로 검사 변경이 C1 보호와 겹침. 정상 bucket/path 계약 유지 |
| Design Asset API | `src/app/api/project-design-kit/assets/route.ts` | 원본 삭제/path 검증과 충돌 가능. 샘플 자산 사용을 위해 이 API를 새로 변경하지 않기 |
| 기사·e-book TTS | `src/lib/article-tts-audio.ts`, `src/lib/ebook-tts-audio.ts` | segment 정리/path 안전 검사 충돌 가능. 저장된 음성 사용과 코드/생성 변경을 구분 |

다음은 A1/A2/C1에서 직접 수정하지 않았지만 간접 회귀를 확인할 영역이다.

| 영역 | 현재 재사용 파일 | 간접 위험 / 보존 계약 |
|---|---|---|
| Composition | `src/components/design/article-composition-editor.tsx`, `composition-asset-picker.tsx`, `src/lib/article-composition-repository.ts` | 자산 URL은 공통 Storage/proxy 의존. 배치 자동 저장, textDesign 명시 저장, draft/approved/ready/visible 구분 유지 |
| 기관 자산·Canva | `src/components/design/institution-asset-match-controls.tsx`, `article-canva-templates.tsx`, `canva-design-review-controls.tsx`, `canva-png-import-controls.tsx`, `src/lib/project-design-asset-write.ts` | 후보≠제작≠검토≠import≠자산 승인≠적용. Storage 공통 helper와 생성 gate에 간접 영향 |
| 글꼴 | `src/components/article-font-settings.tsx`, `article-font-settings-context.tsx`, `src/lib/font-css.ts` | 기존 ID/상속·Context/RSC·공개 CSS를 보존. 공용 fonts proxy의 기존 `public, max-age=300` 정책을 독립 공개 파일 정책과 혼동하지 않기 |
| 기사 저장·reader | `src/components/project-article-editor-form.tsx`, `public-mobile-article-reader.tsx`, `article-workspace-tabs.tsx` | main의 저장·Composition 충돌 보호·미리보기·확대 계약 유지. 독립 revision snapshot은 아직 연결되지 않음 |

A2 신규 `src/lib/article-publication-{canonical,snapshot,media}.ts`와 C1 신규 store/policy는
샘플 브랜치에 없다. 기존 `src/lib/article-publication.ts`는 정기호 공개/정렬용 별도 모듈이다.
Composition/Canva/글꼴 UI 개선을 이유로 독립 발행 코드를 임의 cherry-pick하거나 해당 모듈들을 통합하지 않는다.

## 5. 독립 발행 재개·병합·원격 적용 조건

재개 시 main과 세 PR head, stash, 미해결 결함부터 재확인한다. 이후 별도 병합 승인 후에만
**A1 → A2 → C1** 순서로 merge commit을 사용한다. 각 단계 뒤 후속 PR base를 main으로 바꾸고
누적 diff에 앞 단계가 다시 포함되지 않는지 확인한다. 브랜치는 성급하게 삭제하지 않는다.
현재 기준 A1/A2는 격리 코드 병합 검토 가능, C1은 위 결함 보정 전 보류다.
각 병합은 자동 Production 배포로 이어질 수 있으므로 동일 merge SHA 배포와 읽기 전용 회귀를
단계별로 확인한다. 코드 병합 승인은 원격 SQL/버킷 적용 승인이 아니다.

다음은 아직 구현·검증 완료로 간주할 수 없는 원격 적용 차단 조건이다.

- 운영용 durable ledger, 서버 인증 actor/assignee/source 소유권 binding과 권한 검토.
- 전용 private 버킷, read/insert/delete 최소 권한, service_role의 RLS 우회 및 overwrite/delete 위험 대응.
- Storage 성공/DB 실패, 지연 업로드/응답 유실/worker 재시작, deleting claim·pin/GC fencing 및 orphan sweep 실증.
- 실제 원본 삭제/upsert·TTS 정리 이후 사본 보존, physical path/version 매핑, 원본 이용중지/cleanup 정책.
- DB backup/PITR·Storage 복구, retention·고아 revision 정리 정책 확인.
- 독립 revision/file membership·철회·교체, GET/HEAD/Range/304·CDN/no-store HTTP 검증.
- 실제 common reader adapter와 이미지/글꼴/HTML/CTA/음성 시각·내용 일치 및 비공개 기사 navigation 차단.

이미 다운로드한 파일이나 별도 공용 원본 URL은 철회로 회수할 수 없다. 이를 권한 완화나 signed URL 노출로 우회하지 않는다.

## 6. 화성시·신안군 제안 샘플 시작 동선

새 샘플 브랜치는 main의 기존 제작 기능만 사용한다. 기관별 실제 프로젝트·기사·자산의 존재나
Production/Staging 연결 상태는 이번 문서 작업에서 조사·생성하지 않았다. 다음 제작 작업에서
대상 환경/자료/사용 범위를 확인한 뒤 진행한다. 이번에는 기사 저장·업로드·생성·승인·발행을 실행하지 않는다.

1. 기존 프로젝트 목록에서 화성시/신안군 작업 대상을 구분한다. 대상이 없다면 생성·데이터 작업 범위를 먼저 확정한다.
2. 기관 디자인(`/projects/{slug}/design`)에서 기존 CI·색상·등록 Design Asset을 확인하고, 기사 목록(`/projects/{slug}/articles`)에서 작성/수정에 진입한다.
3. `1. 작성`: 제목·요약·본문·HTML 공공정보·이미지 block·링크/CTA를 기존 폼으로 구성한다. 중요한 날짜·연락처·신청 정보는 이미지에만 고정하지 않는다.
4. `2. 디자인`: **디자인 선택 → 세부 디자인 조정 → 미리보기·확인**을 사용한다. 글꼴은 이 단계의 기존 검색기에서 변경한다.
5. 기존 Composition의 배경판과 상단 이미지·장식, HTML 소제목/번호/라벨, 색상·여백·배치 도구를 우선 사용한다. 다른 기사 배치 복사는 기존 확인 절차를 유지한다.
6. 기관 자산 추천은 후보 선택 후 배치 위치/교체 확인을 거쳐 명시적으로 적용한다. 기존 picker는 클릭 즉시 배치 저장이므로 두 동작을 혼동하지 않는다. draft 편집 허용과 공개 승인 조건을 구분한다.
7. 이미 등록된 Canva/GPT 결과는 provenance·승인·적용 가능 조건을 확인해 재사용한다. 기존 Canva 동선은 추천/템플릿 선택 → 명시적 제작 → 결과 검토 → 별도 PNG import → 자산 검토/승인 → 명시적 적용이다. 자동 제작·승인·발행하지 않는다.
8. Canva export/import·GPT 이미지 적용 등 일부 실행은 fixed Staging gate/별도 RPC가 필요하다. 메뉴가 보인다는 이유로 Production 실행 가능하다고 판단하지 않는다. gate가 닫혀 있으면 준비된 웹용 이미지의 기존 수동 등록 경로를 검토하며 우회하지 않는다.
9. 즉시 미리보기 390/520과 저장본 미리보기를 구분하고, 글자 확대·긴 제목/본문·이미지 확대·CTA를 확인한다. 최종 표시에는 Composition ready, visible, asset active/approved 및 기존 프로젝트 공개 권한이 필요하다.

공개 미지원 슬롯 3개(제목 아이콘·본문 장식·하단 배너)는 샘플의 독자 화면 표현 수단으로 사용하지 않는다.
로고는 이미지 생성의 수정 대상으로 취급하지 않는다. AI/PSD 등 원본을 브라우저용 이미지로 자동 변환한다고 가정하지 않는다.
폰트 파일 호환성 이슈 #239, 새 외부 API, migration, 인증·Storage 구조 변경, 독립 기사 발행 UI는 샘플 기한 이후 별도 작업으로 남긴다.

기존 참고: [현재 디자인 흐름](article-design-workflow-ux-v1.md), [기관 자산 적용](institution-web-asset-placement-v1.md),
[디자인 감사](design-workflow-audit-v1.md), [Canva 검토/import](canva-approved-design-import-v1.md).
문서의 과거 `미적용/OPEN` 표현은 당시 기록이므로 실제 환경의 최신 권한·gate·배포 상태와 구분해 확인한다.
