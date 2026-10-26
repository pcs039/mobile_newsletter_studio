# 일반 기사 TTS 안전성 v1 — 적용 전 검토

## 범위와 기준

- 기준: Production main `9ed9bbce67696f34e3d60f9eb5109914aa57a1ec`.
- 브랜치: `codex/article-tts-safety-v1`, base main. 기존 Marin·샘플 stacked PR을 포함하지 않는다.
- `69ddf89096f3dbf5718b0625896f023a53038976`은 그대로 보존한다. 그 커밋의 공통 Speech 추적 코드/테스트만 선별 재사용하며 Marin 전용 resolver·경로·키·테이블을 가져오지 않는다.
- 원격 migration, 배포, 유료 음성 생성, 실제 파일 정리 모두 미실시. 기존 Staging Marin flag/기록도 변경하지 않는다.
- 이 브랜치의 자동 Vercel Git 배포는 [vercel.json](../vercel.json)에서 해당 브랜치 이름에 한해 비활성화한다. 배포 성공으로 보고하지 않는다.

## 작성자 흐름

기사 작성 화면에서 AI 음성을 선택하고 `저장 후 음성 생성`을 누른다. 저장 성공을 확인한 뒤 기존 저장본/파일을 조회한다. 동일한 본문·음성·모델의 정상 MP3가 있으면 유료 생성 없이 재사용한다. 완료 후 같은 화면에서 기존 오디오 플레이어로 미리듣는다. 본문을 수정한 뒤 `다시 생성`을 명시적으로 선택하면 새 시도가 시작된다.

낭독 대상은 기존 계약대로 공개 본문 문단이며 제목·요약·이미지·링크·영상 문구를 추가하지 않는다. 새 기사 생성 후에는 저장된 ID를 계속 사용해 같은 화면에서 다시 저장/생성해도 기사를 중복 생성하지 않는다. 글꼴·Composition 저장 충돌 확인과 기존 기사 저장 API는 유지한다.

기본 생성과 명시적 재생성을 구분한다. 생성 중에는 로컬 잠금, 서버에서는 영속 선점이 중복 호출을 차단한다. 응답을 잃으면 자동 POST하지 않고 `결과 확인` GET을 사용한다. 조회 실패를 생성 실패로 단정하지 않는다. 알 수 없는 결과를 확인한 후 새 시도를 명시적으로 승인할 수 있지만 이전 요청이 과금됐을 가능성은 남는다. 처리 중인 요청은 최소 6분과 GET 확인을 거친 뒤에만 명시적 새 시도로 교체할 수 있다.

파일 자체가 정상이지만 본문/음성 설정과 달라진 경우에도 기본 버튼으로 유료 생성을 시작하지 않는다. 기존 연결을 유지하고 `다시 생성`을 명시적으로 선택하도록 안내한다.

## 최소 DB 계약

[SQL 초안](../supabase/schema_v1_43_article_tts_safety.sql)은 신규 테이블 없이 다음 항목만 추가한다.

| 항목 | 용도 |
| --- | --- |
| `newsletter_articles.tts_request_id uuid` | 현재 시도 ID, null 허용 UNIQUE 인덱스 |
| `tts_request_fingerprint text` | 입력 voice/model과 원본 snapshot 비교 토큰 |
| `tts_generation_state text` | processing / ready / failed / unknown |
| `tts_started_at timestamptz` | 처리 중 상태와 명시적 재시도 경계 |
| `article_tts_claim(...)` | 기사·프로젝트 잠금, 권한/소유권 확인 후 한 요청만 선점 |
| `article_tts_complete(...)` | 원본/config 재검증, 신규 음성 INSERT와 기사 연결을 단일 트랜잭션으로 완료 |
| `article_tts_finish(...)` | 현재 시도만 failed/unknown 기록. 성공한 링크나 후속 시도는 변경 불가 |

세 RPC는 `SECURITY DEFINER`, `search_path=pg_catalog`, service_role만 실행한다. HMAC·프로젝트 접근·same-origin 검사는 기존 서버 모듈을 재사용한다. 사용자 ID/이름 정규화는 기존 프로젝트 접근 규칙과 일치시킨다. 프로젝트 SHARE → 기사 UPDATE → 블록 SHARE 순으로 잠근다. 생성 도중 저장된 제목·본문·요약·블록·음성 설정·기존 연결이 바뀌면 완료하지 않는다. 기존 기사 저장 writer/RPC는 수정하지 않는다.

