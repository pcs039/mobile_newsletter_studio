# 디자인 저장·표시 상태 정합성 v1

기준: PR #223 merge `9e5722708837e22c724c1f48700e10f998b64584`.
브랜치: `codex/design-save-display-state-v1`.

## 재현한 문제

기준 main의 실제 `ArticleCompositionEditor`를 모의 API 응답과 함께 실행해
글자 수정 → 자산 배치 요청 → 성공 응답 순서를 재현했다. 기존 코드는
`setComposition(result.composition)`으로 미저장 textDesign까지 교체해 초안이 사라졌다.
이번 브라우저 검증은 실제 편집 컴포넌트를 사용하되 저장은 로컬 모의 응답만 사용했다.

## 저장 계약과 상태

- `useCompositionSaveState`는 마지막으로 확인된 서버 Composition, 로컬 textDesign,
  placement별 로컬 patch를 별도로 보관한다. 즉시 preview에는 초안을 합쳐 전달한다.
- 글자 저장은 기존 `update_text_design` 명시 액션, 배치·표시 설정은 기존 자동 저장이다.
  각 범위에 `변경사항 있음 — 저장 필요 / 저장 중 / 저장 완료 / 저장 실패 — 재시도 필요`를 표시한다.
- 배치 응답은 글자 초안을 지우지 않는다. 글자 저장 성공도 전송 당시 revision만 확인한다.
  요청 중 새로 입력한 글자는 남고 다시 저장해야 한다. 서버가 trim한 결과는 해당 revision일 때만 반영한다.
- 한 editor session의 요청은 직렬화한다. 뒤 요청을 먼저 보내 응답 순서를 뒤집지 않는다.
  동일한 pending key/payload는 합치며, 오래된 응답이 더 최신 로컬 배치를 지우지 않는다.
- 기사/project identity로 editor session을 key 처리한다. unmount 뒤 응답은 무시하고 아직
  시작하지 않은 이전 session의 queued write는 보내지 않는다. 이미 전송한 요청을 취소/rollback했다고 주장하지 않는다.
- 배치 조정 컴포넌트는 응답의 updatedAt만으로 remount하지 않는다. 최신 입력의 debounce가
  이전 응답 때문에 취소되지 않게 하고, 승인된 서버 값/자산 교체와 로컬 patch를 동기화한다.
- 실패 시 글자·위치·visible·sortOrder 입력은 유지한다. text는 현재 입력을 명시적으로 다시 저장한다.
  배치 PATCH만 명시 재시도 버튼을 제공하며 최신 로컬 patch를 사용한다. 추가/삭제/복사 실패는
  자동 재전송하지 않고 저장본 확인을 안내한다. 자동 write retry나 보상 rollback은 없다.
- 미저장 값 또는 미확정 실패가 있으면 기존 pattern/draft 적용은 먼저 저장하도록 안내한다.
  기존 copy는 textDesign을 복사하지 않으므로 현재 글자 초안을 유지한다. 미저장 배치가 있으면
  복사 전 먼저 배치 저장 상태를 해결하도록 한다. 외부 atomic draft 응답 중 새 글자를 입력해도 초안은 보호한다.

이 보호는 **현재 editor session의 요청·응답과 초안**에 대한 것이다. 새 DB 잠금/CAS 계약이나
다른 관리자 세션까지 포함한 동시 편집 보장을 추가하지 않는다. 기존 atomic copy/draft/apply의 서버 검증은 그대로다.
초안은 메모리 상태이며 새로고침 후 영구 복구 기능은 이번 범위에 포함하지 않는다.

## 독자 표시 조건과 preview

- 서버에 저장된 Composition ready/draft, asset approved/active, placement visible 상태를 요약한다.
- `title_icon / body_decoration / footer_banner`는 데이터·편집을 유지하면서 각 탭/작업 영역에
  `편집용 · 공개 미반영`을 표시한다. 지원 슬롯을 늘리거나 public/review renderer를 수정하지 않는다.
- 기본 조건을 충족해도 article 공개/검토 권한과 파일 검증은 별도다. UI는 공개 완료라고 표시하지 않는다.
- 즉시 preview는 **편집 중인 상태**, 모달 iframe은 **서버 저장본**이다. 본문은 기존의 저장 기사 기준이다.
  미저장·저장 중·실패가 있으면 상단 버튼 근처와 모달에 저장본 미반영 가능성을 표시한다.
- articleId와 boolean만 담는 로컬 DOM event로 editor와 기존 workspace header/modal을 연결한다.
  다른 article 이벤트는 무시한다. 원문·자산 경로·metadata를 event에 넣지 않는다.
- preview renderer 구조, reader 표시 계약, 파일 권한, Canva/GPT 생성·적용, 자산 승인 로직은 유지한다.

## 검증과 영향

- 신규 회귀 16개: 글자 초안 보호, 실패/명시 재시도, 직렬화/응답 역전 예방, 저장 중 추가 입력,
  최신 배치 patch 보존, pending 중복 요청, 기사 전환/늦은 응답/queued write 취소,
  foreign receipt 차단, copy/외부 draft receipt, 실패 후 원래 값으로 되돌린 경우,
  ready/draft·승인·활성·숨김·미지원 슬롯, workspace 저장본 안내 및 패턴 실패 후 재시도.
- 전체 기존+신규 테스트 **354/354, fail 0 / skip 0**. 실제 SQL 회귀는 disposable local PGlite만 사용한다.
- TypeScript, lint, Webpack build, diff check 실행. 기존 lint warning 3개 외 신규 warning 없음.
- 로컬 브라우저: 실제 editor/text controls/picker/save hook/summary/workspace/modal/preview 및 production CSS.
  패턴/Canva 영역과 저장 API는 mock이며 실제 서버 통합 E2E가 아니다.
- 1440/768에서 글자 수정→배치 저장→초안 유지, text 실패→명시 재시도 성공,
  배치 실패→입력 유지→재시도, draft/hidden 안내, 저장본 모달 경고,
  저장 중 기사 전환 격리를 확인했다. 미지원 슬롯 안내와 390px 폭도 추가 확인했다.
  확인한 폭에서 문서 scrollWidth==clientWidth, console error 0.
- 원격 write E2E는 수행하지 않았다. DB/Storage/Production 데이터 write 및 외부 AI/Adobe/Canva 호출 0.
  API route, DB migration, dependency, provider, 원문/블록/링크/공개 renderer 변경 없음.
- 다음 개선: 기존 감사의 별도 preview 일치성 작업과 활성 client-review·고해상도 Canva QA backlog.
  이번 PR은 OPEN으로 두고 병합하지 않는다.
