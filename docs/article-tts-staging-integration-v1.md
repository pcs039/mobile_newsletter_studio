# 일반 기사 TTS — Staging 통합 준비

2026-10-26 KST. 원격 쓰기·migration·배포·Speech 생성·Storage 삭제 미실시.

## 통합 기준과 보존

- 고정 Staging / `origin/staging`: `a751532adcbea0809d5142329398ba5e25eba7d3`.
- 일반 TTS PR #275: `d426e89b717fc8b2c07cc636c00b84fd2d87032e`, base main, OPEN 유지.
- 별도 로컬 통합 브랜치: `codex/article-tts-staging-integration-v1`.
- `a751532`에서 분기해 `d426e89b`를 로컬 merge한다. main 기반 #275로 Staging 전체를 덮어쓰지 않는다. 기존 Staging의 7건 표지/목차/검색/관심분야/페이지 이동/06 A·B/07 영상/음성 삭제 경로를 유지한다.
- 이 단계에서는 통합 브랜치를 push하지 않으며 고정 staging ref와 기존 PR head는 변경하지 않는다. [vercel.json](../vercel.json)은 통합 브랜치 자동 배포도 OFF로 지정한다. 향후 명시적 Staging 적용 승인은 별도 필요하다.

## 차이와 충돌 해결

| 경로 | 통합 판단 |
| --- | --- |
| `src/lib/article-tts-audio.ts` | 실제 content conflict. #275의 안전 생성 분리·추적 지원 Speech 함수를 채택한다. 기존 Staging explicit credentials 호출과 general key fallback 금지 계약은 유지된다. 과거 PATCH/upsert 기반 일반 생성 함수는 복원하지 않는다. |
| `tests/article-tts-cleanup.test.cjs` | add/add conflict. 제거된 옛 생성 함수를 호출하는 Staging 테스트를 #275의 새 정리 테스트로 대체한다. 저장/DB 실패 및 공유 파일 보존은 새 job/server/cleanup 테스트가 검증한다. |
| `src/lib/newsletter-file-storage.ts` | 자동 병합. Staging의 DB-first `deleteAudioFileRecord` 경로는 유지하고, #275의 공통 Storage 삭제 함수 export/선택적 AbortSignal만 추가한다. |
| `src/app/api/projects/[projectId]/articles/[articleId]/tts/generate/route.ts` | 기존 일반 경로만 #275의 GET 상태/POST 안전 생성 계약으로 교체. HMAC·프로젝트 권한·same-origin 유지. |
| `sample-tts/route.ts`, `sample-tts/recovery/route.ts` | Staging 버전을 그대로 보존. Marin flag ON 또는 새 복구 경로를 추가하지 않는다. |
| `supabase/schema_v1_42_hwaseong_marin_recovery.sql` | 기존 정의 그대로 보존. 재적용하지 않는다. |
| `supabase/schema_v1_43_article_tts_safety.sql` | #275 초안 그대로. 기사 4필드·고유 인덱스·RPC 3개, 신규 테이블 없음. 아직 원격 미적용. |
| 환경 설정 | 원격 값 수정 없음. 일반 `OPENAI_API_KEY`와 별도 `STAGING_OPENAI_API_KEY`를 섞지 않는다. |

#275의 일반 TTS 파일 목록/실패 정책/정리 한계는 [안전성 계약](article-tts-safety-v1.md)을 따른다. C1 PR #248 코드는 혼입하지 않는다. `69ddf890`도 그대로 보존한다.

## 원격 읽기 전용 확인

Supabase 공식 Management API `/database/query/read-only`를 사용했다. 인증 토큰은 기존 키체인에서 프로세스 메모리로만 읽었고 저장·출력하지 않았다. 접속 프로젝트의 Management API 신원과 DB 스키마를 각각 확인했으며 SQL guard 문자열을 신원 증거로 사용하지 않았다.

