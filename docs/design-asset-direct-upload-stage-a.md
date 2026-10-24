# 제작 자산 직접 업로드 — Stage A 계약·격리 검증

기준: main `9be837a56c7d68b1765c377944b164f62eb68984` (2026-10-24).
선행 조사: [기존 업로드 구조](design-asset-upload-structure-v1.md).
이 문서는 제안 계약이다. 운영 API, UI, DB, Storage, 인증, 버킷 설정은 변경하지 않는다.

## 1. 현재 확인된 흐름

`파일 선택 → FormData → Next.js API → 권한/입력 검사 → Storage POST → DB INSERT → 목록 재조회`

| 경로 | 현재 UI/API 제한 | 저장·접근 계약과 근거 |
| --- | --- | --- |
| 제작 자산 단건 | SVG/PNG/JPEG/WebP, 10MiB | [입력 화면](../src/components/project-design-intake-section.tsx), [공통 API](../src/app/api/project-design-kit/assets/route.ts) |
| 제작 자산 일괄 | 최대 20개, 파일별 10MiB, 동시 3개 | [일괄 등록](../src/components/design/bulk-production-asset-import.tsx). 파일마다 기존 API 호출, 묶음 트랜잭션 아님 |
| 디자인 원본 | AI/SVG/EPS/PSD/PDF, 50MiB | 같은 입력 화면/API, `source_design`, private `design-intake-assets` |
| 참고 자료 | PDF/PNG/JPEG/WebP, 50MiB | `reference`, private `design-intake-assets` |
| 로고 | SVG/PNG/JPEG/WebP, 5MiB | [키트 폼](../src/components/project-design-kit-form.tsx), 같은 API, public `brand-assets` |
| 제작 자산 저장 | background/illustration/icon/card_frame/banner/pattern/decoration | private `design-production-assets`, 기존 UI에서 승인 상태 지정 가능, 기본 draft. 현재 삽입은 `is_active=true` |

위 public/private·제한값은 코드/SQL이 의도한 구성이다. 이번 작업에서 원격 버킷의 실제 설정을 조회·검증한 것은 아니다.
근거 SQL: [v1.15 자산 테이블](../supabase/schema_v1_15_project_design_assets.sql), [v1.22 원본/참고 자료](../supabase/schema_v1_22_design_intake_foundation.sql), [v1.23 제작 자산](../supabase/schema_v1_23_design_production_assets.sql). RLS 활성화만으로 실제 ACL·역할 상속·Storage object 접근까지 확인한 것으로 보지 않는다.

