# Marin 복구 실행 계약 v1 — 구현·격리 검증, 원격 실행 전

## 기준 및 현재 상태

PR #272 head `427c8de7edf4d59a7b882b7ccc5919a26b846c8e`의 [복구 준비 계약](hwaseong-marin-recovery-preparation-v1.md)을 기반으로 한다. 구현 승인과 실제 원격 적용·유료 실행 승인은 구분한다. 이번 작업은 코드·SQL 파일과 로컬 테스트에 한정하며 고정 Staging을 재배포하지 않는다.

대상은 원요청 `e2041281-42e2-5363-a329-43db98714355` 한 건이다. 원행의 pending 상태·대본·해시·파일 경로·메모·시각은 변경하지 않는다. 과거 최초 speech의 정확한 제공자 응답·청구액은 미확인 상태를 유지한다. 후속 모델 인증 200을 생성 성공이나 과거 비용 0원의 증거로 사용하지 않는다.

## 정확한 DB 변경 범위

파일: [`schema_v1_42_hwaseong_marin_recovery.sql`](../supabase/schema_v1_42_hwaseong_marin_recovery.sql). **미적용**. Supabase 자동 migration 디렉터리에 넣지 않았으며 npm build/배포 스크립트에서 실행하지 않는다. 적용은 한 트랜잭션이며 재실행 시 기존 객체를 덮어쓰지 않고 중단하는 일회성 migration이다.

| 신규 객체 | 계약 |
| --- | --- |
| `public.hwaseong_marin_recoveries` | 부모 ID PK, 자식 음성 ID UNIQUE, 안정적 request key UNIQUE, attempt=1; 이번 부모/프로젝트/자식/경로만 허용하는 CHECK |
| `marin_recovery_claim(jsonb,jsonb,uuid,text) → jsonb` | 관리자 actor·원행 전체 snapshot·서버 claim token·실행 승인 참조를 검증. 원자적으로 새 pending 음성 행과 복구 기록을 예약. 최초 호출만 `won=true` |
| `marin_recovery_record(jsonb,uuid,jsonb,integer,text,text) → jsonb` | 최초 소유자만 제공자 결과 및 검증 바이트 hash/size/duration을 기록. 실패한 시도에 새 결과 덮어쓰기 불가 |
| `marin_recovery_complete(jsonb,text,integer,integer) → jsonb` | 기록된 proof와 일치하는 재조회 파일만 완료. 자식 음성 approved 및 복구 ready를 함께 확정. 이미 완료된 결과는 재검증 후 동일 receipt 반환 |
| `_marin_recovery_guard(jsonb)` | 고정 프로젝트/활성 상태·service_role·서버가 인증한 admin 검증, 프로젝트 → 부모 → advisory lock 순서 |
| `_marin_recovery_receipt(hwaseong_marin_recoveries)` | claim token·원행 snapshot·actor·승인 참조를 제외한 상태 반환 |

새 테이블은 RLS ON, PUBLIC/anon/authenticated 전체 권한 회수, service_role SELECT만 부여한다. 직접 INSERT/UPDATE/DELETE는 service_role에도 부여하지 않는다. 공개 RPC 3개는 service_role EXECUTE만 허용하고 `SECURITY DEFINER SET search_path=pg_catalog`로 작성한다. 실제 호출 role과 admin actor를 내부에서 다시 검사한다. helper 2개는 서비스 역할에서도 직접 실행할 수 없다. 기존 테이블의 ACL/RLS·trigger·기존 RPC는 변경하지 않는다.

실행 시 원행 전체 JSON snapshot을 DB 잠금 아래 다시 대조한다. 서버와 DB 모두 고정 대본·모델·음성·결합 해시·원래 파일 경로를 검증하고, 검토 당시 제목·null 메모/길이·생성/수정 시각도 검사한다. 이 값이 바뀌었으면 새 유료 호출 전에 재검토가 필요하다.

### 추가 FK의 한정된 영향

새 기록의 부모/자식 음성 및 프로젝트 FK는 `ON DELETE RESTRICT`다. 복구 기록이 실제로 생성된 이후 **이 두 음성 행과 해당 Staging 테스트 프로젝트의 hard delete가 제한**된다. 다른 음성·다른 프로젝트에는 새 FK 참조가 생기지 않는다. 이번 단계에서는 새 기록 자체를 원격 생성하지 않는다.

