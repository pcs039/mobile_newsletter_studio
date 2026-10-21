# Staging 폰트 메타데이터 권한 차이 — 보안 조사 v1

- 기준 main: `1d403683d878e3a64b8cc32f8e65ea397562b558`
- 조사 근거: 2026-10-21 읽기 전용 DB catalog SELECT, 파일 내용 없는 HEAD, 현재 서버 코드.
- PR #244와 연결하되 독립 발행 구현/권한 보정은 수행하지 않는다. 별도 보안 이슈: [#245](https://github.com/pcs039/mobile_newsletter_studio/issues/245).
- secret·키·토큰·쿠키·개인정보·폰트 객체 경로를 기록하지 않는다. anon CRUD 쓰기 시험, RLS/grant 수정, 계정 생성 없음.

## 1. 확인된 차이와 실효 권한의 한계

| 대상 | Production | Staging |
|---|---|---|
| font_assets / font_families RLS | on | **off** |
| anon/authenticated 테이블 grant | SELECT/INSERT/UPDATE/DELETE 있음 | SELECT/INSERT/UPDATE/DELETE 있음 |
| 위 두 표 대상 pg_policies | 조사 결과0 | 조사 결과0 |
| service_role | 서버 접근 가능, BYPASSRLS | 서버 접근 가능, BYPASSRLS |
| fonts Storage bucket | public | public |

Production은 RLS on+허용 policy 없음이므로 테이블 grant가 있다는 이유만으로 행 열람/변경 가능하다고 단정하면 안 된다. 익명 font 메타데이터 HEAD는200/가시 행0이었다. Staging은 RLS가 꺼져 있어 grant의 위험을 RLS로 막지 못하는 상태다.

Staging 로컬 설정에 사용 가능한 anon key가 없어 실효 익명 API 접근은 **미확인**이다. 인증키 없는 요청401은 RLS 보호 증거가 아니다. 실제 INSERT/UPDATE/DELETE는 실행하지 않았다. PostgREST 노출 schema/실제 공개 API 키/추가 네트워크 보호를 포함한 도달성은 별도 확인이 필요하다. 이를 이유로 catalog상 권한 차이를 무시하지 않는다.

Storage public font 1건씩의 익명 HEAD는 양쪽200이었다. 공용 webfont 공개는 기존 의도된 계약이며 메타데이터 표 쓰기 허용과 별개다. 파일명·경로·URL은 보고하지 않았다.

## 2. 서버 읽기·쓰기 호출 경로

| 경로 | 현재 검사/호출 | 최소 권한 보정 영향 |
|---|---|---|
| `src/app/projects/fonts/page.tsx` | 기존 세션 및 역할에 맞춰 폰트 관리 화면 렌더링 | 기존 화면 역할 계약 유지 |
| `src/lib/newsletter-repository.ts:getFontAssets` | server-only, getRequestHeaders(true)로 service role REST SELECT, 필요 시 family 관계 포함 | anon SELECT를 열 필요 없음 |
| 기사 편집/공개 reader의 폰트 로딩 | 서버가 font metadata 조회, `font-css.ts`가 @font-face 출력 | browser의 직접 metadata CRUD에 의존하지 않음 |
| `/api/font-assets` POST/PATCH | requireApiUser, admin 검사 → service role Storage/DB 등록·상태 변경 | 기존 admin만 변경하는 의미 유지 |
| `/api/font-packages` POST/PATCH | requireApiUser, admin 검사 → service role family/assets 등록·상태 변경 | 기존 ZIP/패밀리 상태 API 유지 |
| `/api/font-batch` POST prepare/complete | requireApiUser, admin, same-origin → 서명된 업로드 권한/서버 파일 검증/DB 등록 | 임시 업로드 권한은 파일/사용자/만료에 제한, service key 브라우저 전달 금지 |
| `/api/public-files/preview?bucket=fonts` | 서버 service role로 active/webfont_allowed 검사 후 proxy | **공용 폰트는 public,max-age=300**, 일반 회수 파일과 구분 |