fingerprint는 충돌/경합 비교용 두 MD5 조합이며 보안 해시가 아니다. 낭독 원문 식별과 파일 바이트 검증은 SHA-256을 사용한다. 한 기사에는 현재 시도만 기록하므로 이전 시도 전체의 감사 이력을 영구 저장하는 시스템이 아니다. 후속 시도 후 예전 요청 재전송은 predecessor CAS로 차단한다.

SQL은 명시적 대상 승인 GUC 없이는 실행되지 않으며 앱·빌드·배포에서 실행하는 경로가 없다. 이는 원격 DB 신원 검증을 대신하지 않는다. 기존 테이블 정의·권한·참조·writer·잠금 순서는 실제 대상 DB에서 적용 직전 다시 비교해야 한다.

## 파일 저장·검증·실패

- 버킷은 기존 `audio-files`, 경로는 `ai-tts-v2/{projectId}/{articleId}/{requestId}/000.mp3`부터 시작한다.
- 모든 생성 시도는 새 UUID, Storage POST는 `x-upsert:false`. 기존 파일을 먼저 수정/삭제하지 않는다.
- Speech 호출별 `X-Client-Request-Id`, 안전하게 제한한 제공자 `x-request-id`, HTTP 상태·단계별 시간만 기록한다. 대본·키·헤더·쿠키·MP3는 로그하지 않는다.
- 분할당 제공자 호출 1회, 자동 재호출/입력 길이 오류 자동 재분할 호출 없음. 기존 분할기를 사용하며 한 시도 최대 64구간, 총 원문 80,000자 이내다. 단건 기사도 길이에 따라 여러 유료 호출이 될 수 있다.
- 기존 90초 호출 제한은 늘리지 않는다. 작업 budget 240초, route maxDuration 300초, 조기 선점 교체 금지 6분. 배포 플랫폼의 실제 상한도 적용 전 확인한다.
- MP3 최대 8MiB/구간, MPEG Layer III 프레임·길이·구간 구조 및 SHA-256을 확인하고 Storage 재다운로드 바이트와 비교한다. 음향 품질이나 완전한 디코더 검증/실제 사람 청취를 대체하지 않는다.
- Storage 저장 응답을 잃으면 정확히 그 새 경로를 GET해 무결성을 확인한다. 재업로드/재생성하지 않는다.
- DB 완료 응답 유실 시 결과 불명으로 반환하고 GET으로 확인한다. 완료된 DB를 실패로 덮어쓰거나 파일을 삭제하지 않는다.
- DB 연결 실패·본문 변경 등으로 연결이 완료되지 않으면 기존 연결/음성은 유지한다. 연결되지 않은 새 파일은 남을 수 있다. 별도 고아 GC/자동 복구 시스템을 만들지 않는다.

## 교체 후 과거 일반 TTS 자동 정리

최신 승인에 따라 과거 파일 자동 삭제를 포함한다. 신규 MP3 전체의 저장/검증 및 신규 메타데이터 INSERT·기사 연결이 성공한 뒤에만 실행한다.

1. complete RPC가 과거 음성 메타데이터를 잠근다. 같은 기사/프로젝트의 일반 AI TTS 경로인지, 다른 기사 `audio_id`/`ai_audio_id` 또는 알려지지 않은 FK/독립 발행 revision·media ledger 도메인이 있는지 확인한다.
2. 불명확하면 과거 메타데이터와 파일 모두 유지한다. 사용하지 않는 과거 메타데이터만 DB-first로 제거한다. 이 하위 작업의 FK 오류 등은 새 연결 성공에 영향을 주지 않는다.
3. 확인된 완료 응답의 후보 경로만 서버가 받는다. 다른 음성 메타데이터, e-book manifest, 기사/블록, 링크의 raw/URL-encoded 경로 참조를 프로젝트 전체에서 조회한다. 읽기 거절·형식 오류·시간 초과·참조 발견은 모두 파일 보존으로 처리한다.
4. 삭제 직전 음성 메타데이터를 다시 조회하고 기존 공통 `deleteStorageObject`를 사용한다. 정리 전체 budget은 12초다. 이미지·디자인 파일 및 다른 프로젝트/기사 경로는 대상이 아니다.
5. 정리 실패는 정상 새 음성/기사 연결을 실패로 바꾸지 않는다. 완료 응답 유실 시에는 후보를 추측하거나 자동 정리하지 않는다.