기존 삭제 API가 파일을 먼저 삭제하고 DB 삭제를 나중에 하는 경우 FK만으로 파일 보존을 보장할 수 없다. 실제 적용 전에는 해당 테스트 프로젝트와 부모·자식에 대해 기존 삭제/정리 UI를 사용하지 않는 운영 통제를 확인해야 한다. 기존 삭제 API를 이번 PR에서 수정하지 않으며, 이 제한을 전체 서비스 삭제 경로가 보호된 것으로 보고하지 않는다. 다른 OPEN PR의 미디어 보호 코드를 가져오지 않는다.

## 불변 자산과 연결

| 항목 | 고정값 |
| --- | --- |
| Staging 프로젝트 | `4cd5297e-a0fd-434c-84d4-fa4d3baf9389` / `hwaseong-2026-10-samples` |
| request key | `44c3166bb00cec1e4ce872794dd2268b0c63cd59d8c2b5ec80bbe63708abd41e` |
| 신규 음성 ID | `44c3166b-b00c-5c1e-ace8-72794dd2268b` |
| 버킷 | 기존 `audio-files`; 버킷 생성·정책 변경 없음 |
| 새 경로 | `projects/4cd5297e-a0fd-434c-84d4-fa4d3baf9389/sample-tts-recovery-v1/44c3166b-b00c-5c1e-ace8-72794dd2268b/000.mp3` |

원래 `/sample-tts-v1/e204…/000.mp3`는 업로드·덮어쓰기·삭제하지 않는다. 새 경로도 기존 객체가 있거나 존재 여부가 불명확하면 선점 전에 중단한다. 업로드는 `x-upsert=false`, 자동 재업로드/삭제/GC 없음이다. 객체 부재는 Supabase의 명시적 `Object not found` JSON만으로 판정하며 권한 거부·일반 404·시간 초과는 부재가 아니다.

복구 완료는 기존 음성 테이블의 **새 자식 행만** approved로 만든다. `article_id=null`이므로 기사 음성 연결·제목·본문·이미지·Composition·정식 발행 상태를 바꾸지 않는다. 복구 record FK가 부모와 자식을 연결하고 부모 snapshot을 보존한다.

기존 논리 `probe-marin`의 상태/manifest 및 네 음성 비교 완료 검사는 고정 ID·원래 대본/해시와 일치하는 ready 복구 자산을 해석한다. manifest URL의 `audio`는 부모 ID를 유지하고 실제 파일은 검증된 자식 경로에서 읽는다. 기존 일반 TTS나 다른 세 음성의 ID/자산은 변경하지 않는다. 새 gate가 OFF이면 복구 테이블 조회도 하지 않는다.

## 실행·권한 및 호출량

새 경로는 `/api/projects/hwaseong-2026-10-samples/sample-tts/recovery`다. UI 버튼은 추가하지 않는다.

- 기본 `HWASEONG_MARIN_RECOVERY_ENABLED` OFF: GET/POST 모두 외부 조회 전에 404.
- 추가 필수 조건: `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=staging`, 기존 Staging 환경 검증(APP_ENV·사이트/콜백 URL·Supabase ref), 요청의 고정 Staging origin, 기존 HMAC 인증 및 프로젝트 admin. Production과 일반 Preview는 차단한다.
- POST는 기존 same-origin 검증을 거친다. `parentId`, `requestKey`가 위 고정값과 일치해야 한다. `action=execute`는 `approvalReference`와 `acknowledgeUnknownPriorCost=true`, `confirmPriorInvocationFinished=true`가 필요하다. 확인 flag는 실제 로그 검토를 대신하지 않는다.
- 실행만 `STAGING_OPENAI_API_KEY`를 사용한다. 키가 없으면 DB 조회/예약 전 거절하며 기존 `OPENAI_API_KEY`로 대체하지 않는다. 모델 인증 경로는 #271의 scoped key 동작을 그대로 유지한다.
- GET은 상태 조회뿐이다. `action=reconcile` POST는 저장 파일 재검증/DB 확정만 수행하며 speech/업로드 함수를 호출하지 않는다. 자동 polling·중복 POST로 미완료 요청을 재생성하지 않는다.

복구 1회 최대 제공자 호출은 **74자·1청크·Marin·gpt-4o-mini-tts 1회**다. 공유 `requestOpenAiSpeech`에 opt-in receipt/timeout/최대 응답 크기를 추가했으며 복구 경로는 기존 자동 분할 재시도 함수를 사용하지 않는다. 복구 요청은 HTTP redirect도 따라가지 않는다. 일반 호출의 키·본문·기본 반환 동작은 유지한다.

