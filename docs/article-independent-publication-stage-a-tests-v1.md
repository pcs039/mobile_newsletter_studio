# 기사별 독립 발행 A단계 — 테스트 계약 v1

기준 main: `1d403683d878e3a64b8cc32f8e65ea397562b558`.
연결 문서: [DB·RPC 설계](article-independent-publication-stage-a-v1.md).

이 문서는 **향후 구현의 검수 기준**이다. 아래 신규 시나리오는 테스트 코드가 아니며 아직 실행하지 않았다. 이번 PR은 기존 회귀 테스트만 실행한다. Production/Staging mutation, 실제 Storage 복사/삭제, 신규 API 실행은 승인 범위 밖이다.

## 1. 테스트 환경과 불변 baseline

- 격리 PostgreSQL/PGlite에 현행 v1.38/v1.40 및 필요한 선행 schema를 구성. PostgREST HTTP 매핑은 별도 격리 통합 환경에서 확인한다(PGlite만으로 실제 HTTP409를 증명하지 않음).
- admin, 담당 user, 다른 프로젝트 user, 미인증, 잘못된 service role을 구분. trusted server 주입 actor와 브라우저 payload 변조를 구분한다.
- 프로젝트 P/Q, 기사 A/B, 같은 P의 비공개 기사 B, 별도 Q의 기사 C. regular/rolling, 발행/미발행 프로젝트 조합.
- 여러 block/link, ready/draft Composition, 부모 기본값 상속, 4개 font 역할, approved/draft/inactive asset, upload/AI 음성, private/public/external media를 구성.
- 시작 전 schema/권한, 기존 project/article/block/link/asset/audio/font/리뷰/시연/발행 이벤트 digest 기록. 테스트마다 예상 신규 상태/revision/event/preparation/ledger 변화만 허용.
- 실제 row ID와 보존 snapshot 내 provenance ID를 구분. 기사 저장의 기존 block/link 재생성을 신규 독립 발행이 변경하지 않음.
- Storage 테스트는 로컬 모의 object store부터 수행. 이후 명시 승인된 Staging에서만 실제 바이트·권한·회수 확인.

## 2. 상태·revision·제약

| ID | 시나리오 | 필수 기대 결과 |
|---|---|---|
| S01 | 미발행 프로젝트 A 최초 publish | 독립 A published/version1/event1; project.status/다른 기사 불변 |
| S02 | ready 미디어 없는 publish | PT409 media_not_ready; 공개 상태/event 불변 |
| S03 | published 상태 새 publish | state_conflict; replace로 안내 |
| S04 | draft 저장 | 현재 공개 revision/hash/파일 불변; draft만 변경 |
| S05 | 변경 replace | 공개 pointer 한 번 교체, version+1/event+1 |
| S06 | 같은 payload replace | unchanged/no-op, version/event 증가0 |
| S07 | withdraw | active null, withdrawn; 마지막 revision/원본/media/job 보존 |
| S08 | withdrawn/never 상태 withdraw | state_conflict, 이벤트0 |
| S09 | 이전 공개본 선택 republish | 지정한 이력 revision 공개; 최신 draft 자동 선택 금지 |
| S10 | 새 검수본 선택 republish | 새 ready revision만 공개 |
| S11 | 다른 기사/프로젝트 revision 연결 | 복합 FK 또는 RPC 거부, event0 |
| S12 | revision/event UPDATE·DELETE | SQL 권한/불변 trigger로 거부 |
| S13 | published+null pointer/잘못된 상태 조합 | CHECK 위반 |
| S14 | project/article hard delete | 이력 cascade 삭제 없음, restrict 동작 및 기존 UX 영향 기록 |
| S15 | archived/soft deleted | 독립 접근/신규 발행 차단. 철회 허용 정책을 구현 전 확정 |
| S16 | 준비 pending→verified→finalize | ready 전 immutable revision 없음; finalize가 한 revision만 생성 |

## 3. 요청 재사용·응답 유실

| ID | 조작 | 기대 |
|---|---|---|
| I01 | 같은 key/payload 두 번 | 두 번째 duplicate, 성공 event1/동일 시각 |
| I02 | 같은 key+다른 article/project/actor/action/revision/version | PT409 또는 권한 거부, 새 event0 |
| I03 | DB commit 후 응답 유실 | 같은 입력으로 당시 영수증 복구, 파일 복사0/event 추가0 |
| I04 | 과거 publish 영수증을 withdraw 후 재조회 | 당시 성공과 현재 withdrawn을 별도 반환 |
| I05 | 성공 후 담당자 변경·권한 상실 | 기존 영수증도 새 권한 없이 조회 불가 |
| I06 | 실패한 transaction 다시 같은 key | 실패 event 없음; 현재 조건이 유효할 때 한 번만 성공 |
| I07 | unknown 상태 새 key 실행 | UI가 차단, 기존 결과 확인만 허용(향후 D) |
| I08 | no-op 후 상태 변경 뒤 같은 입력 | 성공 재실행으로 가장하지 않고409/재확인 |
| I09 | 같은 preparationKey 재시도 | 동일 pending/ready 후보 재사용; 다른 입력은409 |