DB와 Storage는 하나의 원자적 트랜잭션이 아니다. 파일이 남을 수 있고 자동 정리 재시도 큐는 없다. DB-first 정리 후 Storage 실패 시 기존 메타데이터는 제거됐지만 불필요한 파일이 남을 수 있다. 정상 새 음성에는 영향이 없다. 마지막 참조 조회와 외부 파일 삭제 사이에는 좁은 경합 구간이 남는다. 임의 SQL/외부 writer가 raw URL을 새로 참조하는 것까지 원자적으로 보호한다고 주장하지 않는다. 적용 전 알려지지 않은 snapshot/참조 경로가 발견되면 그 경로는 보존 대상으로 남기고 정리를 적용하지 않는다. 일반 수동 파일 삭제 API 전체를 재설계한 변경도 아니다.

## 검증

- 제공자·Storage transport 모의 테스트: 생성/재사용/재생성, 중복, timeout/본문 중단/응답 유실, 파일 손상·누락·조회 불가, 저장·DB 실패, 성공 후 정리 실패, 민감값 비노출.
- 실제 로컬 PostgreSQL 다중 연결: 선점/소유권/동일 키·서로 다른 키, 다른 기사 같은 키, writer와 완료 경합, 설정 변경, DB rollback/응답 유실, shared audio/unknown publication 도메인 보존.
- 실제 TSX handler 모의 테스트: 저장 후 생성, 중복 클릭, 명시적 새 시도, 응답 유실 후 GET만 실행, 저장/조회 실패, unmount 시 생성 차단.
- Chrome 로컬 mock fixture에서 390/520px 생성·같은 화면 플레이어·합성 테스트 톤 재생 및 결과 불명 → GET 확인을 검증한다. 실제 기사 화면/실제 MP3/OpenAI 음질/Staging E2E 검증으로 간주하지 않는다.
- 전체 테스트(로컬 PostgreSQL/PGlite 활성화), TypeScript, lint, Webpack build, diff check를 완료 보고/PR에 기록한다. 기존 린트 경고 3개는 범위 밖이다.

2026-10-26 최종 실행: 전체 **690/690, skip 0**, TypeScript 통과, lint 오류 0/기존 경고 3, `npm run build -- --webpack` 통과, `git diff --check` 통과. 이 수치는 원격 업로드/유료 생성/실제 MP3 청취 검증을 포함하지 않는다.

재현: `node --test tests/*.test.cjs`. SQL 테스트에는 로컬 `pg`, `@electric-sql/pglite` 런타임과 PostgreSQL 17 bin 경로를 테스트 파일의 opt-in 환경변수로 제공한다. 런타임이 없으면 SQL 사례는 skip하므로 skip 0 실행과 혼동하지 않는다. 테스트는 임시 로컬 Unix socket DB를 생성·종료하며 앱 비밀키나 원격 DB URL을 사용하지 않는다.

## Staging 실제 기사 1건 검증 전 최소 절차

1. 코드 검토 후 별도 승인: 정확한 Staging DB ref/독립성, schema·FK·권한·writer와 초안 비교, 복원 수단 확인. migration과 배포 승인을 받기 전 실행하지 않는다.
2. 승인된 Staging에만 SQL을 한 번 적용하고 신규 RPC의 service_role 전용 권한, 기존 기사·음성 baseline 불변을 확인한다. 서버 코드는 SQL 준비 전 503으로 fail closed한다.
3. 일반 TTS는 기존 `OPENAI_API_KEY` 설정만 사용한다. Staging 전용 Marin 키를 자동 대체하지 않는다. 일반 TTS용 Staging 키/모델 권한과 비용 한도는 별도 확인·승인이 필요하다. 이 PR에서 환경변수는 변경하지 않는다.
4. 사용할 화성시 기사 ID와 유료 호출 budget(분할 수 포함), 재생성 후 정리될 과거 파일 후보를 사용자와 확정하고 별도 실행 승인을 받는다.
5. 실제 1건의 저장→생성→같은 화면 청취→수정→명시적 재생성·과거 파일 정리 결과를 확인한다. 불명확한 응답은 GET만 확인하며 POST 자동 반복은 하지 않는다.
6. 기존 발행 reader/글꼴/Composition/기존 오디오 및 모바일 390/520/실기기 회귀를 확인한 뒤 Production 적용 여부를 별도 판단한다.

## 기존 PR과의 관계

`#261~#274`, `#246~#249`, `#255`, 기타 OPEN PR 및 두 stash를 보존한다. `src/lib/article-tts-audio.ts`는 기존 Phase C/키 분리/진단 PR과, `src/lib/newsletter-file-storage.ts`는 C1과 충돌할 수 있다. 공통 삭제 함수의 export/선택적 AbortSignal만 재사용하며 C1 namespace 차단 코드나 Marin 코드/SQL은 혼입하지 않는다. 향후 통합 시 안전 생성 route와 기존 Staging 전용 경로를 각각 재검증해야 한다.
