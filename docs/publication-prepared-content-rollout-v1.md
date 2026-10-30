# 발행 버전별 콘텐츠 사전 준비 — 적용 계획 v1.0

- 기준: 2026-10-30 / Staging `51537b51176b9427368c6705a2cf4549872fe5eb` (PR #289).
- 상태: **문서 전용 제안**. 아래 migration·Storage 준비·배포·활성화는 실행하지 않았다. 각 후속 승인 범위를 넘어 자동 진행하지 않는다.
- 계약: [아키텍처](publication-prepared-content-architecture-v1.md), 합격 조건: [테스트 계획](publication-prepared-content-test-plan-v1.md).

## 1. 범위와 변경 예산

| 대상 | 향후 필요한 변경안 | 이번 단계 |
|---|---|---|
| 신규 DB 메타데이터 | `newsletter_prepared_contents`, `newsletter_prepared_content_heads` 2표, PK/UNIQUE/소유권 FK·CAS/조회 인덱스·RLS | 설계만 |
| 신규 내부 RPC | claim, finalize, activate, resolve 4개. 상태 조회는 현재 권한을 거친 제한 SELECT | 이름·계약만. SQL 파일 없음 |
| 기존 DB | project/article/Composition/음성/share 컬럼 추가 0개, 기존 발행·독립 기사 이벤트 변경 0개, 공통 dirty trigger 추가 0개 | 불변 |
| private Storage | 승인된 파생 이미지 prefix와 무결성 proof; 현재 bucket/권한 호환성 확인 필요 | 쓰기/복사/삭제 없음 |
| reader/API | 현재 권한 확인 뒤 준비본 재사용, stale/miss 동적 복귀. 기존 미디어 gateway 확장 검토 | 코드 변경 없음 |
| TTS/원고/원본/사진·디자인 | 기존 선택과 바이트 재사용 | 생성·교체·삭제 없음 |
| 운영·배포 | 기능 gate 기본 OFF 및 프로젝트 allowlist 제안 | 환경변수·Vercel·Staging·Production 변경 없음 |

신규 테이블은 기존 공개본을 보존하는 별도 발행 시스템이 아니다. 더 작은 비영속 메모리 캐시만으로는 재배포·다중 서버 간 ready/head/재시도를 연결할 수 없어 최소 영속 메타데이터를 제안한다. 반대로 모든 writer를 수정하는 source generation/복잡한 미디어 ledger/신규 큐 서비스는 v1에서 제외한다.

## 2. 단계별 실행 순서와 승인

| 단계 | 작업·선행조건 | 승인/완료 조건 |
|---|---|---|
| R0 현재 | 3개 설계 문서·계약·링크·docs-only 검증 | 설계 리뷰. 코드/SQL/배포 없음 |
| R1 격리 구현 | source 투영·canonical hash·payload validator, 신규 표/RPC SQL 초안 및 로컬 격리 PostgreSQL·Storage mock | **구현/SQL 작성 승인** 후 시작. source snapshot·CAS·권한·fault 테스트 통과 |
| R2 Staging 사전 실사 | 실제 ref/현재 schema·권한·발행 구조, private bucket/객체 identity/기존 삭제 경로, 최소 복원 수단 확인 | 읽기 전용 실사 승인 범위 확인. 불일치/복원/객체 검증 차단 원인을 먼저 보고 |
| R3 Staging DB만 | 신규 메타데이터/RPC/RLS 적용, gate OFF. 원본 DML·발행 이벤트 생성 없음 | **정확한 대상·DDL·권한·복귀 계획의 원격 migration 승인**. 설치 후 기존 발행/저장 동작 유지 |
| R4 Staging 앱 OFF | 새 resolver/builder 배포. 기존 #289 동적 경로 기본 유지 | **Staging 코드 배포 승인**. 신규 schema 미설치/flag OFF/일반 Preview/Production 차단 확인 |
| R5 disposable 시범 | 관리자 명시 실행으로 준비·private 파생 파일 생성·proof·ready. shadow 비교만 먼저 수행 | **지정 테스트 프로젝트·신규 DB/Storage 쓰기 승인**. 기존 정기호·화성 샘플·음성 불변 |
| R6 Staging reader 제한 ON | synthetic regular + synthetic Demo의 head 연결·권한/회수/편집/장애·성능 비교 | **특정 프로젝트의 serving 활성화 승인**. 독립 기사 공개 계약과 기존 링크가 바뀌지 않음 |
| R7 화성 Demo 적용 | 실제 승인된 7건의 읽기 전용 비교, 새 준비 metadata/파생본만 생성·연결 | **화성 프로젝트 opt-in 및 파생 쓰기 승인**. 기존 링크 재발급·기사/MP3 저장/삭제·정식 발행 없음 |
| R8 Production | 별도 DB/코드/운영 승인과 아래 사전 조건 | 자동 승격·main 병합 금지. 준비 권한과 외부 발행 권한도 구분 |

R2에서 필요한 백업은 현재 운영/작업 데이터와 제안 DDL의 복구 가능성을 확인하는 최소 범위다. 과거 테스트 자산 전체의 보존·복원 실험을 다시 요구하지 않는다. 이전 Staging 키체인 백업 등의 이력이 있다고 이번 시점의 최신 백업·Production 복원 수단이 확인된 것으로 간주하지 않는다.

## 3. 첫 구현의 구체적 제한

1. 신규 표 2개·RPC 4개 외 DB 변경이 필요하면 사유와 정확한 차이를 먼저 보고한다. 기존 project publication RPC의 인자/업무 예외/이벤트/상태를 수정하지 않는다. 독립 기사 A 설계의 5표를 묶어 도입하지 않는다.
2. read resolver가 매 요청 fresh source digest를 확인하는 v1을 먼저 구현한다. 단순 cache TTL/비동기 알림으로 즉시 수정 반영을 대체하지 않는다.
3. durable 작업 상태는 preparing row/attempt/lease로 제한한다. 실제 실행자가 요청 종료 이후에도 지속된다고 가정하지 않는다. 처음에는 승인된 관리 작업으로 실행·상태 확인·명시 재개한다. 자동 예약/worker는 검증된 기존 실행 수단이 없으면 별도 후속 범위다.
4. metadata/schema 조회, source capture·무결성 확인을 제어 가능한 단계로 나눈다. lease가 유효한 작업을 두 요청에서 중복 처리하지 않는다. 입력이 다른 재시도는 새 준비 ID/키다.
5. 코드에 고정된 화성 편집·관광·만평·음성 선택 규칙과 mapper를 기존 컴포넌트로 재사용한다. 시스템 전체를 새 제작 엔진으로 재작성하지 않는다.
6. source Storage가 mutable이고 현재 객체 identity를 확실히 검증하지 못하면 해당 미디어는 기존 동적 경로다. 이를 해결하려고 원본 버킷·일반 업로드·기존 파일을 임의 변경하지 않는다.
7. 새 파생본은 원본과 다른 경로, upsert=false. 원본 이미지·폰트·MP3·Composition은 수정하지 않는다. 14개 논리 음성의 기존 선택을 보존하며 04번 공유 파일을 두 개의 독립 원본이라고 만들지 않는다.
8. 준비본에 개인정보·비공개 의견·설문 응답·관리자 원본·토큰·쿠키·원시 Storage URL을 넣지 않는다. 댓글·신규 외부 공유·유료 호출은 도입하지 않는다.

## 4. Staging 시범의 순서

1. 코드 SHA·현재 Staging alias·DB 신원·원본 기준값을 고정한다. #287~#289 PR 및 stash 2개 원본을 기록한다.
2. disposable 정기호와 Demo를 분리한다. 기존 화성 프로젝트의 7개 기사와 기타 테스트 복제본을 구분하고 scope 누출 fixture를 만든다.
3. DB/앱 OFF 배포 후 원래 reader와 미디어 경로가 작동하는지 확인한다. 준비 테이블 존재가 기존 v1.40 revision·저장 데이터를 바꾸지 않아야 한다.
4. 준비 상태만 생성하고 shadow로 동적 표현과 비교한다. 이 단계는 ready여도 독자 제공/발행을 활성화하지 않는다.
5. synthetic regular를 기존 publish 경로로 발행한 뒤 새 head를 연결한다. 반대로 준비 실패 시에도 원래 동적 발행이 가능한지 확인한다. 기존 실제 발행물을 사용하지 않는다.
6. synthetic Demo를 별도 grant로 열어 prepared hit/miss/stale, 원고 변경·회수·만료·쿠키 차단을 검증한다. 실제 영업 링크는 회수/만료 fixture로 사용하지 않는다.
7. 권한·동적 fallback·Storage proof·동시성·과거 URL 차단이 통과한 다음 동일 조건 5회 성능 비교를 수행한다. 동적 권한 비용까지 포함한다.
8. 허용된 경우에만 실제 화성의 준비본을 만들고 현재 reader와 비교·연결한다. 원고/디자인/파일은 그대로이며 외부 공개 권한을 새로 부여하지 않는다.

R6/R7의 기능 gate 명칭은 구현 승인 때 확정한다. 최소한 builder 실행과 reader serving을 따로 OFF 할 수 있어야 하며, 정확한 APP_ENV/DB ref/도메인/프로젝트 allowlist를 함께 확인한다. 이전 Marin 복구 flag를 재사용하거나 켜지 않는다.

## 5. 실패 시 복귀

| 상황 | 복귀 동작 |
|---|---|
| 성능/표현 회귀 | reader serving만 OFF, 현재 #289의 fresh 권한+동적 경로로 복귀. 기존 source/MP3/링크/발행 상태 유지 |
| builder 오류·부하·Storage 문제 | builder 예약/실행 OFF, 진행 작업 lease/attempt 확인. 정상 준비본 사용 여부는 별도 판단; 원본 파일로 정리하지 않음 |
| 새 schema/RPC 불가 | 기존 접근 검증이 가능하면 동적 reader. 권한/원본 확인도 불가능하면 fail closed |
| 잘못된 활성 head | serving OFF 또는 승인된 head CAS 해제. 과거 임의 준비본을 되살리는 대신 현재 동적 제공 |
| 잘못된 ready payload/파생본 | 해당 준비본 사용 중단, 새 ID로 재준비. ready payload/파일 경로 덮어쓰기 금지 |
| 앱 이전 SHA 복귀 | #289 동적 구현으로 돌아가도 기존 원본과 새 메타데이터가 공존해야 함. 신규 표 drop/Storage 삭제를 rollback으로 사용하지 않음 |

포인터는 공개 권한이 아니므로 stale head가 잠시 남아도 비공개/회수/삭제 자료를 제공하지 않아야 한다. gate OFF는 기존 소식지 발행 취소나 Demo 회수가 아니다. 실제 DB/Storage 파괴적 rollback, 원본 복원, 준비 파일 정리는 별도 승인이다.

재시도는 상태 조회 → lease/파일 proof/현재 source 확인 → 동일 키의 안전한 재개 또는 새 입력의 새 작업 순서다. 응답이 불명확한데 활성화/파일 업로드를 무조건 반복하지 않는다. 기존 TTS 실패 기록 복구·삭제는 이 경로에 끼워 넣지 않는다.

## 6. Production 진입 조건

- Staging R1~R7의 권한·snapshot·부분 실패·원고 즉시 반영·구/신 renderer·회수·시간 경계 검증과 요청별 성능 증거가 있다. 개선되지 않은 지표와 실기기 미검증을 명시한다.
- 정기호 revision/현재 상태/발행 이벤트·기관 승인-only·독립 기사 설계 계약을 유지한다. 새 캐시가 발행 성공 조건을 바꾸지 않는다.
- Production 실제 schema/권한·자산 객체 identity와 삭제/교체 경로를 읽기 전용으로 확인하고, 제안 DDL·영향·설치 순서·원복 범위를 별도로 승인받는다.
- Production의 현재 데이터 복구 수단과 권한·보관 위치를 확인한다. Staging에서 수용한 Mac 키체인 단독 복구키 위험을 Production 승인으로 확대하지 않는다.
- 준비 write 권한과 원본/TTS write 권한을 분리하고 최소화한다. anon/authenticated의 준비 테이블 접근과 원본 Storage 직접 URL 우회가 없다.
- 준비본 사용 중지 즉시 동적 reader로 복귀할 수 있다. 원본 삭제·정리·migration down 없이 복귀한다.
- main 병합, Production migration, Production 배포/시범 활성화 및 실제 외부 발행은 각각 명시된 승인 범위 안에서만 진행한다. 이 문서 승인만으로 실행하지 않는다.

## 7. 문서 PR 및 배포 금지 확인

이 단계의 허용 diff는 이 설계 문서 3개뿐이다. src, supabase, vercel.json, 환경변수, DB/Storage, 현재 배포 브랜치는 변경하지 않는다. 서비스 빌드·TTS·원격 migration·실제 기능 테스트도 실행하지 않는다.

저장소는 새 브랜치 push에도 자동 Preview가 연결될 수 있다. 따라서 문서 PR 제출 전 현재 CI/Vercel의 docs-only skip을 확인한다. skip이 보장되지 않으면 배포를 실행해 놓고 '문서만 바뀌었다'고 처리하지 않는다. 문서 작성·검증·로컬 commit을 먼저 완료하고, 원격 제출을 위해 필요한 **문서 브랜치 한정 배포 차단 또는 Preview 허용 범위**를 사용자에게 확인한다. 이를 위해 기존 Production/공통 배포 설정을 임의 변경하지 않는다.

최종 검증 항목: docs-only diff, 상대 링크와 코드 근거, 버전/상태/이벤트 namespace 구분, 실패 시 동적 fallback과 거부 구분, 실측/목표/미검증 표기, 기존 main/Staging/PR/stash 불변. 신규 문서 PR은 OPEN·미병합으로 유지한다.
