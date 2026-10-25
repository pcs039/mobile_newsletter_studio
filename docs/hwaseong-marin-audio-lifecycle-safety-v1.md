# Marin 음성 수명주기 보완·Staging 적용 계획 v1

## 판정과 범위

**B — 조건부 적용 가능 유지.** #273 head `f449363beb3a033094aa3f7aa74fa21aaba65c27` 기반 후속 보완안이다. 기존 음성 파일의 정상 삭제·교체를 허용한다. 특정 음성 UUID나 경로를 영구 보호하는 차단 목록/trigger/권한은 추가하지 않는다. 복구 이력과 동일 유료 요청의 중복 실행 방지는 파일의 영구 보존과 별개다.

이번 작업은 로컬 코드·미적용 SQL 초안·격리 테스트·검증 계획뿐이다. 원격 migration, 배포, flag 변경, 유료 호출, DB/Storage 쓰기는 실행하지 않는다. PR push가 Vercel Preview를 자동 생성할 수 있으므로 배포 승인 전에는 후속 브랜치를 원격 발행하지 않는다. #273과 기존 OPEN PR은 그대로 둔다.

## 현재 DB와 파일을 별도로 판단

2026-10-25 읽기 전용 재대조 결과:

| 구분 | 확인 결과 |
| --- | --- |
| 대상 | Staging `mvrkpmffuhcqwisqvpqi`, 프로젝트 `4cd5297e-a0fd-434c-84d4-fa4d3baf9389` |
| 기존 요청 | `e2041281-42e2-5363-a329-43db98714355`, pending, generated_at null, Marin / gpt-4o-mini-tts |
| 원행 전체 JSON 대조 | 기존 baseline과 동일, SHA-256 `b69dced2953149ad357726ca0566ea797ff1da5138ad3db1fc918e142ce76bd2` |
| 기존 Storage 객체 | 서비스 권한 GET에 명시적 `Object not found`(HTTP 400, not-found 응답) 확인 |
| 새 복구 행·경로 | 직전 실사에서 미사용 확인. 실행 승인 직전 다시 조회해야 함 |

pending은 **DB 예약이 남아 있다는 뜻**이다. 파일이 존재한다거나, 유료 호출이 없었다는 뜻이 아니다. 과거 401 이후 정확한 과금 여부는 미확인이다. 파일 부재를 근거로 기존 pending을 성공 처리하거나 생성 재시도를 자동 실행하지 않는다.

복구 GET은 적용 후 `receipt`, `records.original/replacement`(존재·상태·생성 시각), `objects.original/replacement`(`present/missing/unknown`)를 분리한다. 권한 거부·타임아웃·잘못된 MIME은 `unknown`이며 `missing`으로 취급하지 않는다. 객체 조회는 제한된 크기의 GET이고 쓰기·제공자 호출은 없다. `present`만으로 MP3 검증/완료를 뜻하지 않는다. 실제 재생 전에 전체 hash/MIME/프레임을 다시 검사한다.

## 최소 삭제 보완

대상은 기존 `/api/project-files`의 **audio_mp3 삭제**와 일반 TTS의 파일 정리뿐이다. 다른 종류 파일의 삭제 계약, 기사 저장, 인증, 음성 모델/키 선택은 변경하지 않는다.

1. 프로젝트·음성 ID·파일 경로가 같은 현재 행을 조회한다.
2. `newsletter_audio_files.article_id`와 `newsletter_articles.audio_id/ai_audio_id`의 사용 여부를 확인한다. 사용 중이면 409로 거절하고, 정상 교체/연결 해제 후 삭제하도록 안내한다.
3. 현재 `updated_at`과 `article_id IS NULL`을 조건으로 **DB DELETE부터** 수행한다. `Prefer: return=representation` 응답의 삭제 행 ID/프로젝트/경로가 확인돼야 다음 단계로 간다. FK 23503 거절 시 파일 삭제는 0회다.
4. DB 삭제 응답 유실/비정상 응답/0행/행 변경은 `unknown`으로 남긴다. Storage DELETE를 실행하지 않는다. 조회로 행이 없음을 확인해도 어느 요청이 삭제했는지 증명된 것은 아니므로 경로만으로 후속 삭제하지 않는다.
5. 확인된 삭제 행의 기본 파일 및 segment 경로별로, **모든 프로젝트**의 `file_path`와 `ai_tts_audio_paths` 참조를 확인한다. 공유 파일은 남긴다. 조회 실패도 파일 정리 허가가 아니다.
6. 참조가 확인되지 않은 파일만 정리한다. 이미 없는 객체는 정상 삭제 상태다. 실패/응답 유실은 `cleanup_required`로 알리고 자동 DELETE 재시도·DB 행 자동 복원은 하지 않는다. 여러 segment 중 일부만 삭제됐을 수도 있다.

