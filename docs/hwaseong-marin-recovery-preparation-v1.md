# 화성시 Marin pending 요청 복구 준비 v1

## 범위와 실행 상태

기준은 PR #271 head `54fca51d0c1bf780a1fb614a0989bbd8ceb1106c`이다. 이번 변경은 문서와 애플리케이션에서 import하지 않는 격리 준비 함수·테스트뿐이다. 새 API, DB migration, 복구 실행 adapter, 자동 재시도는 구현하지 않는다. 준비 함수는 모든 결과에서 `executionAllowed: false`를 반환한다.

원격 DB/Storage 쓰기, OpenAI 음성 생성 및 유료 호출은 이번 작업에서 0회다. 환경변수와 Production은 변경하지 않는다. 고정 Staging에 이 준비 코드를 배포할 필요도 없다. 기존 [Phase C 계약](hwaseong-ux-phase-c.md)과 [Staging 키 분리](hwaseong-staging-tts-key-v1.md)를 유지한다.

## 2026-10-25 읽기 전용 재확인

| 항목 | 확인값 |
| --- | --- |
| 대상 요청 ID | `e2041281-42e2-5363-a329-43db98714355` |
| Staging DB ref | `mvrkpmffuhcqwisqvpqi` |
| 프로젝트 ID | `4cd5297e-a0fd-434c-84d4-fa4d3baf9389` |
| article_id | `null` — 기사별 음성이 아닌 음질 비교 요청 |
| 제목 | `[시연 TTS v1] 음질 비교 marin` |
| 음성 / 모델 | `marin` / `gpt-4o-mini-tts` |
| 상태 | `script_status=pending`, `ai_tts_generated_at=null` |
| 생성·수정 시각 | 모두 `2026-10-25T06:18:52.579765+00:00` |
| 대본 길이 | 74자, 청크 1개 |
| 대본 바이트 SHA-256 | `d216ab7c167a569f6b78beec03d27ad6e9dc088a534334c6bb3d7c4d02ae4470` |
| 기존 요청 결합 해시 | `e204128142e2c363432943db98714355fba056c9534e24df529f116522e2973d` |
| 예정 경로 | `projects/4cd5297e-a0fd-434c-84d4-fa4d3baf9389/sample-tts-v1/e2041281-42e2-5363-a329-43db98714355/000.mp3` |
| 객체 조회 | HTTP 400 응답의 명시적인 `Object not found`; 일반 HTTP 오류를 부재로 간주하지 않음 |
| 이전 baseline 비교 | 원행 전체 및 객체 부재 관측 불변 |
| 원행의 제공자·복구 감사 메타데이터 | 전용 필드 없음; `pronunciation_note=null` |

`ai_tts_text_hash`는 대본만의 해시가 아니다. 기존 job·음성·모델·정규화 대본·버전 조합으로 재계산한 해시 및 UUID가 저장값과 일치했다. 원행 JSON baseline의 SHA-256은 `b69dced2953149ad357726ca0566ea797ff1da5138ad3db1fc918e142ce76bd2`였다. 격리 함수의 `parentFingerprint()`는 명시된 검토 필드의 순서 있는 튜플을 해시하므로 이 전체 JSON 해시와 서로 다른 용도다.

대본:

> 화성의 오늘을 더 가까이. 생활과 관광, 문화와 사람을 잇는 모바일 소식지입니다. 글자를 키우고, 편안한 속도로 소식을 들어 보세요.

### 과거 호출과 비용의 확인 한계