## 4. 경합: barrier를 둔 두 개 이상의 DB 연결

타이밍에 의존하는 sleep만으로 통과시키지 않고 barrier/lock wait를 관찰한다. PostgreSQL 실제 세션에서 확인할 항목은 PGlite 성공과 구분한다.

| ID | 병행 요청 | 판정 |
|---|---|---|
| C01 | 같은 key publish 두 요청 | event1, duplicate1 |
| C02 | 같은 expectedVersion·서로 다른 key publish | 한 성공, 한409, event1 |
| C03 | replace vs withdraw, 같은 버전 | 한 성공, 다른409; 혼합 pointer/event 없음 |
| C04 | withdraw vs withdraw | 한 성공, 한409(동일 key면 duplicate) |
| C05 | 오래된 state version | 즉시 PT409, PostgreSQL40001로 업무 충돌 표현 금지 |
| C06 | prepare 후 기사/블록/링크 수정 commit | transition409 |
| C07 | article.updated_at 그대로인 Composition/배치 변경 commit | sourceHash 변경으로409 |
| C08 | 기본 폰트·색상·asset/audio 참조 변경 | snapshot 의존성 hash에 포함,409 |
| C09 | 검증 SQL snapshot 시작 뒤 편집 commit | 기존 candidate만 공개; 새 편집은 draft에 남음. 동시 편집 전면 금지로 보고하지 않음 |
| C10 | 여러 관련 표를 한 writer transaction에서 변경 | source capture가 전/후 중 하나만 포착, 혼합 snapshot 금지 |
| C11 | 여러 REST 요청으로 배치 수정 | 중간 committed 상태 한계 재현·기록. 전체 작업 원자성을 주장하지 않음 |
| C12 | reorder/저장/AI·Canva apply/batch-copy와 경쟁 | 원본 손상 없음, timeout 무한재시도 없음, 잠금 역순/교착 여부 기록 |
| C13 | media GC vs finalize/commit | 같은 ledger lock; pin 또는 deleting 하나만 승리, 삭제된 파일 공개 금지 |
| C14 | 담당자 변경 vs transition | 잠금 후 현재 담당자 재검증; 오래된 권한 거부 |

직렬화 오류40001/교착40P01과 PT409 도메인 오류를 각각 검증한다. 실제 교착을 임의로 PT409로 치환하지 않는다. DB 오류 후 event/pointer가 일부 남으면 차단 결함이다.

## 5. 스냅샷·미디어 fault injection

- M01: 제목/요약/본문/공공정보/block/link/CTA/Composition/상속값/font faces/media manifest/rendererVersion 모두 포함. canonicalization DB↔서버 고정 fixture 해시 동일.
- M02: 원본 block/link row 재생성 뒤 이미 공개된 snapshot 정상. provenance ID를 live FK로 재조회하지 않음.
- M03: 미디어 hash가 없는 pending preparation은 최종 확인 불가. 파일 검증 뒤 finalize만 immutable revision 생성.
- M04: source GET 중 파일 변경, 복사 중 변경, 저장본 hash/MIME/size 불일치: ready/발행 불가.
- M05: upload 성공·응답 유실: 예정 경로 검증 후 재사용, 파일 중복 없음.
- M06: Storage 성공·DB finalize/commit 실패: 비공개 준비 파일 보존, event 조회 전 삭제 금지.
- M07: commit 성공·응답 유실 후 cleanup 실행: pinned 객체 삭제0.
- M08: GC 삭제 응답 유실/부분 실패: ledger에서 재개, 원본/공개 이력 파일 삭제0.
- M09: 원본 삭제/덮어쓰기 후 보존본 정상. 보존본 자체 변경은 검출/경고, live draft fallback 금지.
- M10: signed 다운로드 URL/외부 이미지/CSS url()/다른 기사 파일/AI·PSD 원본/project PDF/알 수 없는 bucket: blocker로 반환.
- M11: 공개 brand URL의 구 URL 회수 불가능성과 공용 font 예외를 명확히 표시. private 복사로 구 URL도 회수했다고 주장 금지.
- M12: asset 승인 취소/inactive/폐기, font 사용 중지 시 현재 안전 조건 우회 금지. 표시 계약 미결정이면 활성화 금지.
- M13: missing media, 404, 전송 중단, Range206, 대용량/압축폭탄/지원 불가 MIME: 정상 발행으로 처리 금지.
- M14: 전체 의존성에 모호한 상대 URL/외부 embed가 남으면 canCommit=false.

