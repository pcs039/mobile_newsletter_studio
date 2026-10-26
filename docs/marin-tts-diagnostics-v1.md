# Marin Speech 진단 보완 v1

기준은 PR #274 head `a751532adcbea0809d5142329398ba5e25eba7d3`이다. 기존 복구 계약과 SQL은 유지한다. 이 문서는 진단 보완 PR에 한정하며 실제 Speech 호출·migration·Staging 재배포를 승인하지 않는다.

## 보완 범위

- Speech HTTP 요청마다 고유 UUID를 `X-Client-Request-Id`로 전송한다. Marin 실행의 로그는 같은 ID로 연결한다. DB 선점 전에 시작되는 `db_claim` 로그로 생성 시도와 연결할 수 있다.
- 헤더 수신 즉시 허용된 HTTP 상태와 `x-request-id`를 진단 컨텍스트에 보존한다. 본문 수신 중 예외가 나도 안전한 `SpeechRequestError`에 이 값이 남아, 기존 `marin_recovery_record` RPC의 상태·요청 ID 컬럼에 전달된다.
- 이 변경은 이미 존재하는 `unknown` 행을 수정하거나 과거 요청에 추적 ID를 소급 부여하지 않는다. 기존 요청은 선점 검사에서 차단되고 다시 생성되지 않는다.
- Speech 대기 제한은 **90,000ms 그대로**이며 fetch와 본문 수신에 같은 signal을 사용한다. timeout, 명시적 abort, 헤더 전 네트워크 오류, 본문 읽기 오류, 크기 제한, HTTP 거절을 구분한다. timeout 사건과 발생 단계(`headers`/`body`)를 함께 본다.

