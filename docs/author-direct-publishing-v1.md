# 작성자 직접 발행 설계 v1

2026-10-18 (Asia/Seoul). 기준 main `9fdd73ff13dd1d17cbf9b7fa6bb7b56c33e74b5b`.
이 문서는 저장소 읽기와 설계만 수행한 결과다. 아래 API·RPC·migration은 제안이며 구현·적용하지 않았다. PR #226 및 기존 stash 두 개는 변경하지 않는다.

## 1. 권고와 범위

기본 경로를 **작성자 직접 발행**, 선택 경로를 **기관 검수 후 발행**, 별도 임시 공유를 **시연용 발행**으로 둔다. 직접 발행도 기존 공식 공개 상태 `published`와 공용 reader를 사용한다. 기관 승인 조건만 별도의 명시적 발행 방식에서 분리하며, 기존 승인 RPC를 조건 없이 풀거나 프로젝트 REST PATCH로 우회하지 않는다.

새 사용자 역할·전체 관리자 권한·새 public reader는 필요 없다. 최소한의 서버 권한 검사와 전용 atomic RPC가 필요하다. 발행 방식·실행자·응답 유실 재사용을 영속적으로 추적하려면 전용 발행 이력도 필요하다. 함수만 추가하는 안과 이력 포함 안을 아래에서 구분한다.

## 2. 현재 구현 근거

| 영역 | 실제 파일 / 동작 | 설계상 의미 |
| --- | --- | --- |
| 공식 발행 API | `src/app/api/project-publish/route.ts`: 프로젝트 권한 검사 후 `publishProjectIfClientApproved` 호출 | UI 버튼만 변경해서는 직접 발행 불가. 현재 명시적 same-origin 검사도 이 route에는 없음 |
| 다른 발행 진입점 | `src/app/api/projects/route.ts`: PATCH `updateStatus: published`도 동일 승인 repository 호출 | 이 legacy 경로를 직접 발행 fallback으로 사용하지 않음 |
| 승인 발행 RPC | `supabase/schema_v1_29_client_review_workflow.sql`: `publish_project_if_client_approved_atomic(uuid)` | service_role 확인 → project lock → 최신 review lock → approved/non-revoked → project in_review/published → status/published_at 갱신 |
| 발행 화면 결합 | `project-client-review-workflow.tsx`가 canPublish를 계산해 `project-publish-completion-panel.tsx`에 전달 | 기본 직접 발행 UI를 review loading/error/status에 종속시키지 않아야 함 |
| 사용자 권한 | `app-auth.ts`, `project-api-access.ts` | admin 전체 접근, user는 `assigneeName`과 사용자 name/id 정규화 일치. 잠긴 프로젝트는 user에게 unlock cookie 필요 |
| 공개 판정 | `src/app/newsletters/[slug]/page.tsx`, `src/lib/article-publication.ts` | project published가 공식 reader 진입 조건. regular 기사는 개별 draft도 노출 가능, rolling은 published+유효기간 필요 |
| 파일/디자인 | `src/app/api/public-files/preview/route.ts`, 기존 AI/Canva/Composition file helper | 공개 project 및 파일 ownership/각 자산별 승인·활성·provenance 계약 유지. 새 발행이 자산을 자동 승인하지 않음 |
| 비공개 저장 | `newsletter-repository.ts`의 `updateNewsletterProjectStatus`, `/api/projects` | 비공개 status 전환 존재. 독립 발행 취소 이력·동시성 보호는 보완 대상 |
| 발행일/이력 | project `published_at`은 승인 RPC 재실행마다 현재 시각으로 갱신, `published_date`는 별도 호수/발행일 입력 | 최초/최근 발행 이력이나 방식·실행자 전용 ledger가 아님. 기관 review 이력을 직접 발행 이력으로 오용하지 않음 |
| 시연 | v1.39 table, `demo-share.ts`, `project-demo-share-controls.tsx` | 선택 기사·만료·회수 기반 별도 비공개 공유. 정식 발행과 독립 유지 |

`ProjectPublishStatusControls`는 정의는 있으나 현재 저장소에서 사용처가 없다. 이 컴포넌트의 “관리자용” 문구는 실제 관리자 전용 권한의 증거가 아니며, 권한은 서버 helper 기준이다.

## 3. 기존/신규 흐름