## 6. 권한·접근·캐시 (B/C 구현 이후 실행)

- A01: service_role 외 직접 RPC/표 SELECT/INSERT/UPDATE/DELETE 차단. 함수 PUBLIC execute 미부여.
- A02: 비인증401, 비담당403/은닉404, project mismatch404, 위조 actor 무시, same-origin 위반403, project unlock 유지.
- A03: 정기호 private 상태에서 A 독립 URL200; B/C 비공개·목록·검색·이전/다음·e-book 접근 차단.
- A04: HTML/OG/thumbnail/이미지 확대/음성 manifest/segment/HEAD/Range/조건부GET/변환 캐시 모두 같은 revision membership 검사.
- A05: withdraw commit 뒤 새 요청404, 기존 browser·쿠키 없는 HTTP 동일. 캐시hit로200 금지. 실행 중stream/이미 다운로드한 파일은 별도 한계.
- A06: replace 뒤 이전 revision file URL404. 관리 이력 조회는 별도 인증.
- A07: Cache-Control private,no-store,max-age=0, CDN/Vercel-CDN no-store 확인. 임의 query 추가 없이 같은 URL로 검증.
- A08: 공개 URL에 서비스키/signed URL/Storage path 누출0. 실패 메시지/로그/trace에도 토큰·원본 비공개 본문 비노출.
- A09: feature off/schema 없음/proxy 준비 안됨: UI·API 비활성, 공개 접근 fail-closed.

## 7. 정기호·기관 검수·시연 회귀

- R01: author_direct 정기호 발행/비공개/명시 재발행/중복 key/stale409/응답 유실 영수증 유지.
- R02: 기관 승인 없는 client_review 발행 차단, 승인 후 정상, published 이후 검수 응답에도 published 유지.
- R03: regular draft와 rolling(status/valid_from/valid_until) 기존 공개 조건 유지.
- R04: sort_order→id 기본 순서, 수시/긴급/기관 중요도/관심분야 정렬 유지.
- R05: 정기호 발행 중 독립 withdraw: 독립 URL만 차단, 정기호 열람 유지. UI가 전체 회수로 안내하지 않음.
- R06: 정기호 unpublish 중 독립 published: 독립 URL은 유지. project.status가 아니라 별도scope로 파일 검사.
- R07: 정기호 수정 즉시 반영은 유지, 독립 공개본은 replace 전 불변.
- R08: 시연 selected articles/만료/회수/내용변경/파일·음성 차단과 기관 검수 인증 경로 유지.
- R09: 기사 저장·4개 font ID·상속·Composition 미저장 보호·React #130 회귀 없음(향후 UI PR).
- R10: A schema 추가 전후 기존 테이블 row/count/digest/grant/policy 일치. 신규 표/FK로 hard-delete가 막히는 영향은 승인 자료에 별도 명시.

## 8. 실행 게이트와 증거

A1 완료: 실제 migration SQL과 RPC 구현 승인을 받은 뒤, 격리 DB에서 제약/권한/동시성/fault tests 실행. 위 C 시나리오의 source capture 경계와 GC 불변 조건을 증명하지 못하면 A1 완료로 보고하지 않는다.

B/C/D 완료: 로컬→별도 승인 Staging에서 미디어 보존/독립 접근/철회·재공개와390/768/1440px 확인. 서버 실제 HTTP status와 SQLSTATE, event 개수, before/after digest, 파일hash를 기록한다. 토큰/쿠키/서비스키는 기록하지 않는다.

Production: migration·Storage·enable은 각각 승인된 범위에서만 수행. 기존 정기호 발행/기사/파일 mutation을 배포 검증용으로 실행하지 않는다. 사용자 최종 확인은 한 번, 내부 준비 실패는 문제 조치만 노출한다.

## 9. 이 문서 PR의 검증 기록

아래는 신규 테스트 구현이 아닌 기존 계약 회귀 확인 결과다. 실행 결과와 보존 상태는 PR 본문에 최종 기록한다.

- `tests/author-direct-publishing.test.cjs`: 기존 프로젝트 발행/권한/SQLSTATE/중복·경합.
- `tests/author-demo-share.test.cjs`: 기존 시연 권한·scope·만료·회수.
- `tests/article-order.test.cjs`: 기본 순서 계약.
- `git diff --check`, 변경 파일 allowlist(문서2개), 로컬 Markdown 링크 검사, secret pattern 검사.
- 전체 TypeScript/lint/build는 실행 코드 변경이 없는 문서 전용 PR에서 재실행하지 않는다. Vercel PR check는 별도 확인한다.

2026-10-21 실행: 위 기존 테스트 3개 파일 **60/60 통과, 실패0, skip0**. 문서2개 링크·코드 fence·secret pattern 검사와 diff check 통과. 신규 계약 시나리오는 미구현/미실행이다.