- Staging `mvrkpmffuhcqwisqvpqi`, Production `qmhvlbpedudpwtznletj`, 서로 다른 ACTIVE_HEALTHY 프로젝트.
- 실제 Staging 관련 5테이블 140컬럼·72제약과 기존 저장/삭제·Marin RPC의 signature/권한을 조사했다.
- 신규 `tts_*` 4컬럼과 `article_tts_claim/complete/finish`는 아직 없다. 이름 충돌은 발견되지 않았다.
- 기존 기사/음성/프로젝트/블록은 RLS ON, service_role BYPASSRLS 및 필요한 SELECT/INSERT/UPDATE/DELETE 권한이 있다. 네 테이블의 현재 RLS policy는 0개다. anon/authenticated의 기존 테이블 ACL 자체는 남아 있어 RLS와 RPC EXECUTE 제한을 함께 검증했다. 이번 작업에서 ACL/RLS를 수정하지 않는다.
- 기사 `audio_id`/`ai_audio_id` → 음성 FK는 `ON DELETE SET NULL`; 음성 project FK는 CASCADE, article FK는 SET NULL. 새 연결 후 미참조 메타데이터만 정리하는 계약과 호환된다.
- Marin 기록은 현재 FK 수명 pin이 아닌 별도 감사 식별자다. 일반 TTS 전용 경로만 정리하며 Marin 경로와 기록은 건드리지 않는다.
- 실제 `set_updated_at` 및 Composition project 변경 guard trigger가 있다. TTS 요청 상태가 updated_at을 바꾸어도 원문 비교 토큰은 그 시각을 포함하지 않는다. 기존 save/delete RPC는 project → article 잠금 순서다.
- 현재 조사한 독립 publication revision/media ledger 테이블은 없다. 향후 A1/A2 병합 시 정리 경로를 다시 검토해야 한다. 일반 정기호는 현재 기사 연결을 읽는 계약을 유지한다.
- `audio-files`는 private, 버킷 한도 50MiB, audio/mpeg 허용. 새 서버는 더 작은 8MiB/구간 한도를 적용한다. 설정은 바꾸지 않는다.
- Staging 시연 baseline: 기사 7행, 음성 **7행**(기존 6행 + 이전 복구 예약 pending 1행), Storage metadata 42객체, 복구 기록 1행. 파일 본문 전체를 다시 다운로드/해시한 검증으로 해석하지 않는다.

[스키마 fixture](../tests/fixtures/article-tts-staging-schema-v1.json)는 공개 구조만 포함하고 기사/연락처/음성 원문/비밀값은 없다. [호환성 테스트](../tests/article-tts-staging-schema.test.cjs)는 실제 관측한 네 테이블의 컬럼·기본값·enum·CHECK·FK·RLS를 로컬 PostgreSQL에서 재현해 초안 적용, 기존 필드 불변, 새 음성 연결/정리, 비서버 역할 차단을 검사한다. TTS 밖 FK 대상은 ID stub이므로 전체 앱 DB 복원이나 원격 migration 성공 증거는 아니다. 기존 실제 다중 연결 tests도 별도로 실행한다.

## 배포와 키 점검

현재 고정 Staging은 `dpl_Fm9Vp44yQBL4ju8ppEoVHsZFL995`, SHA `a751532`, Preview/staging, Ready/Latest이고 고정 도메인이 연결돼 있다. 이번 통합 코드의 Preview를 새로 배포하지 않았다.

같은 관리자 Chrome 세션에서:

1. `/api/staging-status`: 정상 JSON, configured/enabled=true, ref=Staging, 일반 `OPENAI_API_KEY` configured=true.
2. `/sample-tts?provider=check`: gpt-4o-mini-tts 모델 GET HTTP 200. **이 경로는 STAGING_OPENAI_API_KEY를 사용한다. 일반 TTS 키 인증 성공 증거가 아니다.**
3. `/sample-tts/recovery`: HTTP 404. 해당 현재 배포에 handler가 존재하고 flag가 false인 상태를 유지한다. 인증 리다이렉트를 OFF 성공으로 간주하지 않았다.

Vercel 설정 목록에서 일반 `OPENAI_API_KEY`의 Preview + staging 전용 override, Production/일반 Preview 기본값, 별도 `STAGING_OPENAI_API_KEY`를 확인했다. 값을 reveal/copy하지 않았다. `OPENAI_TTS_MODEL` 별도 항목은 없어 현재 기본값 gpt-4o-mini-tts를 유지한다.

**남은 키 게이트:** staging override의 일반 OPENAI_API_KEY로 실행한 모델 GET은 현재 배포에 해당 진단 경로가 없어 미검증이다. 로컬 설정은 Production DB용이므로 로컬 키의 결과를 Staging 키 검증으로 대체하지 않았다. 검증된 Staging 전용 키가 유효하다는 이유로 일반 키를 교체하거나 자동 fallback하지 않는다. 향후 승인된 보안 CLI/메모리 환경에서 정확한 staging override만 사용해 `/v1/models/gpt-4o-mini-tts` GET을 확인해야 한다. 모델 조회 200도 실제 Speech 생성/요금/음질을 보증하지 않는다.