| 방식 | 사용자 동작 | 서버 조건 | 결과 |
| --- | --- | --- | --- |
| 직접 발행 (신규 기본) | 저장본 확인 → 공개 범위/주의사항 확인 → 직접 발행 최종 확인 | 로그인+해당 프로젝트 권한+unlock+same-origin+발행 가능한 상태+최신 확인 정보 | 기존 공식 URL, status=published. review 승인 생성/변경 없음 |
| 기관 검수 후 발행 (유지) | 검토 요청 → 기관 승인 → 해당 경로의 발행 확인 | 기존 최신 approved/non-revoked 및 in_review/published 조건 | 기존 승인 RPC로 공식 발행 |
| 시연용 발행 (유지) | 기사 선택 → 자료 확인 → 기간 선택 → 링크 발급 | 기존 시연 권한·snapshot·파일 allowlist | 별도 bearer 링크. 프로젝트 공식 발행 상태 불변 |

직접 발행과 기관 검수 발행은 **서로 다른 자격으로 같은 공개 결과를 만드는 것**이다. UI의 직접 발행 기본 선택은 DB의 review 상태나 프로젝트 설정을 자동 변경하지 않는다. 기존 클라이언트의 mode 누락 요청은 `client_review`로 해석해 종전 승인 조건을 유지한다.

## 4. 최소 권한과 상태 전환

- 권한 기준은 `requireProjectApiAccess` 재사용. user의 다른 프로젝트·미배정 프로젝트는 403, 비인증은 401, unlock 미완료는 403. demo/client-review cookie는 관리자 세션 자격이 아니다.
- 실행자 ID/name/role은 서버 세션에서 얻는다. client의 actor/assignee/admin 주장은 무시한다. 현재 assignee는 정규화된 이름/id 기반이지 membership FK가 아니다. 이 한계를 명시하고 이번 단계에서 새 권한 체계를 만들지 않는다.
- 권한 판정 뒤 담당자 재배정 경합을 방지하기 위해 RPC에서 project를 lock하고 서버가 읽었던 assignee 값과 현재 값을 비교한다. 불일치는 409 후 권한 재확인. service_role RPC는 브라우저에 노출하지 않고 anon/authenticated/PUBLIC execute를 철회한다.
- 직접 발행은 `draft/private/in_review → published` 허용. review의 pending/approved/changes_requested/revoked/미존재는 자격 판정에 사용하지 않는다. archived/deleted는 차단한다.
- 동일 요청의 published 재호출은 성공 결과 재사용. 사용자가 별도 확인한 재발행만 새 event와 published_at 갱신. 네트워크 자동 retry는 하지 않는다.
- 발행 취소는 `published → private`로 공개 연결만 중단. 기사·Storage·review·demo row를 삭제하지 않는다. 공개 URL은 유지되지만 unavailable 화면이 된다. 과거 downloaded bytes는 회수 불가하며, demo 링크는 별도 회수 대상이라고 안내한다.

### 기관 검토와의 경합: 반드시 함께 해결할 부분

현재 `respond_client_review_atomic`은 승인 응답 시 project=in_review, 수정 요청 시 draft로 바꾼다. 직접 발행 후 기존 pending 링크에 응답하면 공식 공개가 풀리는 결함이 생길 수 있다. 또한 `request_client_review_atomic`은 published 프로젝트도 in_review로 바꾼다.

권고 최소 정책:

1. 직접 발행은 review row를 자동 취소하거나 승인하지 않는다. pending도 보존한다.
2. `respond_client_review_atomic`은 **project가 이미 published라면 review 응답만 기록하고 project status는 유지**한다. UI에도 “검토 응답은 기록되며 공개 상태는 별도로 관리합니다”를 표시한다. 비발행 상태의 기존 응답 전환은 그대로다.
3. `request_client_review_atomic`은 published 상태의 새 검토 요청을 conflict로 차단한다. “공개를 유지하는 재검토”는 v1 범위 밖이며, 검토를 다시 시작하려면 작업자가 명시적으로 비공개 전환을 확인한다. 조용히 공개를 내리지 않는다.
4. 모든 상태 mutation은 동일 project row lock 순서를 사용한다. 직접/기관 발행·발행 취소가 동시에 실행되면 뒤 요청은 expected revision 불일치로 409 처리한다. 기존 generic status PATCH도 이 보호를 우회하지 않도록 정리한다.

