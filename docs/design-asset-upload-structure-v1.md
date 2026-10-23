# 디자인 제작 자산 업로드 구조 점검 v1

작성일: 2026-10-24 (Asia/Seoul). 기준 main `e54ec309353c6355481d1338a500718d3c2a7c29`.
이번 구현은 디자인 관리의 기사 이동 링크 3개를 프로젝트 기사 목록으로 바꾸는 UI 수정뿐이다. 업로드 API·DB·Storage·인증·승인 계약은 변경하지 않는다. 실제 업로드·저장·발행 및 원격 설정 변경은 실행하지 않는다.

## 1. 복귀 동선

[디자인 관리 page](../src/app/projects/[projectId]/design/page.tsx)의 상단 ‘기사 제작으로 이동’, 작업 흐름 ‘3. 개별 기사 디자인’, 하단 ‘기사 선택 후 디자인 조정’이 모두 articleId 없는 `/reading`을 가리켰다. 이 경로는 [reading page](../src/app/projects/[projectId]/reading/page.tsx)에서 새 기사 화면으로 해석된다.

세 링크의 목적지를 `/projects/[projectId]/articles`로 통일한다. 같은 프로젝트의 목록 → 기존 기사 편집 → 2. 디자인으로 이동한다. 기존 목록의 신규 작성 버튼과 articleId deep link·선택·저장 계약은 그대로다. 자산 등록 전 입력을 자동 저장하거나 이전 기사 문맥을 임의로 추정하지 않는다.

## 2. 현재 파일 데이터 흐름

1. [단일 등록 UI](../src/components/project-design-intake-section.tsx) 또는 [일괄 등록 UI](../src/components/design/bulk-production-asset-import.tsx)에서 파일·유형·분류/승인 상태 선택.
2. 브라우저가 실제 파일을 multipart/FormData에 담아 `POST /api/project-design-kit/assets`로 전송. 일괄은 최대 20개, 파일당 개별 요청·동시 작업 최대 3개다. 20개를 한 요청에 묶지는 않는다.
3. [자산 API](../src/app/api/project-design-kit/assets/route.ts)가 `request.formData()`로 파일을 수신한 뒤 프로젝트 권한·파일 조건·분류 metadata·프로젝트 원본 연결을 검사한다. 요청 전체의 수신 전에 제한을 검사하는 구조는 아니다.
4. API가 service_role로 Storage에 전송. [기존 전송 helper](../src/lib/project-design-asset-write.ts)는 `x-upsert=false`를 사용한다. 브라우저에 서비스 키를 전달하지 않는다.
5. Storage 성공 후 `newsletter_project_design_assets`에 경로·크기·정규화 MIME·승인 상태 등을 기록. 파일과 DB 작업은 서로 다른 HTTP 요청이며 한 DB transaction이 아니다.
6. 등록 성공은 자산 생성일 뿐 Composition 배치·승인·발행을 자동 수행하지 않는다.

| 종류 | UI/서버 파일 제한 | 현재 목적지 계약 |
|---|---|---|
| 로고 | 5 × 1024² bytes | `brand-assets`(기존 공용 로고 경로) |
| 디자인 원본/참고자료 | 50 × 1024² bytes | `design-intake-assets`(비공개) |
| 웹 제작 자산 | 10 × 1024² bytes | `design-production-assets`(비공개) |

위 숫자는 앱 validator 및 버킷 자동 생성 코드의 목표 값이다. **현재 원격 버킷의 실제 limit/허용 MIME·요금제·잔여 용량을 조회한 결과가 아니다.** 기존 API는 버킷이 있으면 존재 확인만 하고 반환하므로 현재 설정이 이 값과 같다고 단정할 수 없다. 버킷이 404일 때 생성하는 기존 코드도 있으나 이번에 실행하지 않았다.

## 3. 용량·형식 검증의 한계