예약과 감사 기록이 먼저 커밋되고 `won=true`를 받은 서버만 호출한다. `reserved` 상태는 호출 전 중단과 호출 후 응답 유실을 구분할 충분한 증거가 아니므로, 이 상태만 보고 새 호출을 허용하지 않는다. 이 계약은 최대 한 번의 애플리케이션 호출 보장이며 제공자의 과금/내부 처리 멱등성이나 반드시 한 번 성공하는 보장은 아니다.

응답의 `calls`는 해당 서버 실행의 speech 함수 호출 수다. 다른 동시 실행·과거 원요청까지 포함한 청구 횟수가 아니며, 중복 요청의 `calls=0`으로 전체 비용 0원을 주장하지 않는다.

## 파일 검증과 제공

제공자 응답은 90초·8 MiB 상한으로 읽고 MP3 전체 프레임/ID3 경계·잘림·길이를 검사한다. 모든 바이트의 SHA-256·크기·프레임 기반 초 단위 길이를 **Storage 전송 전** ledger에 기록한다. 업로드 후 전체 파일을 다시 읽어 `audio/mpeg`, 프레임, 동일 hash/size/duration을 검증한 뒤 DB 완료 RPC를 호출한다.

ready 자산의 manifest/재생 경로도 파일 전체를 다시 검증한다. 그 뒤 메모리에서 Range를 잘라 제공하므로 임의 Storage URL이나 미검증 부분 바이트를 노출하지 않는다. 응답은 `private, no-store`, 자동재생 없음이다. 원래 일반 TTS 제공 경로는 유지한다.

프레임 검사는 완전한 코덱 디코더/청취 검수를 대신하지 않는다. 구조가 맞는 비정상 음질까지 판정한다고 주장하지 않는다. 실제 Marin 발음·재생·음질은 유료 실행 및 모바일 청취 승인 후 검증할 항목이다. 기존 Storage 버킷의 접근/덮어쓰기 권한을 이번 구현에서 바꾸거나 파일 회수가 완전히 보장된다고 주장하지 않는다.