이 두 기존 RPC의 제한된 보완은 review 기능 삭제가 아니라 직접 발행과의 충돌 방지다. 그대로 두고 UI만 붙이는 안은 채택하지 않는다.

## 5. 발행 전 점검·확인

새 전용 API 대신 기존 `/api/project-publish`에 `action: prepare | publish | unpublish`와 `mode: author_direct | client_review` 분기를 제안한다. mode 누락 publish는 기존 승인 경로로 유지한다. 신규 action은 명시적 same-origin 검사를 추가한다.

prepare는 서버 저장본에서 공개 예정 콘텐츠를 계산해 기사 수·제외 기사·자산 누락·주의사항·revision digest를 반환한다. 토큰·private path·본문 전체를 반환할 필요는 없다. publish는 `requestKey`, `expectedRevision`, `confirmed=true`를 받아 서버에서 다시 계산한다. 값이 바뀌면 409로 재확인시킨다. client의 점검 통과 플래그만 신뢰하지 않는다.

- **차단:** 권한/설정/존재 오류, archived/deleted, stale, 확인 누락, 배포 대상에 맞는 공개 가능 콘텐츠 0건. e-book 전용 프로젝트는 기사 0건만으로 차단하지 않고 유효한 기존 e-book source로 판단한다.
- **주의 후 확인:** 요약 없음, 본문 없음, 일부 이미지·디자인 미승인/비활성/비지원, 누락 CTA, 기존 자동 체크리스트 미완료. 기관 승인 미완료는 직접 발행의 차단 사유가 아니다.
- **반드시 안내:** regular 기사 draft도 프로젝트 발행 시 노출될 수 있음. 모든 저장된 공개 대상이 포함되며 시연처럼 기사 일부 선택 발행이 아님. rolling 기간/상태와 자산별 기존 public filter는 그대로 유지.
- “저장된 내용이 누구나 열람 가능한 공식 URL로 공개됩니다. 연락처·개인정보·이미지 이용 권한을 확인했습니다” 체크 후 최종 버튼 활성화. 미저장 편집 초안은 포함하지 않음.
- 예시 요약: “공개 대상 기사 N개 / 기간·상태로 제외 M개 / 확인할 항목 K개”. 발행 방식과 공식 URL을 최종 확인 화면에 표시.

revision은 project의 공개 관련 값, article/block/link 및 공개 표현·자산 참조 변경을 식별하는 정렬된 digest다. 기사 본문 전체를 metadata에 복제하지 않는다. 기존 demo digest는 선택 기사·음성 등 목적이 달라 그대로 발행 fingerprint로 확정하지 않는다.

**공개는 immutable snapshot 배포가 아니다.** 발행 후 기존 저장이 공개 화면에 반영되는 현재 live reader 계약을 유지한다. 확인 후 실행 사이 변경을 검출하되, 프로젝트 lock만으로 모든 기사·자산 동시 편집을 막는다고 주장하지 않는다. 구현 시 해당 저장 경로의 잠금/재확인 범위를 테스트하고, 완전한 불변 버전 배포는 후속 구조로 분리한다.

## 6. 발행일·이력·재발행 계약

`status`, `published_at`, `slug`, `published_date` 및 공개 URL 생성 helper를 재사용한다. 새 status enum이나 `/direct-newsletters` URL은 만들지 않는다.

| 상황 | 처리 |
| --- | --- |
| 최초 직접 발행 | status=published, published_at=서버 시각, author_direct event 1건 |
| 동일 requestKey/동일 입력 재요청 | event와 published_at 변화 없이 같은 결과 반환 |
| 동일 key/다른 project·actor·mode·revision | conflict. 다른 사용자의 성공 응답 재사용 금지 |
| 발행 후 기사 저장 | 현재 live 공개 반영 계약 유지. 자동 비공개/자동 재승인 없음. 저장 UI에서 공개 영향 안내 |
| 명시적 재발행 | 새 key+확인+최신 revision. published_at=최근 발행 시각, 이전 event 보존 |
| 발행 취소 | private 전환, 최근 published_at 보존, unpublish event 기록. 새 링크 발급 없음 |
| 기관 승인 발행 | 기존 RPC의 승인 검증 유지. 이력은 client_review로 구분 |

기존 published 프로젝트에 방식·최초 시각을 소급 추정하지 않는다. “이전 발행 · 방식 기록 없음”으로 표시한다. 기존 review history는 그대로 별도 표시한다. 이미 발행된 내용 변경을 재발행 버튼이 눌릴 때까지 숨기는 의미로 안내해서는 안 된다.