UI는 동시 클릭을 동기적으로 막고 unknown/cleanup_required 상태에서 해당 버튼을 잠근다. 목록의 다른 기사 작업을 잠그지 않는다. 명확한 거절 후에는 참조 해제 등 원인을 해결하고 다시 요청할 수 있다. 브라우저 새로고침은 운영 확인을 대신하지 않는다. 요청 이력·복구 API·새 GC 테이블은 추가하지 않는다.

일반 TTS의 정상 교체 후 old segment 정리 및 실패 후 new segment 정리도 같은 참조 검사를 쓴다. 특히 DB upsert가 커밋됐는데 응답이 유실되었거나 기사 연결 업데이트가 실패한 경우, DB 행이 여전히 가리키는 새 파일은 삭제하지 않는다. 정상 교체된 이전 파일은 참조가 없으면 정리할 수 있다. 생성 API와 일반 `OPENAI_API_KEY` 선택 계약은 유지한다.

### 실패 이후 수동 정리/재시도

| 결과 | 후속 조치 |
| --- | --- |
| rejected / 명시적 FK 거절 | 파일 유지. 참조와 행을 확인·정상 해제 후 새 삭제 요청 가능 |
| unknown / DB 응답 유실 | 동일 행과 경로를 읽기 전용 재조회. 실행이 끝났는지 확인하기 전 재시도 금지. 행이 남아 있으면 변경 baseline을 새로 확인한 후 운영자 판단 |
| cleanup_required | DB 삭제는 확인됐음. 목록에서 사라진 것을 실패·롤백으로 안내하지 않음. 반환/승인된 원래 경로와 서버 요청 로그를 대조하고 객체 존재·참조·진행 중 업로드를 조회 |
| 잔여 객체가 참조됨/존재 불명/업로드 중 | 보존하고 중단. 파일명만으로 제거하지 않음 |
| 잔여 객체의 무참조·작업 종료·정리 범위 확인 | 별도 승인된 수동 정리로 처리. 이미 없으면 종료. 임의 pending 재삽입/paid 재생성 없음 |

**잔여 경합:** 기사 참조 GET → 조건부 DB DELETE와 파일 참조 GET → Storage DELETE는 단일 트랜잭션이 아니다. 기존 article FK는 `ON DELETE SET NULL`이므로 FK 자체가 새 기사 연결의 유실을 막아 주지 않는다. 행 `updated_at` 조건도 다른 테이블의 새 참조까지 잠그지 않는다. 새 경로 참조·동일 경로 upsert가 최종 GET 이후 발생하는 경합은 남는다. 이번 작업은 이 원자성을 완성했다고 주장하지 않는다. Staging 실행 창에는 해당 음성의 연결/교체/삭제/정리 작업을 겹치지 않게 하고, 일반 운영 동시성까지 보장하려면 향후 관련 writer가 공유하는 원자적 삭제 RPC/경로 수명주기 계약을 별도로 승인·검증해야 한다.

프로젝트 DELETE API는 `archiveNewsletterProject()`를 호출하는 soft delete라서 파일 선삭제 경로가 아니다. 복구 중 archive/delete가 발생하면 RPC의 프로젝트/부모 검증 또는 자식 행 검증에서 완료를 거절한다. 파일·DB 간 원자성을 보장하는 것은 아니다.

## 복구 이력의 수명

미적용 `schema_v1_42_hwaseong_marin_recovery.sql`에서 3개의 `ON DELETE RESTRICT` FK만 제거한다. 새 테이블/컬럼/RPC를 추가하지 않는다. 기존 PK/UNIQUE, scope CHECK, RLS/ACL, actor·소유권 검증, 프로젝트/부모/자식 잠금 및 at-most-one claim은 유지한다. UUID와 snapshot은 감사 식별자이며 live FK가 아니다.

음성·프로젝트 정상 삭제가 이력 때문에 영구 차단되거나 이력이 cascade 삭제되지 않는다. 자식 삭제 후 완료는 거절되며, 과거 `ready` 이력을 현재 파일 존재의 증거로 쓰지 않는다. 완료된 자식은 보존된 요청 hash·대본 hash·proof 및 현재 자식 소속을 검증해 재생하므로 오래된 부모 pending 행의 정상 삭제에 종속되지 않는다. 자식이 삭제/변경됐으면 resolver가 연결하지 않는다. 이력이 있는데 파일/행이 없어져도 같은 request key의 자동 유료 재생성은 허용하지 않는다.