Vercel 공식 문서의 Function request/response body 제한은 **4.5MB**다. 현재 API가 파일 전체를 받으므로 앱의 10MiB/50MiB 허용값만으로 실제 배포 업로드를 보장하지 못한다. multipart overhead도 본문에 포함된다. 이 제한 전에 거절되면 앱의 상세 오류 안내까지 도달하지 못할 수 있다. 이번에는 실제 파일 요청으로 413을 재현하지 않았다.

- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations#request-body-size)
- [FUNCTION_PAYLOAD_TOO_LARGE](https://vercel.com/docs/errors/function_payload_too_large)

**임시 운영:** 제작용 이미지를 4MB 미만으로 줄여 개별 등록한다. 이는 여유를 두려는 운영 지침이며 성공 보장 수치가 아니다. 권한·네트워크·Storage 실제 limit/MIME·DB/metadata 준비 상태에 따라 더 작은 파일도 실패할 수 있다. 원본이 필요한 경우 보관할 원본과 웹용 축소본을 분리하며, 무조건 해상도를 낮춰 읽기 품질을 손상시키지 않는다. 임시 용량 지침을 영구 해결책이나 서버 제한 변경으로 표현하지 않는다.

현재 파일 validator의 실제 범위:

- 파일 확장자와 `File.size`가 허용 조건인지 검사한다.
- MIME은 PNG/JPEG/WebP/SVG 등 **확장자로 정규화**한다. 브라우저가 보고한 MIME과 실제 파일 내용이 일치하는지 검증한 증거가 아니다.
- 해당 수동 등록 경로에는 magic bytes, 디코딩 성공, 실제 가로/세로·총 픽셀 수·파일 SHA-256 검증이 없다. SVG를 XML로 파싱하거나 외부 참조/스크립트를 제거하는 처리도 없다.
- Canva 전용 importer의 PNG 바이트 검증은 별도 경로다. 이를 일반 수동 업로드 전체의 검증으로 간주하지 않는다.
- 이번 링크 수정으로 파일 검사나 기존 공개 renderer의 파일 취급을 바꾸지 않는다. 새로운 direct upload도 동일한 확장자 검사만으로 완료 처리해서는 안 된다.

## 4. 현재 실패·충돌 처리

- 경로는 프로젝트 ID/유형 아래 무작위 UUID 파일명이다. 동일 사용자 파일명 충돌을 피하고 기존 객체를 덮어쓰지 않는다. 다만 같은 파일을 다시 등록하면 새 UUID가 생기므로 내용 기반 중복 방지나 요청 idempotency는 아니다.
- Storage 성공 후 DB insert 실패 응답을 받으면 해당 업로드 파일 삭제를 시도하고, 정리 실패 시 `storage_cleanup_failed` 경고를 반환한다.
- 응답 유실·timeout·DB insert의 실제 commit 여부와 클라이언트 결과는 다를 수 있다. 현재 성공 응답 뒤 목록 조회가 실패하면 빈 목록으로 반환될 수도 있다. 목록에 안 보인다는 이유만으로 파일/DB가 없다고 결론 내리지 않는다.
- 재업로드는 동일 요청 복구가 아니라 새 객체·새 자산이 될 수 있다. 서버 DB 요청 결과가 불명확할 때 파일부터 삭제하면 실제 commit된 자산이 손상될 위험도 있다. 따라서 새 구조에서는 ‘실패하면 삭제’만 답습하지 않는다.
- 크기만 높이거나 Next 설정만 바꾸는 것으로 Vercel 요청 본문 제한 및 이 비원자성 문제가 해결되지 않는다.

## 5. 직접 업로드 대안 비교

| 방식 | 장점 | 필요한 보완·제약 |
|---|---|---|
| 현재 API 경유 | 기존 코드·권한·단건/일괄 UI 재사용 | 본문 제한, Function 메모리/시간·이중 전송, 중복/불확정 복구 한계 |
| 제한된 signed direct upload | 파일 바이트는 브라우저→Supabase. API는 작은 prepare/finalize JSON만 처리 | 사용자/프로젝트/정확한 경로/크기/해시/MIME/만료를 묶은 권한, 서버 재검증, 확정 결과·임시 객체 정리 필요 |
| TUS resumable | 큰 파일·불안정 네트워크에서 재개/진행률 | 업로드 인증·재개 세션·고아 객체 처리 및 클라이언트 의존성/운영 부담 증가. 단순 signed upload와 같은 인증 옵션이라고 가정하지 않음 |

Supabase는 표준 업로드를 작은 파일(6MB 이하)에 적합한 방식으로 설명하고, 6MB 초과나 불안정 네트워크에는 TUS를 권장한다. 이 권장 기준은 Vercel의 본문 제한과 다른 계층이며 현재 앱의 제한을 자동 변경하지 않는다.

- [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)

### 권장 최소 설계(미구현)

**prepare → private 격리 경로로 직접 업로드 → 서버 verify/finalize → 기존 제작 자산 등록**을 우선한다. 기존 버킷·일반 업로드/승인 API의 의미는 그대로 두고 additive 경로의 승인을 받는다.

1. prepare/finalize/result 모두 기존 인증, same-origin, 프로젝트 접근·잠금 해제 검사. service_role은 서버에만 둔다. Supabase Auth 계정이 있다는 가정이나 anon bucket INSERT 정책 추가로 HMAC 앱 인증을 우회하지 않는다.
2. prepare는 임의 bucket/path 대신 서버가 선택한 정확한 프로젝트·사용자·upload ID 경로를 발급한다. 제한된 signed Storage 권한과 앱의 intent를 구분하고, intent에 크기·SHA-256·허용 형식·만료·actor/project·자산 분류를 결합한다. 클라이언트는 경로나 승인 권한을 바꿀 수 없어야 한다.
3. 검증 전 파일은 제작 자산 조회/기사 파일 proxy의 접근 대상에서 제외한다. 단순히 private 버킷이면 안전하다고 단정하지 않고, 경로를 입력받는 기존 파일 제공 API도 확인한다. 기존 비공개 임시 버킷을 재사용할 수 있는지는 실제 정책/허용 MIME와 route 차단을 먼저 확인한다. 설정이 맞지 않으면 변경 전 별도 승인을 요청한다.
4. finalize는 재다운로드를 크기 제한 아래 stream으로 읽고 실제 byte length/SHA-256/MIME·이미지 디코딩·크기/총 픽셀 수를 확인한다. SVG는 별도 안전성 계약을 확정하거나 초기 범위에서 제외할지 결정한다. 원본 AI/PSD/PDF 접수와 웹 제작 이미지 검증을 혼동하지 않는다. 서버 검증·복사는 Function의 시간/메모리 부담이 남는다.
5. 검증된 파일만 기존 `design-production-assets`의 새 경로로 non-upsert 등록한다. 원본/사용 중 객체를 덮어쓰지 않는다. 사용자 파일명은 표시 정보로만 보관하고 경로 조각으로 신뢰하지 않는다. 동일 bytes라도 다른 프로젝트의 자산을 자동 공유하지 않는다.
6. 안정된 upload ID와 등록 ID/서버 결과를 결합해 재요청과 완료 결과 조회를 설계한다. 기존 unique/metadata 구조만으로 원자적 중복 방지가 충분한지 검토하고, durable receipt가 필요하면 별도 DB 변경 승인 대상으로 제시한다. 무조건 migration 불필요라고 미리 확정하지 않는다.
7. Storage 성공/DB 실패·응답 유실은 pending/확인 필요로 두고 같은 upload ID의 결과를 조회한다. 파일 존재나 목록만으로 commit을 판단하지 않는다. 확인된 참조가 없고 유효한 업로드/검증이 진행 중이지 않은 객체만 grace period 후 정리한다. 사용 중 파일을 GC가 삭제하면 안 된다.
8. 만료된 Storage 업로드 권한이 즉시 회수된다고 가정하지 않는다. 앱 intent가 만료돼 finalize를 막아도 뒤늦은 업로드가 도착할 수 있으므로 deadline·grace·재조회가 필요하다. signed URL/쿠키/intent는 로그·분석·PR에 기록하지 않는다.

서명된 업로드 URL 자체가 intent의 개별 크기·MIME를 Storage 계층에서 강제한다고 가정하지 않는다. 실제 bucket 제한·지원 API를 확인하고, 서버 finalize 검증 및 요청 수/대기 용량 제한을 함께 설계한다. 만료 전 URL은 bearer 권한이므로 노출과 과도한 임시 업로드에 대비해야 한다.

재사용 후보는 기존 프로젝트 권한 helper, 디자인 metadata/유형 validator, non-upsert 저장 및 자산 등록 helper, [프로젝트 파일 prepare/complete](../src/app/api/project-files/route.ts), [폰트의 private 임시 업로드·HMAC intent/바이트 검증 패턴](../src/lib/font-batch-server.ts)이다. 후자의 폰트 전용 경로·전역 hash ID·공용 fonts bucket 계약을 그대로 복제하지 않는다. 미병합 C1의 Sharp/Storage/namespace 보호 코드를 가져오지 않는다. 실제 이미지 검증 라이브러리·의존성은 별도 구현 검토 대상이다.

## 6. 후속 구현 전 확인 및 QA

- 실제 버킷 public/limit/MIME·RLS/ACL, 파일 proxy의 임시 경로 거부, 백업·정리 정책 읽기 전용 확인.
- 대상은 웹 제작 이미지부터. 원본 대용량 접수·TUS·SVG는 필요성과 안전성 확인 후 분리.
- 권한 없는 사용자/다른 프로젝트/변조 path·hash·MIME·만료 intent 거절.
- 작고 큰 파일·위장 확장자·손상 이미지·과도한 픽셀·동일 파일 재요청·동명 다른 파일 검증.
- Storage 성공/DB 실패·응답 유실·동시 finalize·늦은 업로드/GC 경합을 격리 테스트.
- 기존 단일/일괄 업로드·Canva importer·자산 승인·Composition·공개 파일 경로 회귀.
- 원격 쓰기/버킷·정책·DB 변경은 별도 승인 후 Staging에서만 검증하고 Production은 추가 승인.

이 문서는 직접 업로드 구현·설정 변경 승인이 아니다. 이번 PR에는 링크 보정 및 분석 문서만 포함한다. PR #255/#226/#229/#246–249, 기타 기존 OPEN PR과 stash 원본 2개는 변경하지 않는다.

## 7. 이번 링크 수정 검증

- 기존 관련 테스트 21/21 통과: 관리자 기사 목록/기존 articleId·신규 작성·인증, 디자인 접기/저장 상태, 안내 및 기관 자산 배치 경계.
- TypeScript·Webpack production build·diff 검사 통과. lint 오류 0, 기존 warning 3개 유지.
- 로컬 HTTP fixture에서 수정한 실제 design page와 ProjectAdminShell, 실제 기사 목록 page/list를 모의 데이터로 렌더링. 자산 입력·외부 연동 영역은 stub으로 제외하고 어떠한 실제 계정·DB·Storage에도 연결하지 않음.
- 실제 390/1440px iframe viewport에서 복귀 링크 클릭 → 같은 프로젝트 기사 목록 도착 확인. 문서 폭은 각 viewport 이하로 가로 넘침 없음. 렌더링된 보정 링크 3개 모두 같은 목록 href인지 확인. 기존 편집의 `articleId=local-article&tab=content` 및 신규 작성 `?tab=content` 링크 유지 확인.
- 위 검증은 로컬 SSR 링크/레이아웃 확인이며 Next client hydration·실제 원격 인증/업로드·작성 저장 E2E로 보고하지 않음. Preview CI 상태는 PR에서 별도 확인.