## 7. DB/API/RPC 최소 변경 비교

| 안 | 변경 | 장점/한계 |
| --- | --- | --- |
| 함수만 추가 | 직접 발행 함수 + review 경합 보완, 기존 project 컬럼 갱신 | schema 변경 적음. 하지만 실행자/방식 이력과 지속적인 requestKey 복구가 없어 응답 유실·재발행 구분 불충분. 완성 v1 권고안으로는 부적합 |
| **권고 최소안** | 전용 publication event table 1개 + project/time index·RLS·service_role 권한, atomic transition 함수, 기존 review 함수 2개 제한 보완 | 기존 project/article/Storage schema 보존. 이력·중복·발행 취소를 transaction으로 관리 가능. 실제 migration 정의·적용은 별도 구현/승인 단계 |

event 개념 필드: request UUID(PK), project FK, actor ID, mode, action(publish/unpublish), request hash, checked revision digest, previous/new status, resulting published_at, created_at. token/개인정보 원문/기사 사본은 기록하지 않는다. event는 일반 앱에서 수정·삭제하지 않는다. anon/authenticated 접근 차단. 새 table 이름과 migration 번호는 구현 당시 최신 schema 기준으로 확정한다.

권고 RPC는 동일 project lock 아래 **상태 검증·이미 처리된 key 확인·revision 확인·project 상태/발행시각 변경·event INSERT**를 한 transaction으로 수행한다. 실패 시 전체 rollback. 중복 조회는 이미 발행된 뒤 revision이 바뀌었더라도 같은 요청 성공을 반환할 수 있게 입력 hash와 actor/project를 먼저 검증한다. 의미상 다른 재발행에는 새 key가 필요하다.

기관 승인 경로는 기존 `publish_project_if_client_approved_atomic`의 검증 본문을 보존하면서 공통 transition에 참여하도록 보완하거나, wrapper 내부 동일 transaction에서 기존 함수를 호출하는 방식을 비교한다. HTTP 두 요청으로 “먼저 발행하고 나중에 이력”을 쓰지 않는다. 기존 `/api/projects` published 분기는 여전히 기관 승인 경로이며, mode를 슬쩍 추가해 승인 우회 경로로 만들지 않는다. legacy 상태 변경의 private/draft/in_review/archived도 신규 직접 발행과 경합하지 않도록 transition 연계를 점검한다.

server 인증과 SQL role의 경계를 분명히 한다. 현재 앱 계정은 Supabase authenticated UID 기반 membership이 아니다. RPC의 actor 값은 신뢰한 서버에서만 공급하고 service key는 client에 전달하지 않는다. 새 table/RPC만으로 일반 사용자를 admin으로 승격하지 않는다.

## 8. 화면 구조와 작업자 동선

```text
검수·발행
  현재 상태 / 공식 URL / 최근 발행 시각·방식
  [직접 발행] (기본, 펼침)
    저장본 미리보기 · 공개 대상 요약 · 주의사항
    공개 자료 최종 확인 체크
    [직접 발행하기] → 확인 → 결과/URL/QR
    발행 중: [다시 발행] [비공개로 전환] (각 명시적 확인)
  [기관 검수 후 발행] (선택, 접기)
    기존 요청/승인/이력/기관 승인 경로 발행
  [시연용 발행] (선택, 접기)
    기존 기사 선택/기간/복사/공유/회수
```

한 위치의 공식 발행 결과 카드/URL/QR를 공유한다. 기관 검토 컴포넌트가 공식 발행 결과 패널 전체를 소유하는 현재 결합은 최소한으로 분리한다. 직접 발행을 선택했을 때 review 조회 실패가 직접 버튼을 잠그지 않는다. 동시에 두 방식의 발행은 금지하고 pending action lock을 공유한다. 기본 선택 변경만으로 API mutation은 없다.

모바일에서 CTA·최종 확인·URL 복사를 한 열로 배치한다. 과도한 체크리스트는 요약 후 펼침. 시연은 “공식 공개 아님”, 직접/기관 승인 발행은 “공식 공개”로 구분한다. 명칭만 바꾸고 기존 발행 버튼을 복제하지 않는다. 문서 전용인 이번 PR은 실제 UI를 변경하지 않는다.