- 기존 기록에는 첫 Marin speech 시도 1회와 생성 실패, 파일 미생성이 남아 있다. 이전 Vercel 요청은 종료된 것으로 관측됐다. 장래 실행 시에는 기존 작업 종료 여부를 다시 확인해야 하며 시간 경과만으로 종료를 추정하지 않는다.
- 저장된 자료에서 직접 확인되는 `401 invalid_api_key`는 **이후 모델 조회**의 응답이다. 최초 speech 요청의 정확한 제공자 HTTP 응답·`x-request-id`·usage·청구 영수증은 보존되지 않았다. 따라서 최초 speech가 반드시 같은 401이었다고 확정하지 않는다. 앱 POST의 HTTP 200도 음성 생성 성공을 의미하지 않는다.
- 현재 Staging 전용 키의 모델 조회 HTTP 200은 기존 확인 결과다. 이번 준비 과정에서 OpenAI API를 다시 호출하지 않았다. 모델 접근 성공은 유료 speech 성공이나 과거 비용 0원의 증명이 아니다.
- OpenAI Dashboard의 `Default project / All API keys / Week to date (Oct 19–25) / Audio Speeches`는 `No usage data`였다. 최초 실패 키의 프로젝트와 연결되는 요청별 증거 및 집계 지연 여부는 확인하지 못했으므로 비용은 **미확인**이다.
- 공식 문서상 401은 인증 오류이지만, 이를 이 요청의 청구 증빙 대신 쓰지 않는다. 향후 제공자 응답의 요청 ID를 안전하게 기록한다. [오류 코드](https://developers.openai.com/api/docs/guides/error-codes), [요청 ID 안내](https://developers.openai.com/api/reference/overview).

## 현재 경로가 막혀 있는 이유

[`generateSampleTts`](../src/lib/hwaseong-sample-tts-server.ts)는 결정적 요청 ID를 가진 `newsletter_audio_files` pending 행을 먼저 생성한다. 같은 ID가 이미 있으면 기존 행을 조회하여 ready 또는 unknown을 반환하고 제공자를 다시 호출하지 않는다. 현재 Marin 행은 pending이므로 유효한 새 키가 준비되어도 기존 생성 버튼만으로 복구되지 않는다.

기존 manifest와 네 비교 음성 완료 판정도 원래 논리 요청 ID에 연결되어 있다. 별도 파일만 생성하거나 임의의 새 UUID로 등록하는 것으로 정상 복구가 완성되지 않는다. 기존 pending을 삭제·초기화·완료로 변경하거나, 생성 버튼의 중복 방지를 제거하지 않는다.

`pronunciation_note`는 관리자의 발음·검수 메모다. 복구 잠금·제공자 receipt를 여기에 숨기지 않는다. 다른 기능의 발행 이벤트나 직접 업로드 세션 테이블도 전용 계약을 그대로 재사용할 수 없다.

## 권장 복구 계약 — 실행 전 추가 승인 필요

**원행은 그대로 보존하고, 원행에 연결된 단 한 번의 새 복구 시도를 영속적으로 선점한 뒤 새 불변 음성 자산을 만든다.**

| 영향 대상 | 제안된 최대 영향 |
| --- | --- |
| 기존 pending 행 | UPDATE / DELETE 0 |
| 기존 음성 파일 및 기사·이미지·Composition | 변경·삭제 0 |
| 복구 시도 감사 기록 | 1건 영속 선점 및 상태 기록 — 저장 계약 승인 필요 |
| 신규 음성 DB 행 | 1건, 원요청과 별도 ID |
| 신규 Storage 객체 | 1건 MP3, 별도 경로, upsert 금지 |
| 신규 speech 호출 | 74자 Marin 청크 1회 한도; 자동 재호출 없음 |

현재 구조에는 필요한 영속 감사·선점 계약이 없다. 최소 전용 ledger 및 원자적 선점/확정 방식을 정하고, 필요한 SQL·권한·롤백·로컬 다중 연결 검증 범위를 먼저 승인받아야 한다. 기존 행을 변경하지 않는다고 해서 새 DB 기록이나 Storage 쓰기가 승인된 것으로 보지 않는다. 이번 PR에는 SQL 및 원격 실행 코드를 포함하지 않는다.

### 실행 adapter에 필요한 조건

1. Staging 도메인·DB ref·프로젝트·인증 작업자·실행 승인 범위를 확인한다. 오직 `STAGING_OPENAI_API_KEY`를 사용하고, 없거나 실패하면 중단한다. 일반 `OPENAI_API_KEY` fallback은 없다.
2. 원행 ID·검토 fingerprint·대본 SHA·결합 해시·음성·모델·파일 경로를 다시 대조한다. 객체가 이미 있거나 조회가 불명확하면 생성하지 않고 조정 절차로 전환한다. 기존 제공자 호출이 아직 진행 중이면 중단한다.
3. `(parent_id, attempt_ordinal=1)` 및 안정적인 request key를 UNIQUE로 제한하고, 작업자·승인·원행 fingerprint·대본 해시를 불변 링크로 기록한다. 영속 claim과 새 음성 행을 **제공자 호출 전에** 커밋한다. 프로세스 메모리 잠금은 대체가 아니다.
4. 같은 요청의 중복 제출은 같은 시도 상태/receipt만 반환한다. 새 랜덤 request key나 자동 attempt 증가로 잠금을 우회하지 않는다. 새 시도 허가는 별도 감사 대상이다.
5. Marin speech 1회만 호출한다. 상태·제공자 요청 ID·확인 가능한 usage와 모델·음성을 기록하되 비밀값/Authorization 헤더/raw 오류 본문은 노출하지 않는다. 과거 비용 미확인과 신규 최대 호출 범위를 승인 정보에 포함한다.
6. 새 MP3를 별도 불변 경로에 `upsert=false`로 저장하고 재다운로드한 바이트 해시·MIME·길이를 대조한다. 원래 예정 경로는 덮어쓰지 않는다.
7. 새 자산 ready 및 복구 감사 결과를 DB에서 함께 확정한다. 논리적 `probe-marin`의 manifest·비교 완료 검사·인증된 음성 제공 경로가 검증된 자식 자산을 일관되게 찾도록 최소 resolver를 추가한다. 원행은 pending으로 남고 연결된 복구 결과를 따로 표시한다.
8. API·검증·Storage·DB 어느 단계든 불명확하면 시도는 잠긴 상태로 보존한다. 자동 재호출·자동 삭제·가짜 완료는 없다. 실패 이력도 유지한다.

### 응답 유실과 장애

| 상황 | 다음 행동 |
| --- | --- |
| claim 커밋 후 응답 유실 | 같은 parent/attempt/request key로 상태 조회; 새 호출 금지 |
| 제공자 요청 전송 여부·응답 유실 | 비용·생성 결과 불명으로 잠금, 제공자 로그 대조; 동일 입력이라도 speech 멱등성을 가정하지 않음 |
| Storage 성공 / DB 확정 실패 | 보존 객체 재조회·해시 검증 후 같은 시도 확정만 재개; speech 재생성 금지 |
| DB 확정 성공 / 브라우저 응답 유실 | 같은 시도 receipt 조회, 완료 결과 재사용 |
| Storage 조회 실패 또는 hash 불일치 | 실패를 객체 부재로 해석하지 않고 중단·보고 |

Storage와 DB는 하나의 원자적 트랜잭션이 아니다. 고아 파일 자동 GC는 이번 복구에 포함하지 않는다.

## 격리 준비 코드와 테스트

- [`contract.ts`](../experiments/hwaseong-tts-recovery/contract.ts): 원행·해시·범위·파일 부재 관측 검증, 안정적인 1차 복구 attempt key 및 영향 계획 생성. 제공자/DB/Storage/환경변수 의존성 없음.
- [`hwaseong-tts-recovery-preparation.test.cjs`](../tests/hwaseong-tts-recovery-preparation.test.cjs): 19개. 원행 불변, 프로젝트·기사 경계, 대본/음성/모델/상태/경로 변경 차단, 재검토 fingerprint, Storage 불명 차단, 기존 호출 종료 미확인 차단, 인증 미확인 차단, 후속 401과 최초 비용의 분리, 안정적인 요청 키를 검증한다.
- 검증 결과가 준비 완료여도 항상 실행 불가다. 실제 영속 claim, 다중 연결 경합, 새 자산 resolver, 장애 후 실행 재개 및 청취 검증은 **미구현/미실시**다. 이 격리 테스트를 원격 복구 E2E 통과로 보고하지 않는다.
- 검증: 전체 회귀 704/704, skip 0(신규 19개 포함), TypeScript 통과, lint 오류 0·기존 경고 3개, diff 검사 통과. 실행 경로와 의존성 변경이 없어 로컬 Webpack 전체 빌드는 반복하지 않았다. Preview 상태는 PR의 실제 검사 결과로 별도 확인한다.

## 승인 이후 네 음성 생성·청취 순서

1. 영속 복구 계약과 실행 adapter를 별도 검토하고 격리 DB에서 동시 claim·응답 유실·Storage 성공/DB 실패·중복 요청을 검증한다. Production 적용은 범위 밖이다.
2. 원요청 및 객체·기존 요청의 읽기 전용 재확인부터 한다. Staging 모델 인증도 필요 시 비과금 조회로 재확인하되, 키는 출력하지 않는다. 영향표의 Staging 쓰기와 speech 1회 실행 승인 후에만 Marin 복구를 실행한다.
3. Marin 새 파일과 감사 receipt를 확인하고 1배속으로 직접 청취한다. 대본 누락·발음·속도·클리핑을 기록한다. 자동재생은 하지 않는다.
4. Cedar → Onyx → Coral 순으로 현재 ID/파일 상태를 먼저 조회한다. 이미 ready이면 재사용하고, pending/unknown이면 새 호출 없이 조사한다. 미생성 요청만 별도 승인된 예산 아래 각 74자 1회 생성한다. 동일 대본으로 비교하되 이 작업에서 실제로 생성하지 않는다.
5. 네 파일 각각 1배속 청취 및 모바일 사용자 재생을 확인한다. 기기별 재생속도 저장값과 원본 음질을 구분한다. 기존 파일은 삭제·덮어쓰지 않는다.
6. 최대 신규 4청크/296자(Marin 복구 포함)의 비교 시험과 7건 기사 전체 낭독은 별도다. 네 음성 검수 및 기사별 대본 검토 후에만 전체 낭독을 승인받는다. 02·04의 불일치 구음성은 재활성화하지 않고, 05 혼합 언어와 07 영상 해설 구분도 별도로 검수한다.

이 계획은 호출량 상한이지 금액 견적이나 과금 0원 보증이 아니다. 기존 첫 요청의 비용은 확인 불가 상태로 보존한다. 실제 실행 시 최신 계정 요금·예산을 확인하고 사용 가능한 제공자 usage/청구 증거를 기록한다.