- API는 `request.formData()`로 파일 전체를 받은 다음 권한을 확인한다. 화면의 10/50MiB 허용이 Vercel 전송 성공을 보장하지 않는다. Vercel Function 요청/응답 본문 제한은 4.5MB이며 multipart 부가 크기도 포함된다. 임시로 **4MB 미만 이미지**를 권고할 수 있으나 성공 보장치는 아니다. [공식 제한](https://vercel.com/docs/functions/limitations)
- `normalizeMimeType()`는 확장자로 MIME을 추정한다. 현재 이 API의 검증은 확장자·신고 크기·MIME 중심이며 실제 바이트 디코딩, 해시, 이미지 해상도, SVG 안전성 검증을 완료하지 않는다.
- 경로는 서버 UUID로 `projects/<projectId>/logos|source-design|references|production/<type>/...` 생성. 원본 파일명을 경로로 그대로 쓰지 않으며 Storage 전송은 `x-upsert:false`다. 같은 파일을 다른 요청으로 보내는 중복 등록은 방지하지 않는다.
- [권한 검사](../src/lib/project-api-access.ts)는 기존 HMAC 사용자, 프로젝트 소속, 프로젝트 잠금 조건을 검사한다. [역할](../src/lib/app-auth.ts)은 admin 또는 프로젝트 assignee와 연결된 user다. Supabase Auth 사용자의 직접 INSERT 권한을 전제로 설계하지 않는다. 이 helper 자체에 same-origin 검사가 있는 것으로 간주하지 않는다.
- [파일·DB 쓰기](../src/lib/project-design-asset-write.ts)는 서로 별도 작업이다. 명확한 DB 오류 후 파일 정리를 시도하지만 정리 실패·전송 오류·응답 유실을 원자적 rollback으로 볼 수 없다. 등록 후 목록 재조회 실패와 등록 실패도 구분해야 한다.
- 기존 `ensureAssetBucket()`은 없는 버킷을 생성하며, 이미 있는 버킷의 실제 공개 여부·제한을 모두 재검증하지 않는다. 신규 흐름은 이를 재사용해 자동 생성하지 않는다.

### 삭제·참조·승인

기존 PATCH는 프로젝트 소유권을 확인하고 활성 상태·승인·메타데이터를 변경한다. Canva provenance를 보존한다. 등록, 승인, 활성화, 배치, 공개는 각각 다른 단계다.

- 비로고 DELETE: DB 삭제를 먼저 확정하고 Storage를 정리한다. Composition 참조 충돌은 `409 asset_in_use`. 로고는 파일 삭제가 먼저인 별도 경로여서 DB 실패 시 불일치 위험이 있다. 이번에는 바꾸지 않는다.
- [v1.25](../supabase/schema_v1_25_article_compositions.sql)의 소속·슬롯/종류 검증과 자산 project/type 변경 보호, [v1.26](../supabase/schema_v1_26_composition_asset_delete_integrity.sql)의 `NO ACTION DEFERRABLE INITIALLY DEFERRED` 자산 FK를 유지한다. Storage 직접 삭제는 이 FK가 보호하지 못한다.
- 기존 스키마에 Storage 경로의 전역 UNIQUE를 발견하지 못했다. 파일이 공유되지 않는다고 추정해 GC하면 안 된다. 신규 경로는 세션별 객체를 사용하며 기존 객체를 해시만으로 합치지 않는다.
- 공개 reader의 ready/visible/active/approved 및 지원 슬롯 조건은 그대로다. draft 편집 배치 허용과 공개 허용을 혼동하지 않는다. 새 업로드 성공은 Composition 적용 성공이 아니다.

## 2. 권장 구조 및 범위

작은 JSON 제어 요청은 앱 서버, 파일 바이트는 브라우저→Storage, 검증·확정은 서버가 담당한다. 검증 전 파일은 **비공개 격리 위치**에만 존재하며 자산 테이블이나 파일 프록시로 노출하지 않는다.

기존 private 버킷을 사용할 수 있는지는 object policy·공개 프록시의 prefix 허용 범위를 확인한 뒤 결정한다. 격리 보장이 불가능하면 전용 private quarantine 버킷 승인이 필요하다. 아직 버킷을 선택·생성하거나 정책을 변경하지 않았다. 기존 공용 로고 버킷으로 미검증 객체를 직접 보내지 않는다.

Stage B 첫 대상은 제작용 PNG/JPEG/WebP의 단건 업로드, 이후 같은 세션 API를 파일별로 호출하는 일괄 업로드다. SVG/AI/PSD/EPS/PDF와 로고는 자동 전환하지 않는다. SVG는 스크립트·외부 참조·CSS 등을 안전하게 처리하는 별도 계약 없이는 신규 경로에서 거절한다. 원본·참고 문서는 이미지 디코더를 통과시켜 안전하다고 판단하지 않는다.

기존 10MiB 제한을 유지한 채 전송 경로부터 전환한다. 대용량 지원은 전송 우회만으로 끝나지 않는다. 다운로드 검증의 메모리·시간·해상도 상한을 먼저 측정해야 하므로 100/300MB 제작 이미지 지원을 약속하지 않는다. 원본 보관의 50MiB 확대도 별도 단계다.

## 3. 제안 API 계약 — 아직 미구현

경로명은 제안이며 현재 운영 route가 아니다. 모든 제어 응답 `Cache-Control: no-store`; 토큰은 URL 분석·로그·오류·trace·PR에 기록하지 않는다. signed upload URL은 bearer 권한이며 서버 검증이나 사용자 인증의 대체물이 아니다.

| 단계 | 입력/출력 | 필수 서버 동작 |
| --- | --- | --- |
| `POST .../uploads/prepare` | requestKey(UUID), projectId, 표시용 파일명, size, MIME, SHA-256, assetType, 선택적 parentSourceAssetId → sessionId, 상태, 고정 경로의 제한된 upload capability, 만료 | HMAC 로그인·same-origin·프로젝트 권한/잠금·부모 소속 검사. 확장자/종류/크기 사전 검사. 클라이언트 bucket/path/승인/active 무시·거절. 세션을 **권한 발급 전에** 영속 저장 |
| Storage 직접 전송 | 발급된 경로로 파일 전송 | 서버가 발급한 bucket/path만, `upsert:false`, 인증 헤더 외부 전송 금지. 취소는 전송 중단일 뿐 서버 삭제·토큰 폐기를 보장하지 않음 |
| `POST .../uploads/<session>/finalize` | sessionId; 파일 경로·검증 결과는 입력받지 않음 → registered receipt 또는 pending/rejected | 사용자·프로젝트 권한 재검사, 세션 잠금/lease. bounded download, 바이트 검증, 검증된 객체 보존, DB 자산+세션 결과의 단일 DB 트랜잭션 |
| `GET .../uploads/<session>` | 동일 사용자/프로젝트의 세션 → 현재 상태, 등록 assetId, 존재/수명 상태 | 응답 유실 후 결과 확인. 목록이 비었다는 이유로 등록 실패를 단정하지 않음. 토큰·다른 사용자의 세션 미노출 |

### 만료·중복·영속성

제안: 앱 intent 30분, requestKey 범위 `(project,user,key)`, 정규화된 허용 입력의 digest 비교. 같은 key/같은 입력은 같은 세션·결과, 다른 입력은 409. 최종 assetId/경로는 세션에 고정하고 UNIQUE로 중복 INSERT를 차단한다. 파일명은 NFC 정규화한 표시 값, 경로에는 UUID만 사용한다. 소속 ID는 서버 조회값으로 고정한다.

Supabase signed upload URL은 공식 문서상 2시간 유효하다. 앱 intent 만료를 토큰 폐기로 표현하지 않는다. 만료 후 늦게 도착한 객체는 등록 불가이며, capability 만료·진행 중 TUS/업로드·grace window 확인 후 정리한다. 재발급은 동일 경로 무한 토큰 연장이 아니라 권한 재검사·횟수/총기한 제한이 필요하다. [signed upload](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl), [upsert 동작](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl)

큰 파일/불안정 네트워크에는 TUS를 우선 평가한다. 공식 문서는 6MB 초과에서 resumable 권고, signed upload token을 `x-signature`로 사용하는 경로도 제공한다. 앱 HMAC 쿠키나 service_role 키를 TUS 클라이언트에 전달하지 않는다. 재개 URL·토큰·fingerprint는 민감정보로 취급하고 만료/로그아웃 시 정리한다. [공식 TUS 안내](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)

**영속 세션/결과 기록이 필요하다.** 서명된 무상태 intent만으로 프로세스 재시작·응답 유실·다중 인스턴스 finalize/GC를 해결할 수 없다. 기존 asset metadata에 임시 상태를 섞지 말고 최소 upload session 테이블을 Stage B에서 별도 승인받는다. SQL은 이번에 작성하지 않는다.

필요 필드: 세션/프로젝트/사용자/requestKey, 입력 digest, 신고 및 실제 파일 정보, temp/final 경로, policy version, 만료, 상태/lease/version, 최종 assetId·receipt, 오류 코드·정리 시각. 토큰 원문 저장은 피한다. RLS/ACL은 비서버 직접 접근 금지, server-only 권한 및 RPC 내부 사용자/프로젝트 검사. 역할/정책 실제 검증은 원격 적용 전 필수다.

## 4. 검증·등록·복구 불변식

1. Storage HEAD의 MIME/size만 믿지 않는다. 서버가 허용 프로젝트·세션 경로에서 bounded stream으로 읽고 SHA-256, 실제 바이트수, signature, 디코더 형식, width/height/pixel 수를 검사한다. 중단·타임아웃·누락은 pending/retryable 또는 rejected로 명확히 구분한다.
2. PNG/JPEG/WebP 디코딩과 decompression bomb 제한은 검증된 라이브러리로 처리한다. 재인코딩/EXIF 제거 여부는 보존 품질·애니메이션·색공간 영향 평가 후 결정한다. 새 변환 서비스는 추가하지 않는다. 업로드 SVG를 PNG 검증으로 통과시키지 않는다.
3. 사용자 쓰기 권한은 temp 경로에만 준다. 검증 후 서버 전용 final 경로로 검증한 바이트를 `upsert:false` 저장하고 재다운로드 해시를 확인한다. 기존 final 객체가 있으면 같은 바이트인지 확인하고 다르면 격리한다. 클라이언트가 검증 뒤 바꿀 수 있는 temp 경로를 그대로 자산으로 등록하지 않는다.
4. DB 확정 시 프로젝트 존재/권한·parent 소속·세션 상태·제한을 재검사한다. 자산과 receipt를 한 DB 트랜잭션으로 기록한다. 신규 경로 기본 제안은 draft/inactive, 승인·활성화·배치는 별도 명시 행동이다. 기존 API의 active 기본값을 변경하지 않는다. 이 정책 차이는 Stage B UI/운영 검토 대상이다.
5. Storage 성공/DB 실패: final 객체를 즉시 삭제하지 않는다. 서버 결과를 조회하고 같은 세션으로 재검증/확정한다. DB 성공/응답 유실: 기존 receipt를 반환하며 자산을 다시 만들지 않는다. 삭제/비활성화된 자산을 finalize 재시도로 복원하지 않는다.
6. 동일 파일/다른 key는 새 등록 의도로 구분한다. 동일 프로젝트·종류·해시 후보를 안내할 수 있으나 승인된 기존 자산을 자동 합치거나 다른 프로젝트의 존재를 알려주지 않는다. 동일 key만 확실하게 idempotent다.
7. GC는 만료·토큰 유효기간·진행 중 lease·DB 참조를 재검사하고 finalize와 동일 잠금/펜싱 계약을 사용한다. lease 탈취 후 늦게 끝난 worker의 쓰기는 CAS/fencing으로 거절한다. DB 조회 실패 시 삭제하지 않는다. DB 미연결 파일과 등록된 파일의 삭제 경로를 분리한다.
8. 등록 후 삭제는 기존 Composition FK와 서버 삭제 정책을 존중한다. 등록 receipt 보존기간 동안 tombstone을 유지하여 재시도 부활을 막는다. 승인/삭제/배치와의 실제 DB 다중 연결 경합은 Stage B 필수 테스트다.

상태: `prepared → verifying → storage_ready → registered`; 입력 불일치는 `rejected`, 미전송/만료는 `expired`, 회수 대상은 별도 cleanup 상태. 전송 오류나 DB 결과 조회 실패를 `failed/rolled_back`로 단정하지 않는다. lease·재시도·복구는 서버 내부 처리, 작업자 화면은 준비/전송/확인/완료/확인 필요 정도로 단순화한다.

## 5. 이번 격리 검증의 범위와 한계

[계약 모델](../tests/fixtures/design-upload-stage-a.cjs), [테스트](../tests/design-upload-stage-a.test.cjs).
실행: `node --test tests/design-upload-stage-a.test.cjs`.

19개 테스트: 익명/origin/프로젝트/소유자 거절, requestKey 재사용·충돌, 크기/종류 입력, 경로 변조·overwrite, 미업로드 재시도, 실제 크기/MIME/해시/signature/해상도 실패, 디코더 부재/실패, Storage 후 DB 실패, 커밋 후 응답 유실, 중복 finalize/GC, 만료 후 늦은 전송, 삭제 후 재시도 부활 방지, final 경로 충돌, 다른 key의 같은 바이트 분리.

**성공한 것은 메모리 모델의 계약 검증이다.** 실제 서버 인증은 테스트 actor로, Storage는 Map으로, DB 트랜잭션은 동기 commit으로, 이미지 디코더는 주입한 probe로 모의했다. 기존 `validateCanvaPng()`의 signature/CRC/IHDR 검사는 실행했지만 이 함수는 IDAT 전체 디코더가 아니다. JPEG/WebP/SVG 검증·실제 이미지 디코딩·DB 다중 연결·재시작 내구성·원격 Storage/TUS·브라우저/CORS·실파일 업로드 E2E는 **미검증**이다. 이를 배포 가능한 구현이라고 보지 않는다.

Composition 보존은 기존 런타임 미변경 및 관련 회귀 테스트로 확인한다. 새 DB FK/삭제·승인 경합 구현이나 원격 검증을 완료했다는 의미가 아니다. UI/API 미변경이므로 전체 Webpack 빌드를 불필요하게 반복하지 않는다.

이번 실행: 신규 19/19 통과. 기존 PNG import·Composition 복사/저장 상태·기관 자산 배치·제작 안내를 포함한 선택 회귀는 총 74개 중 73개 통과, 1개 건너뜀(`CANVA_SQL_TEST_RUNTIME` 미지정인 기존 격리 SQL 테스트). 두 신규 CJS 파일 ESLint, 문서 로컬 링크, diff check 통과. 전체 테스트·TypeScript·Webpack build 및 원격 E2E를 실행한 것으로 보고하지 않는다.

## 6. 원격 적용 전 확인/승인 필요

- 실제 Supabase 요금제·총/잔여 용량·프로젝트 전역 및 버킷별 파일 크기/허용 MIME, 전송 비용·제한. 코드에서 요금제나 잔여 용량을 추정하지 않는다.
- Production/Staging DB/Storage 식별자 분리, 실제 bucket public 여부, object RLS/GRANT/service_role, 기존 공개 proxy의 temp prefix 접근 여부. 비밀키·토큰은 출력하지 않는다.
- signed URL의 경로 범위/upsert/TTL/동시 충돌, TUS 만료·진행 중 전송 종료·partial 가시성, CORS, 재다운로드 일관성. 공식 문서와 실제 환경을 분리한다.
- 임시 버킷/정책, 영속 세션 migration·권한, 리소스 quota/rate limit, Storage/DB 백업·복구, 정리 작업 운영 권한. 변경마다 별도 승인 필요.
- 발급 URL의 로깅·분석·에러 추적 제외 및 Referrer 정책. 클라이언트에 service_role 미노출. 서버 세션 권한 변경/로그아웃 후 finalize 차단.
- 격리 DB 다중 연결로 finalize/GC/삭제/승인/프로젝트 삭제/lease 만료 경합, 실제 실패 주입 및 프로세스 재시작 복구 완료 전 운영 전환 금지.

## 7. Stage B 파일·충돌·전환 순서

재사용 참조: [일반 파일 직접 업로드](../src/app/api/project-files/route.ts), [폰트 private 임시 업로드](../src/lib/font-batch-server.ts). 인증·검증 패턴만 참고하고 글로벌 폰트 해시 dedup이나 기존 파일 업로드 계약을 무분별하게 복제하지 않는다.

예상 신규 파일: upload session migration/격리 DB 테스트, prepare/finalize/status routes, server-only 검증·repository·Storage adapter, 별도 업로드 클라이언트. 기존 intake/일괄 등록 화면은 승인된 gate 아래에서 점진적으로 연결한다. 검증 전에는 UI 버튼을 노출하지 않는다.

| 공통 파일/영역 | 충돌·보호 |
| --- | --- |
| `src/app/api/project-design-kit/assets/route.ts` | C1 #248 삭제 namespace 보호와 충돌 가능. 기존 업로드 API는 이번에 미수정. 새 route 우선, 기존 DELETE 연계는 별도 검토 |
| `src/lib/newsletter-file-storage.ts`, `src/lib/supabase-config.ts` | C1 Storage/namespace 정책과 겹침. C1 코드 가져오지 않음. temp namespace와 독립 발행 보존 namespace 분리 |
| `src/lib/image-delivery-server.ts`, TTS 파일, package.json/lock | C1 Sharp/이미지·파일 전달 변경 영역. Stage A 수정 없음; 새 검증 라이브러리 선정 시 병합 재검토 |
| Composition 및 #255 | 전체 디자인 복사와 자산 유효성·삭제 참조가 만남. 복사 RPC/승인/공개 조건 변경 금지 |

A1→A2→C1은 기존 미병합 계획으로 유지하며 C1 namespace 과잉 차단 결함이 남아 있다. 업로드 작업 때문에 이 PR들을 선병합하지 않는다. Stage B를 최신 main에서 별도 PR로 진행하고 공통 파일 수정 전 C1 실제 diff를 다시 비교한다. 기존 #226/#229/#246–249/#255는 변경하지 않는다.

점진 전환: (1) 세션/DB/검증 격리 구현 → (2) 승인받은 Staging private 설정·실파일 실패/보안 E2E → (3) 기존 경로와 병행하는 제한된 제작 이미지 gate → (4) 파일별 결과·재시도 일괄 UI → (5) Production 별도 승인. 기존 API·원본/로고/Canva import는 유지한다. 문제가 있으면 새 발급 gate를 끄고 진행 중 세션을 조회·정리하며 기존 권한을 완화하거나 등록 객체를 일괄 삭제하지 않는다.