이 초안이 이미 적용됐다고 가정하지 않는다. 다른 사람이 이전 FK 버전을 적용했다면 DROP/ALTER를 자동 실행하지 않고 현재 정의를 확인해 별도 변경 승인을 받는다.

## 백업/export와 복원 조건

직전 dashboard 실사에서는 Staging 일일 DB 백업 7일, 최근 표시 시각 `2026-10-24 21:54:48 UTC`(10월 25일 06:54:48 KST), PITR 미활성, Restore 진입점 존재를 확인했다. 이 백업은 pending 행 생성(10월 25일 15:18:52 KST)보다 이르다. 화면에 Restore가 있다는 사실은 현재 상태 복원 리허설 성공을 뜻하지 않는다. **DB 백업은 Storage 파일 바이트를 포함하지 않는다.** 이번에 전체 DB dump/실제 restore는 수행하지 않았다.

이번에는 재대조로 동일성이 확인된 부모 1행만 JSON으로 별도 export했다. 디렉터리 0700/파일 0600, Git 밖 `/private/tmp/marin-lifecycle-backup-0U0vU0/`의 `audio-row.json` 및 SHA-256 manifest다. 키/쿠키는 포함하지 않는다. 이것은 임시·부분 백업이며 DB 전체/7개 기사/Storage의 복구 수단이 아니다. 임시 폴더가 정리될 수 있으므로 실행 승인 전에 승인된 암호화 보관소로 이관해야 한다. JSON 복원 절차는 격리 PostgreSQL의 fixture로 export→삭제→`jsonb_populate_record` 삽입→전 필드 대조를 검증했다. 이번 실제 export 파일을 Supabase 동일 전체 스키마에 복원한 리허설은 미실시이며 원격 DB 복원도 실행하지 않았다.

원격 migration 승인 전 필요한 절차:

1. 실제 연결의 host/project ref 및 DB 식별을 조회해 Staging임을 확인한다. target guard 문자열만으로 대체하지 않는다. 진행 중인 해당 샘플 writer를 종료/조율한다.
2. 승인된 서버 연결을 OS 키체인/권한 0600의 libpq service 설정으로 준비한다. URI·비밀번호를 명령줄/로그/Git에 넣지 않는다.
3. PostgreSQL 17 `pg_dump`의 일관된 snapshot으로 application schema+data와 권한/함수 정의를 확보한다. 예시는 **절차이며 실행하지 않음**: `umask 077`, `pg_dump --dbname=service=mns_staging --format=custom --file=<private-archive>`. Storage/auth 등 관리 스키마의 지원 범위와 필요한 roles/grants는 Supabase 복원 절차에 맞춰 별도로 확인한다. dump 실패/누락/비정상 종료이면 중단한다.
4. archive hash/시각/PG 버전/대상 ref/범위를 비밀값 없이 기록하고 암호화 보관한다. `pg_restore --list`만으로 검증 완료라 하지 않는다.
5. 네트워크 외부 연결이 없는 **격리 DB**에서 필요한 역할을 준비하고 복원한다. 기존 함수·RLS·ACL·FK·행 수·pending 행·기사 7건 baseline을 대조한다. Staging/Production을 restore 대상으로 사용하지 않는다. managed schema의 복원이 불가능하면 실제 지원되는 복원 경로를 확인할 때까지 보류한다.
6. 백업 이후 추가 데이터 손실 범위/RTO/RPO를 합의한다. Storage 파일을 바꿀 실행이면 해당 파일을 별도 백업하고 hash/크기/경로를 기록한다. DB만 되돌려 없는 파일을 복구됐다고 보고하지 않는다.
7. migration 실패는 트랜잭션 rollback 확인 후 중단한다. 적용 후 장애는 우선 flag OFF로 차단하고 baseline과 diff를 확인한다. 데이터가 생긴 뒤 단순 DROP, pending 초기화 또는 Staging 전체 restore를 자동 실행하지 않는다. 필요한 경우 별도 승인된 복원을 한다.

따라서 **현재 전체 Staging의 현시점 복구 수단 확보는 미완료**다. 부분 export와 로컬 복원 테스트로 이를 완료 처리하지 않는다.

## 정확한 배포에서 flag OFF를 검증하는 절차

배포 승인을 받은 뒤에만 수행한다. 지금 고정 Staging은 직전 확인 #271 배포이며 #273(및 이번 보완) 코드의 OFF 검증 대상으로 사용할 수 없다. 일반 Preview의 미인증 302 또한 증거가 아니다.