공식 근거: [OpenAI 요청 추적](https://developers.openai.com/api/reference/overview#debugging-requests). `X-Client-Request-Id`는 추적용이며 서버 측 중복 처리 방지나 유료 작업의 재실행 허가를 의미하지 않는다. 기존 at-most-one DB 선점 및 unknown 잠금을 계속 사용한다.

## 기록할 단계와 필드

| 단계 | 관측 범위 |
| --- | --- |
| `db_claim` | 기존 예약 RPC 요청과 응답; 응답 유실도 실패로 기록하되 재선점하지 않음 |
| `request` | Speech 요청 시작부터 전체 MP3 본문 수신까지 |
| `headers` | fetch 시작부터 응답 헤더 수신까지 |
| `body` | 헤더 수신부터 응답 본문 수신까지; HTTP 오류 본문 포함 |
| `validation` | 받은 MP3의 기존 framing·크기·바이트 해시 검사 |
| `db_record` | 검증 결과 또는 기존 허용 오류의 기록 |
| `storage` | 기존 불변 경로 업로드 요청·응답 |
| `storage_verification` | 저장본 재조회 및 기존 해시·형식 비교 |
| `db_complete` | 기존 완료 RPC 및 완료 응답 검증 |

공통 진단 모듈의 출력은 `version`, `clientRequestId`, `phase`, `state`, `elapsedMs`, `durationMs`, `httpStatus`, `providerRequestId`, 선택적인 허용 오류 `failure`뿐이다. 시간은 monotonic clock 기준 ms이며 `started/completed/failed`를 구분한다. Marin adapter만 고정 event 이름 `marin_recovery_tts`와 고정 원요청 식별자 `parentId`를 추가해 JSON 서버 로그로 남긴다.

인증키·Authorization 헤더·쿠키·사용자/관리자 ID·승인 문구·대본·음성 바이트·전체 제공자 오류·raw exception/cause는 기록하지 않는다. 제공자 요청 ID도 형식 및 키 echo 검사 후 사용한다. logger 실패는 실행 결과나 재시도 정책에 영향을 주지 않는다.

HTTP 200을 받았어도 본문이 중단되면 생성 성공이 아니다. phase는 `body`, failure는 예를 들어 `timeout`/`body_read`가 되고 journal은 기존 정책대로 unknown이 된다. SQL `last_error` 허용값은 변경하지 않아 `provider_unknown`으로 남지만 세부 오류는 로그에서 확인한다. Storage 응답 유실 후 동일 파일이 검증되면 기존대로 완료할 수 있으며, 유실 사건과 검증·완료 사건을 각각 기록한다.

## 영속성과 복구 한계

새 테이블·컬럼·RPC는 없다. client trace ID와 단계별 시간은 서버 로그에만 있으므로 로그 보존 기간이 지나면 조회하지 못할 수 있다. 필요한 운영 증거는 해당 기간 내 비밀값 없는 진단 이벤트로 별도 보관해야 한다. 헤더가 도착하지 않았다면 제공자 상태·요청 ID는 null이다. 추적 ID가 있어도 실제 처리·과금·파일 복구 여부는 제공자의 확인 없이 단정하지 않는다.

새 진단은 바이트가 없는 기존 unknown 요청을 무료로 복구하는 기능이 아니다. 현재 unknown 및 pending 행을 초기화하거나 재요청하지 않는다. 자동 재시도·자동 reconcile·기능 flag ON 전환을 추가하지 않는다.

## 일반 기사 TTS 재사용

공통 `requestOpenAiSpeech`는 고유 추적 헤더를 추가한다. 기존 3인자 호출의 API 키 선택, 요청 본문, 성공·HTTP 실패 반환 형식 및 transport 예외 계약은 유지한다. 진단 로그/안전한 typed error는 optional diagnostics를 전달한 경우에만 활성화된다. Marin은 기존 `STAGING_OPENAI_API_KEY`만 사용하며 일반 키 fallback은 없다.

향후 일반 기사 TTS에서도 별도 실행 단위마다 `createTtsDiagnostics`를 생성해 전달할 수 있다. 이번에는 일반 생성·분할·재시도·저장 정책과 UI를 바꾸지 않는다. 일반 기능의 관측을 활성화하려면 그 경로의 비용·중복 처리 계약을 별도로 검토해야 한다.

## 검증 및 배포 경계

테스트는 fetch/stream/DB/Storage mock과 비음성 MP3 fixture를 사용한다. 정상 완료, 헤더 전 timeout/네트워크/abort, 헤더 후 본문 중단/timeout, 크기 제한, HTTP 거절, 비밀 echo, logger 오류, DB·Storage 응답 유실, 동일 요청 재실행 차단을 확인한다. 시간 초과는 실제 90초 대기나 제공자 호출 없이 재현한다.

배포 금지 조건을 위해 `vercel.json`의 `git.deploymentEnabled`에서 **`codex/marin-tts-diagnostics-v1` 한 브랜치만 false**로 지정한다. 다른 브랜치는 기본값을 유지한다. [Vercel 공식 계약](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled)을 사용하며, 연결된 프로젝트 설정·환경변수는 변경하지 않는다. 로컬 빌드 통과를 Preview 배포 성공으로 보고하지 않는다.

Staging은 기존 OFF 배포를 유지한다. 원격 DB/Storage baseline 및 실기기 청취는 이번 로컬 코드 검증의 대상이 아니며 실제 유료 재검증은 별도 승인이 필요하다.

### 이번 검증 결과

- Speech scoped-key / Marin engine / adapter / 신규 진단 테스트: **58/58**, skip 0. 신규 시나리오는 21개다.
- 전체 `node --test tests/*.test.cjs`: **715 통과, 14 skip, 실패 0** (총 729). skip은 별도 PGlite/pg 모듈 경로 등 로컬 SQL 런타임 미설정에 따른 기존 opt-in 테스트이며, SQL 미변경을 해당 DB 테스트 통과로 대체 주장하지 않는다.
- TypeScript `npx tsc --noEmit`: 통과.
- lint: 오류 0, 기존 경고 3개.
- `npm run build -- --webpack`: 통과.
- diff 검사: 통과. 실제 OpenAI/원격 DB/Storage 요청 및 Staging 재배포는 하지 않았다.