제공자의 HTTP 상태와 정제된 `x-request-id`를 가능한 경우 저장한다. 키·헤더·raw 오류 응답은 응답/로그에 출력하지 않는다. 바이너리 speech 응답에서 사용량/청구액을 확인하지 못하면 추정값을 만들지 않는다. [공식 Speech API](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create), [요청 ID 안내](https://developers.openai.com/api/reference/overview).

## 장애 상태와 수동 복구

| 관측 상태 | 보존되는 DB/Storage | 허용되는 다음 조치 |
| --- | --- | --- |
| 선점 전 명확한 검증 거절 | 새 기록/파일 없음 | 원인 확인·승인 범위 재검토 |
| claim 응답 유실 | reserved ledger+새 pending 행이 있을 수 있음, 파일 없음 | 같은 request key로 GET. 새 호출 금지; 실행 로그 확인 |
| 제공자 거절/응답 유실/잘못된 MP3 | unknown 또는 reserved, 새 pending 행; 기존 파일 불변 | 제공자 요청 ID/로그/청구 확인. 실패를 삭제·완료·재예약으로 바꾸지 않음 |
| proof 기록 성공 / 업로드 전 중단 | output_verified, 새 pending 행, 파일 없을 수 있음 | 파일 유무 조회. 원바이트 없으면 중단; hash만으로 ready 처리 불가 |
| Storage 성공 / DB complete 실패 | output_verified, 새 pending 행, 새 파일 보존 | 명시적 reconcile이 저장 파일을 다시 검증하고 동일 DB 확정만 재개 |
| complete 성공 / 응답 유실 | ready ledger+approved 자식+파일 | GET 및 같은 ID 재검증. 중복 execute는 완료 상태만 재사용, 유료 호출 0 |
| 저장 파일 hash/MIME/프레임 불일치 | 기존 기록과 파일 보존, 재생 차단 | 수동 조사. 덮어쓰기/새 speech/자동 GC 금지 |

claim/proof/complete 응답 유실을 DB 롤백이라고 단정하지 않는다. GET 조회 실패도 복구 실패로 단정하지 않는다. DB와 Storage는 원자적이지 않다. 확정 가능한 파일이 없는 reserved/unknown 시도에는 자동 takeover·lease 만료·attempt 증가가 없다. 추가 유료 시도나 수동 데이터 정정이 필요하면 별도 설계·승인을 받아야 한다.

## 격리 검증

- 실제 PostgreSQL은 매 실행 새 임시 디렉터리·Unix socket·TCP OFF로 생성한다. 앱 환경변수/원격 URL을 읽지 않고 기존 v1.3/v1.10 audio SQL 및 신규 migration 파일을 실행한다.
- 2개 연결의 잠금 대기를 관측하여 동시 claim/complete, 버려진 응답 후 재요청, rollback, 부모/프로젝트 writer 경합을 검증한다. 실제 네트워크 패킷 유실 실험 대신 커밋된 결과를 버리는 방식임을 구분한다.
- 모의 OpenAI/Storage로 제공자 실패·응답 유실·업로드 응답 유실·Storage 성공/DB 실패·MP3 손상·중복 클릭·원행 불변·권한/환경 차단을 검사한다. 실제 adapter의 예약→scoped provider→업로드→확정 및 기존 manifest/Range 경로도 모의 HTTP로 검사한다.
- `tests/fixtures/marin-recovery-tone.mp3`는 오프라인 FFmpeg로 생성한 0.15초 440Hz 테스트 신호다. 실제 음성이나 OpenAI 산출물이 아니며 Staging에 등록하지 않는다. 생성 명령: `ffmpeg -f lavfi -i sine=frequency=440:sample_rate=44100 -t 0.15 -c:a libmp3lame -b:a 64k -map_metadata -1 ...`. 별도 로컬 FFmpeg 디코딩도 확인했다. 앱 실행에는 FFmpeg 의존성을 추가하지 않는다.
- 최종 검증: 전체 747/747, skip 0(신규 43개 포함), TypeScript 및 Webpack Production build 통과, lint 오류 0·기존 경고 3개, 문서 링크·diff 검사 통과. 원격 migration/Storage 업로드/speech 호출은 0회다.

C1 PR #248과 공통 수정 파일은 `src/lib/article-tts-audio.ts`다. 이번 변경은 선택적 receipt/응답 제한 인수이고 C1의 Storage namespace·삭제/upsert 코드는 포함하지 않는다. 향후 C1 병합 시 이 함수의 옵션과 C1 Storage 보호를 각각 유지하며 공유 TTS 회귀를 다시 검증한다.

## Staging 적용·검증 계획 — 이번에는 실행하지 않음

1. 후속 PR 리뷰. #261~#272는 OPEN 유지, Production/main 병합 없음. Vercel 일반 Preview에서 새 API OFF→404 및 빌드 상태를 확인한다.
2. 별도 승인 후 백업/복구 수단·Staging DB ref·프로젝트·원행/객체 baseline과 실제 schema/grant를 다시 조회한다. 특히 추가 FK가 막는 삭제 경로와 Storage 선삭제 위험을 확인한다. Production 연결이 섞였으면 중단한다.
3. migration 전용 세션에 검증된 target guard를 설정한 후 파일을 한 트랜잭션으로 적용한다. guard 문자열만으로 실제 접속 대상이 증명되는 것은 아니다. 적용 후 역할별 ACL/RLS/함수 정의를 읽기 전용 확인한다. 원행/기사 데이터는 변경하지 않는다.
4. 승인된 코드만 고정 staging 브랜치로 반영·배포한다. 이 단계에서도 flag OFF 유지. 기존 기사·다른 음성·인증·저장·디자인 회귀를 읽기 전용 확인한다.
5. 별도 유료 실행 승인 후 Staging branch에만 feature flag를 켠다. 관리자 GET으로 기존 pending/새 ledger 없음/객체 부재, 모델 접근 및 최초 작업 종료·과거 비용 미확인을 확인한다. 일반 Preview와 Production에서는 여전히 차단돼야 한다.
6. 승인 참조·acknowledgement와 고정 request key로 execute를 **한 번** 요청한다. unknown이면 GET만 수행하고 위 표에 따른 수동 판단을 한다. 파일이 journal proof와 일치할 때만 reconcile을 명시적으로 요청한다.
7. 정상 manifest·1배속 청취·원행/기존 기사 불변을 확인한다. Cedar/Onyx/Coral 및 기사 7건 생성은 별도 승인 범위다.

롤백은 먼저 Staging 전용 flag OFF로 호출·복구 resolver를 차단한다. 자산/감사 기록은 삭제하지 않는다. 첫 claim 이전이고 새 테이블이 비어 있는 경우에만 별도 승인된 schema 되돌리기를 검토할 수 있다. claim 이후에는 ledger/자식/파일을 보존하고 단순 DROP이나 부모 pending 초기화로 복구하지 않는다.

원격 migration, 실제 Storage 경합·권한, 실제 OpenAI 응답·청구·모바일 청취는 아직 미검증이다. 원격 적용·flag ON·유료 생성 모두 별도 실행 승인 전에는 진행하지 않는다.