1. Vercel에서 고정 도메인의 실제 deployment ID/branch=staging/Preview/배포 commit을 기록한다. 승인된 보완 head를 포함하는지 확인한다. flag는 등록하지 않거나 false로 유지한다. Production/일반 Preview 환경은 건드리지 않는다.
2. 동일한 Staging 브라우저 탭·관리자 세션에서 기존 `/api/projects/hwaseong-2026-10-samples/sample-tts`를 GET한다. provider/check, audio 쿼리와 POST는 사용하지 않는다. HTTP **200**, 예상 프로젝트의 계획 데이터가 있어야 한다. 302/401/403/503이면 검증 실패로 중단한다.
3. 동일 세션에서 `/api/projects/hwaseong-2026-10-samples/sample-tts/recovery` GET을 수행한다. HTTP **404**, login redirect 없음이 조건이다. fetch는 `credentials: same-origin`, `redirect: manual`, `cache: no-store`. 응답 코드와 deployment ID/commit만 기록하고 쿠키·헤더·전체 응답은 복사하지 않는다.
4. Network에서 요청 method가 GET뿐이고 OpenAI/Storage/DB mutation이 없음을 확인한다. 로컬 테스트는 OFF GET/POST가 외부 호출 전에 차단되고 기존 관리자 status 200과 함께 확인되는 쌍을 검사한다. 이것은 실제 Staging HTTP 성공의 대체 증거가 아니다.

이번에는 배포하지 않았으므로 **정확한 신규 Staging 배포에서 200/404 쌍은 미실시**다.

## 실제 Marin 생성까지의 승인 순서

1. 보완 코드와 잔여 경합을 검토한다. 현재 상태 백업/격리 복원 및 복원 범위를 확정한다.
2. 별도 승인 후 검토된 SQL을 정확한 Staging에 적용한다. 역할별 ACL/RLS/함수 정의와 baseline 불변을 확인한다. 일반 DB/Storage 정책은 변경하지 않는다.
3. 별도 배포 승인 후 고정 Staging만 갱신하고 위 관리자 status 200/복구 GET404를 확인한다. 기존 기사/디자인/글꼴/모바일 재생 회귀를 읽기 전용 검사한다.
4. 별도 flag ON·실제 생성 승인 후 DB 기록/실제 객체 존재를 다시 조회한다. 대상의 동시 수정·삭제 작업을 조율한다. `STAGING_OPENAI_API_KEY`만 쓰고 일반 키 fallback은 없다.
5. 승인 참조와 고정 parent/request key로 실행을 한 번 요청한다. 최대 애플리케이션 speech 호출 **1회**다. claim 응답 유실/제공자 불명에는 새 유료 요청을 실행하지 않는다.
6. provider HTTP 상태/정제된 request ID, 새 MP3 MIME/바이트/크기/hash/프레임, 원행 snapshot 및 DB 완료 기록을 대조한다. Storage 성공/DB 실패면 같은 기록의 명시적 reconcile만 검토한다.
7. 원래 논리 Marin manifest를 통해 390/520px·1배속 재생/정지/탐색과 실제 iPhone·Android를 확인한다. 현재는 모의 MP3/Range 검증뿐이며 실제 발음·모바일 청취는 미실시다. 다른 세 음성·기사 7건의 생성은 별도 범위다.

## 검증과 공통 모듈 충돌

신규 검증은 FK 거절 시 Storage 0회, DB 응답 유실, 실제 없는 파일, 공유 경로·segment, 정상 교체/삭제, 부분 정리 실패, 중복 클릭, 삭제 후 감사 이력 유지, 현재 자식 hash/resolver, 관리자 200/OFF404 쌍이다. SQL은 TCP OFF 임시 PostgreSQL에서만 실행한다.

로컬 검증 결과: 전체 **769/769**, skip 0(#273의 747개 대비 22개 증가); 실제 PostgreSQL 복구 계약 18개 포함. TypeScript·Webpack Production build·문서 링크·diff 검사 통과. lint 오류 0, 기존 경고 3개 유지. 브라우저 렌더링/실제 MP3 청취나 원격 Storage 권한·경합 실험을 통과했다고 보고하지 않는다. 일반 TTS 정리는 기존 best-effort 계약이어서 정리 실패가 음성 생성 자체를 롤백하지 않으며, 잔여 객체는 운영 확인 대상으로 남는다.

공통 변경 파일 `newsletter-file-storage.ts`, `article-tts-audio.ts`는 C1 #248의 파일 정리 변경과 충돌 가능성이 있다. C1 namespace 보호 코드는 가져오지 않았다. 향후 병합 시 일반 경로의 과잉 차단 문제와 이번 DB 참조 확인을 구분해 재검증해야 한다. 이 문서는 Production 적용 승인 또는 자동 GC 완성 선언이 아니다.