## 9. 회귀 위험과 QA 계획

| 검증 | 기대 결과 |
| --- | --- |
| admin/담당 user/미배정/다른 project/locked/세션 만료 | 담당 권한만 발행; 401/403와 unlock 계약 유지 |
| cross-origin·위조 actor·변조 mode·누락 확인 | 외부 mutation/권한 위조 차단. mode 누락은 기존 승인 경로 |
| direct + 모든 review 상태 | 승인 여부와 무관하게 적격 project만 published, review row 불변 |
| client_review + 승인 없음/수정 요청/회수/다른 project | 기존 승인 발행 실패 유지 |
| 직접 발행 후 pending review 응답 / 동시 검토 요청 | 공개를 암묵적으로 draft/in_review로 내리지 않음; review 기록 일관 |
| 발행/취소/재발행/담당자 변경 동시 요청 | project lock+revision+key로 충돌. 부분 event/write 없음 |
| 더블 클릭·응답 유실·새로고침·동일 key 다른 입력 | event/발행시각 중복 변경 없음, 안전한 결과 복구/명확한 conflict |
| 기사 수정·파일 승인 변경 후 prepare 재사용 | 최신 상태 재검증/경고. 이전 점검을 무조건 통과시키지 않음 |
| regular draft / rolling 미발행·만료 / e-book 전용 | 기존 공개 범위를 정확히 설명하며 실제 reader 조건 동일 |
| 비공개 전환 후 public/file/audio | 기존 공개 제한 유지. 이미 내려받은 사본 회수 한계 안내 |
| Composition draft/hidden·AI/Canva 미승인·inactive | 기존 renderer/파일 filter 유지, 자동 승인 없음 |
| 시연 발급/회수, client review session, 공개 URL/QR | v1.39 및 기관 검수 독립 동작 유지. demo 세션으로 공식 발행 불가 |
| 390/768/1440, 느린 네트워크, 실패·재시도 | 버튼 잠금/결과 구분/오류 명확, overflow·console error 없음 |

구현 검증은 pure/unit·격리 SQL transaction 테스트 → 전체 테스트·TS/lint/Webpack build/diff → 승인된 Staging fixture E2E 순서다. Production rollout은 migration·배포 별도 승인 후 기존 데이터 digest와 권한을 read-only 비교한다. 실제 Production 무안군 발행/시연 링크 생성은 별도 지시 없이는 실행하지 않는다.

## 10. 단계별 최소 구현 순서 / 예상 파일

1. 본 설계 합의: 권한, regular draft 공개, published 검토 응답, 발행 이력 및 취소 정책 확정.
2. 서버 계약·격리 SQL: 새 publication repository/atomic RPC/event table 정의, review RPC 경합 보완. migration **작성만** 하고 적용은 별도 승인.
3. 기존 `api/project-publish/route.ts`에 prepare/direct 분기, `api/projects/route.ts` legacy guard/상태 경합 정리. 동일 API 내 상태 코드 not_ready/conflict/unauthorized 구분.
4. `project-client-review-workflow.tsx`, `project-publish-completion-panel.tsx`, `projects/[projectId]/publish/page.tsx`의 최소 분리·공통 결과 재사용. 필요 시 직접 발행 전용 작은 controls 추가. `project-demo-share-controls.tsx`와 reader는 변경하지 않음.
5. `client-review-repository.ts`와 전용 publication repository의 서버 결과 매핑, 새 회귀 테스트. 신규 dependency·생성 provider 없음.
6. Staging migration/실제 발행→비공개→재발행 E2E 별도 승인. Production 공개 데이터는 사용하지 않음.
7. 검증 통과 후 별도 Production rollout 승인. 기존 v1.36/37 미적용 migration 등 무관한 rollout을 끼워 넣지 않음.

### 이번 문서 PR의 검증/영향

- 로컬 source 및 SQL 정의만 조사. 원격 DB 조회/변경·Storage·외부 생성 API 호출 없음.
- 앱 코드/API/RPC/migration 파일 변경 없음. PR #226 head 변경 없음.
- Markdown 구조·참조 경로·변경 파일 단독성 및 `git diff --check` 검증. 실행 코드가 없으므로 앱 테스트/브라우저 E2E를 새로 수행한 것으로 보고하지 않는다.
- 구현 시 위 QA가 필요하다. 설계만으로 직접 발행이 Production에 활성화된 것이 아니다.