동일한 same-origin 검사가 모든 legacy 폰트 API에 있다고 주장하지 않는다. 이번 보정 범위는 테이블 권한 조사이며 legacy API 변경은 별도 검토다. 기존 활성화·비활성화·font ID·공개 렌더링 정책은 변경하지 않는다.

## 3. 위험 및 최소 보정안 (미구현)

- 위험: Staging의 공개 API까지 도달 가능한 anon/authenticated 주체가 metadata를 열람·등록·수정·삭제할 가능성. 앱 admin 검사만으로 직접 REST 접근을 보호할 수는 없다.
- 영향 후보: family/asset 메타데이터 변조, active/webfont_allowed/파일 참조 오염, 기사 font 참조의 SET NULL 영향. 실제 악용/데이터 변경 사실은 확인하지 않았다.
- 공개 Storage 바이트 열람 자체는 기존 공용 웹폰트 계약이다. 이를 막거나 버킷을 private으로 전환하는 안은 이번 보정에 포함하지 않는다.
- 최소안: **Staging 두 표에 RLS on + PUBLIC/anon/authenticated 직접 CRUD 권한 회수**, service_role의 현재 서버 읽기/쓰기만 유지. 불필요한 broad allow policy/인증 우회 추가 금지.
- Production 값·정책은 변경하지 않는다. Staging 변경도 별도 SQL/설정 적용 승인이 필요하다. default privileges와 현재 grant를 함께 검토하되 다른 표/일반 Preview에 일괄 적용하지 않는다.

## 4. 별도 승인 뒤 Staging 검증 순서

1. schema·RLS·grant·policy·행수/digest·기존 font ID·참조 baseline을 기록한다. secret/행 내용을 로그에 남기지 않는다.
2. 유효한 Staging 전용 공개 키로 HEAD/limit0 등 읽기 전용 접근부터 확인한다. 키는 로그/명령 출력/PR에 남기지 않는다.
3. 별도 승인된 최소 권한 보정 적용. Production/Storage/auth/env는 변경하지 않는다.
4. catalog에서 RLS on, PUBLIC/anon/authenticated CRUD 회수, service role 경로 유지 확인. 잘못된 anon/auth 주체의 행 노출이 없는지 읽기 전용 확인한다.
5. anon CRUD 쓰기 차단은 우선 격리 DB에서 전체 검증한다. 원격 쓰기 거부 시험도 이번 승인에는 없으며 필요하면 별도 승인받는다.
6. 인증된 Staging에서 폰트 관리 목록·검색·기사 font ID 복원·@font-face/공용 proxy 실제 로드·관리자 미리보기 확인. 등록·상태 변경·기사 저장 QA는 추가 승인된 fixture 범위에서만 한다.
7. 데이터/참조 baseline 불변, 일반 정기호/public reader/미리보기/업로드 인증 회귀 확인.

## 5. 장애 대응·롤백

- 사전 RLS/grant/policy 상태와 복구안을 별도 승인 자료에 기록한다. 이번에는 SQL을 작성하지 않는다.
- 예상치 못한 admin 서버 접근 장애는 관리 작업을 중단하고 service role/서버 호출 경로를 먼저 확인한다. 해결을 위해 anon 허용 policy를 임의 추가하지 않는다.
- 기존 RLS off/broad CRUD로 돌아가는 것은 보안 재노출이므로 자동 rollback하지 않는다. 최소 서버 권한 복구를 우선 검토하고, 위험한 권한 복원이 필요하면 별도 승인을 요청한다.
- font bucket 공개/기존 파일/CSS/기사 ID는 rollback 과정에서도 변경하지 않는다. metadata 손상 복구는 사전 백업·참조 확인이 필요하며 테스트로 운영 row를 수정하지 않는다.

## 6. 완료 기준과 현재 상태

현재는 catalog 차이 및 서버 경로 조사만 완료했다. Staging 실효 익명 API 권한, 별도 권한 변경, 원격 anon CRUD 거부 시험은 미완료다. 이 문서는 설정 보정 완료 증거가 아니다. A1 격리 DB 구현과 별개로 관리하되 원격 QA/적용 전 보안 승인 항목에 포함한다.