공식 근거: [OpenAI 모델 조회](https://developers.openai.com/api/reference/resources/models/methods/retrieve), [Supabase 읽기 전용 SQL](https://supabase.com/docs/reference/api/v1-read-only-query).

## 실제 제작 기사와 최초 검증 계획

현재 DB에서 확인한 실제 제작 프로젝트:

- Production `hwaseong-2026-10`, ID `d27c79a3-9417-4dfa-a6c7-a44c8a72eec2`, 제목 ‘화성시 소식지 10월호’, draft.
- 기사 6건 중 본문 5건과 본문 없는 표지성 1건. Staging에는 이 실제 제작 프로젝트가 없고 7건 samples 프로젝트만 있다.
- 이전 출발 URL의 `muan-26-09`는 현재 DB상 실제 무안 기사다. 그 이름만으로 판단하지 않고 실제 제목/프로젝트를 대조해 위 제작 프로젝트를 선정했다.

최초 추천 기사: **화성시, 폐건전지·종이팩 교환으로 자원순환 실천**.

- 원본 기사 ID `5f00b067-0a65-4678-b733-09e735916803`, draft, 현재 audio_source=none, ai_audio_id=null.
- 공개 문단 2개, 정규화 낭독 원문 309자. 현재 분할기의 실제 Speech 입력 310자, **1청크 → 최초 최대 1회 호출**, Marin / gpt-4o-mini-tts.
- 원문 hash `d42cccbb365905ad8ec9ca90bcf6e13c9d80b988873c19c713713fe21784d580`으로 실행 직전 재확인한다. 작성자가 수정했다면 다시 산출한다. 원문을 임의 축약해 1청크로 만들지 않는다.
- 기존 samples 01번은 440자로 재구성된 별도 시연 기사여서 실제 원문 309자 검증과 혼동하지 않는다.
- 승인 후 별도 private Staging QA 프로젝트에 이 기사 텍스트/문단만 복제한다. Production 원본·기존 7건·정렬·이미지·Composition은 바꾸지 않는다. 이번 단계에서는 복제도 하지 않았다.

## 정확한 후속 적용 순서 — 아직 실행하지 않음

1. 본 통합 커밋 및 #275 검토. origin/staging과 DB baseline이 바뀌지 않았는지 다시 확인한다. 바뀌면 다시 통합/검증하며 강제 push하지 않는다.
2. 정확한 일반 Staging 키의 무료 모델 GET 및 실제 호출 budget, DB 복원 수단을 확인한다. 키를 채팅/로그/저장소에 옮기지 않는다.
3. **별도 승인 후** 대상 ref를 다시 검증하고 v1.43 초안만 단일 트랜잭션으로 적용한다. v1.42를 다시 적용하거나 Marin flag를 켜지 않는다. 신규 함수 ACL/RLS와 기존 baseline을 확인한다.
4. **배포 승인 후** origin/staging을 통합 커밋으로 fast-forward하여 Preview/staging만 배포한다. main/Production은 바꾸지 않는다. 정확한 새 SHA/Ready/고정 도메인 및 환경 분리를 재확인한다.
5. 새 일반 상태 GET 인증·프로젝트 차단·schema 준비를 확인하고 Marin recovery GET 404를 확인한다. 이 시점에는 Speech POST하지 않는다.
6. **데이터 복제·유료 1회 실행 승인 후** 위 원문의 Staging 사본을 저장하고 ai_tts/Marin을 명시적으로 선택한다. 새 UUID 하나를 확정하고 `force=false`로 POST **한 번만** 실행한다.
7. HTTP/provider request ID·시간·MP3 바이트/SHA-256·DB 연결·동일 키 상태 GET을 확인한다. 응답이 불명확하면 POST를 반복하지 않는다. 390/520 및 1배속 청취·미리듣기·공개 조건을 확인한다. 초기 음성이 없는 사본이므로 최초 호출에서 과거 파일 정리는 없다.
8. 본문 수정→재생성→과거 미참조 파일 정리는 추가 유료 호출 1회가 필요한 별도 검증이다. 최초 1회 승인에 포함된 것으로 간주하지 않는다. Production 정식 적용·발행은 별도 판단한다.

## 결과와 남은 조건

- 최종 전체 회귀 **843/843, skip 0**. 실제 PostgreSQL 다중 연결·Staging 구조 재현·PGlite 및 7건 시연 테스트 포함. TypeScript·Webpack build·diff check 통과, lint 오류 0/기존 경고 3.
- 검수 전후 Staging 기사 7행·음성 7행·Storage metadata 42객체·복구 기록 1행과 Production 실제 10월호 기사 6행의 행/집계 해시가 일치했다. 원문·정렬·이미지·연결 상태 변경 없음. Storage 바이트 전체 재검증을 뜻하지 않는다.
- 기존 Storage 원본 파일을 다운로드하거나 삭제하지 않았다. DB/Storage 정리는 비원자적이며 외부 raw URL writer 경합 및 고아 파일 잔류 한계는 #275와 같다.
- 일반 키의 정확한 모델 인증, 실제 제작 기사 Staging 사본, 승인된 migration/배포, 최초 1회 Speech 및 실기기 청취는 아직 필요하다. 이를 완료나 발행 준비 완료로 표시하지 않는다.
