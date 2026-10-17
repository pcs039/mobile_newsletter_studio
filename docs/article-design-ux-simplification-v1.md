# 기사 디자인 화면 UX 간소화 v1 — 설계

작성일: 2026-10-15 (Asia/Seoul). 기준 `main = origin/main = fcc1264377b243a384fdde5aebab2c14969c7df8`.
문서 브랜치: `codex/article-design-ux-simplification-v1`.

## 1. 결론과 조사 범위

**디자인 선택 → 필요한 부분만 세부 조정 → 편집본과 저장본 확인**의 세 범주로 정리한다. 기능을 삭제하거나 새로운 편집기를 만들지 않는다. 추천·생성·승인·가져오기·기사 적용은 서로 다른 행동이며, 접기만으로 실행하거나 단계를 합치지 않는다.

이번 PR은 이 문서 한 파일만 추가한다. 앱 화면·상태 hook·reader·API·DB·Storage·환경변수·dependency·migration은 변경하지 않는다. 외부 생성 API, 원격 데이터 write, 배포 전환 및 merge를 수행하지 않는다. PR 생성에 따른 통상 Preview CI와 Production 배포는 구분한다.

근거는 현재 main의 컴포넌트·호출 관계와 기존 검증 문서다. 이번 설계 감사에서 새 브라우저 QA나 DB 조회를 수행하지 않았다. 과거 감사의 결함을 현재 미해결로 그대로 옮기지 않는다. PR #224의 초안/요청 순서 보호와 PR #225의 공통 `ArticleCard` 재사용·본문 전체 표시·390/520 폭·글자 확대·sticky preview는 이미 구현된 기준이다.

참조: [최초 감사](design-workflow-audit-v1.md), [저장 상태 계약](design-workflow-save-state-v1.md), [미리보기 정합성](design-preview-consistency-v1.md).

## 2. 현재 실제 화면 구조

진입: `/projects/[projectId]/articles` → `/reading?articleId=…&tab=composition`.

| 현재 위치 / 구현 | 주요 하위 기능 | 현재 노출 / 책임 |
| --- | --- | --- |
| 공통 workspace header | 기사 제목·상태·블록/링크 수, 작성/디자인/검수/발행, 저장본 미리보기와 미저장 안내 | 탭 외부의 단일 저장본 preview 진입점. 탭 패널은 `hidden`으로 유지 |
| Composition 미생성/미사용 분기 | 디자인 조정 시작, 오류/준비 안내, 등록 Canva 템플릿, 다른 기사 배치 불러오기 | 생성 전 분기를 삭제하거나 자동 Composition 생성으로 바꾸지 않음 |
| Composition header | ‘2. 디자인’, ‘기사 디자인 조정’, 안내, 작성 중/준비 완료 | 기사 공개 상태와 다른 Composition status. 버튼이 실제 자동 저장 mutation을 수행 |
| `DesignSaveSummary` | 텍스트 명시 저장 / 배치·표시 자동 저장, 실패·재시도, 저장본 ready/draft, 공개 조건 상세 | 정상 저장 표시도 매번 두 줄. 상세는 이미 접혀 있음 |
| `ArticleCanvaTemplates` | 프로젝트 등록 템플릿 선택, 자동 입력 예정 확인, 템플릿 관리, 개발자 상세 | 이미 접힘. 패턴 일치 개수는 추천 표식이고 canonical Top 3와 다른 목록 |
| `ArticleProductionPatternControls` | 현재 패턴, `ArticleDesignDraftControls`, 작성 단계 추천, 별도 AI 패턴 추천, 수동 패턴 선택·변경 예정·확인 적용 | 제작 패턴 fieldset이 큰 상위 컨테이너가 되어 서로 다른 경로를 감쌈 |
| `ArticleDesignDraftControls` 내 Visual Director | 전략·이유·자료 필요, 기관 자산 매칭, hybrid, 정보그래픽, GPT 이미지 실행/관리 | 기사 전략과 gate에 따라 하위 UI 표시. 생성 결과·실패·미확정 상태가 있음 |
| 같은 controls 내 AI 디자인 추천 | Canva canonical Top 3(해당 전략일 때), 선택·제작·검토·import·apply | 카드 선택은 제작/승인/기사 적용이 아님. 실제 실행은 별도 조건 검사 |
| 같은 controls 내 콘셉트/초안 | 콘셉트 3안, 비주얼 자산 계획, 역할별 생성, 초안 만들기, 변경 예정/유지 항목, 적용/취소 | 콘셉트와 Canva template은 별개. 초안 apply가 실제 Composition 변경 |
| ‘세부 디자인 조정’ details | 글자 요소(소제목/번호/라벨/캡션/본문 강조)와 명시 저장 | 이미 기본 접힘. 로컬 초안은 서버 배치 응답과 분리됨 |
| 같은 details 내 재사용 | 다른 기사 선택, 배치 복사, 복사/유지 범위와 확인 | 배치만 복사. textDesign/productionPattern 전체 복제가 아님 |
| 같은 details 내 자산/슬롯 | 관리 링크·자산 수, 5개 슬롯 탭, picker, 현재 배치·표시·삭제·표현/색상 | 공개 지원 2개와 편집용 3개가 같은 탭 묶음. 자산 승인 관리와 배치는 별도 |
| 배치별 고급 details | 위치·회전·크기·투명도·z-index·sortOrder, 초기화; fluid frame 옵션 | 이미 접힘. slider debounce/blur 자동 저장을 보존해야 함 |
| 즉시 미리보기 | 편집 상태 안내, 390/520, 기본/크게/최대, 공통 카드·lightbox, 빈 자산 안내 | xl부터 옆 sticky, 작은 폭에서는 아래. 원문은 마지막 기사 저장값 |

### 호출 관계에서 주의할 점

- `ArticleCompositionEditor` → `ArticleProductionPatternControls` → `ArticleDesignDraftControls` 안에 Visual Director와 canonical 추천·콘셉트가 함께 있다. 단순 문구 변경으로 독립 기능처럼 분리할 수 있는 구조는 아니다.
- 등록 템플릿 경로는 `ArticleCanvaTemplates` → `CanvaTextAutofill`이며, canonical 추천 경로는 `ArticleTemplateRecommendations` → `CanvaRecommendationExecutionControls`이다. UI 목적이 비슷해도 template ID/준비·실행 계약이 같다고 가정하지 않는다.
- 전략별 GPT 생성과 콘셉트 자산 계획의 생성도 서로 다른 입력/receipt를 사용한다. 하나의 생성 버튼으로 합치지 않는다.
- 현재 main에는 상세 접기·고급 위치 접기·개발자 상세 접기가 이미 있다. ‘모든 설정이 처음부터 펼쳐져 있다’는 진단은 부정확하다.

## 3. 기존 구조와 개선안 비교

| 문제 / 현재 | 개선안 | 첫 최소 구현 포함 여부 |
| --- | --- | --- |
| workspace와 내부 카드에 디자인 제목/안내 반복 | workspace는 현재 기사·탭, 내부는 세 범주 제목만 제공. 같은 도입 문장 반복 축소 | 포함 |
| ‘제작 패턴’이 전략·생성·콘셉트 전체의 상위 개념처럼 보임 | 상위 제목은 ‘디자인 선택’. 현재 패턴은 짧은 현황으로 표시하고 수동/AI 패턴 도구는 명시적 하위 항목 | 제목/시각 계층 포함. 컴포넌트 추출은 후속 |
| canonical 추천과 프로젝트 등록 Canva가 모두 ‘추천/제작’ | ‘기사 맞춤 Canva 후보’와 ‘등록된 Canva 템플릿 사용’으로 출처·목적 구분 | 포함, 실행 경로 통합 제외 |
| 전략 이유·공통 주의·콘셉트·AI 패턴·수동 변경 예정이 연속 표시 | 전략 요약과 해당 행동을 먼저, 콘셉트/패턴 변경은 선택해서 펼침. 변경 예정은 확인 단계에 유지 | 접기/정적 안내 정리 포함 |
| ‘AI 추천 받기’와 ‘디자인 콘셉트 제안받기’의 차이 불명확 | ‘제작 패턴 추천받기’ / ‘디자인 콘셉트 제안받기’. 원래 handler 유지 | 포함 |
| 정상 저장 두 줄 + 텍스트 저장 상태 + preview 안내 반복 | 상단은 정상 시 조용한 요약. dirty/saving/error만 강조. 저장 버튼 옆 범위 상태는 유지 | 표현만 포함 |
| ready/draft와 저장 완료·공개 완료 혼동 | ‘독자 화면 표시 준비’로 의미 설명. 별도 공개/권한/승인 조건 안내 유지 | 포함, 상태 값/저장 변경 제외 |
| 텍스트·복사·자산 안내에 여러 카드/번호 반복 | 세부 영역 내 ‘글자’, ‘배경·상단 장식’, ‘다른 기사 배치 재사용’. 장식 기본 안내 한 번, 상태별 이유는 제자리 | 기존 컨테이너 정리만 포함 |
| 미지원 3슬롯이 주 작업처럼 보임 | 기존 슬롯/ID/편집 유지, ‘공개 미반영 장식’ 안내로 시각 우선순위 낮춤 | 첫 PR은 라벨/안내만. 탭 구조 변경 후속 |
| 빈 자산 문구와 관리 링크가 설정·preview에 반복 | 설정 영역에 관리 링크 한 곳. preview 쪽은 필요 시 짧은 빈 상태만 | 포함. 화면 내 숨김 시 접근 경로 검증 |
| preview가 두 가지인 이유를 긴 설명으로 반복 | ‘즉시 미리보기 · 편집 중’과 ‘저장본 미리보기’ 라벨 유지, 차이는 한 줄 + 필요 시 상세 | wrapper 설명만 포함 |

## 4. 제안 정보구조와 기본 노출

세 범주는 **동시에 존재하는 페이지 섹션**이다. 새로운 탭/라우트/별도 편집기를 추가하지 않는다. 접힌 영역은 키보드로 펼칠 수 있고, 스크롤 이동 링크를 쓰더라도 저장/생성 행동을 유발하지 않는다.

### 1) 디자인 선택

- 기본: 현재 패턴 한 줄, AI 시각 전략 요약, 사람의 자료 확인 필요 상태, 해당 전략의 후보/진입점.
- 전략별 작업은 기존 gate를 따른다. 실제 사진 필요 시 기관 자료 확인이 먼저이며 AI 생성으로 대체하지 않는다. hybrid의 대표/보조 역할과 이전 결과 유지 안내도 보존한다.
- canonical Top 3는 기존 조건일 때만 표시. 선택 → 제작 조건 확인 → 사용자 실행 → 결과 검토 → 승인 → 가져오기 → 기사 적용의 단계는 유지한다.
- ‘다른 방법으로 디자인 선택’ 안에 등록 Canva 템플릿, 콘셉트/초안, 수동·AI 제작 패턴을 각각 명확한 이름으로 둔다. **현재 결과/초안/오류가 있으면 요약에 배지와 펼치기 동작을 제공**하고 무조건 숨기지 않는다.
- 콘셉트 자산 계획은 선택한 콘셉트 아래에 유지한다. 접기만으로 새 추천·생성 요청을 보내지 않는다.

### 2) 세부 디자인 조정

- 기본 접힘: ‘글자·배경·상단 장식 조정’. 현재 패턴/배치 개수 등 기존 데이터로만 짧게 요약한다.
- 펼치면 글자 명시 저장 → 슬롯 선택/배치 자동 저장 → 배치 재사용. 위치·회전 등은 현재 고급 details 유지.
- 초안이 있으면 닫힌 summary에도 ‘텍스트 저장 필요’ 등 범위를 알린다. 닫아도 입력·선택·debounce·pending 요청은 유지한다.
- 미지원 3슬롯은 삭제하지 않는다. 편집 가능/공개·검토 미반영 사실을 슬롯 가까이에 유지한다.

### 3) 미리보기 및 확인

- 즉시 미리보기는 계속 기본 노출. 기존 xl sticky/세로 흐름/390·520/글자 크기/lightbox를 그대로 사용한다.
- 저장본 열기 버튼은 공통 workspace의 기존 한 곳을 유지한다. 하단에 같은 버튼을 복제하지 않는다. 작은 화면에서 접근성 문제가 확인되면 후속으로 기존 버튼 위치만 검토한다.
- ‘편집 설정을 즉시 표시합니다. 기사 제목·본문은 마지막 저장 기준입니다.’를 짧게 안내한다. dirty/saving/미확정 오류이면 저장본 차이 경고를 유지한다.
- 독자 표시 조건 상세는 이 확인 문맥과 연결하되 **기존 DesignSaveSummary의 단일 상세를 복제하지 않는다**. 첫 PR은 현 위치를 유지하고 설명/시각 강조만 정리한다.

### 첫 화면의 목표

현재 기사 → 저장 문제 여부 → 디자인 선택/전략 → 필요 시 조정 → 즉시/저장본 확인을 이해할 수 있어야 한다. 모든 기능을 순서대로 반드시 실행하는 마법사가 아니다. 이미 만든 디자인은 새 추천/생성 없이 바로 조정·확인할 수 있다.

## 5. 중복·통합·접기 대상과 보존할 예외

| 대상 | 조치 | 반드시 남길 것 |
| --- | --- | --- |
| ‘2. 디자인’/‘기사 디자인 조정’ 도입 반복 | 제목 계층/정적 안내 통합 | workspace의 기사 identity/탭 위치 |
| 저장된 기사 분석·자동 미적용 공통 문구 | 경로별 한 줄, 세부 설명 접기 | 추천/초안 적용/생성이 다른 행동이라는 실행 직전 설명 |
| 정상 저장 완료 강조 | 작은 중립 상태로 축소 | text/layout 각각 실제 상태, 명시 저장 버튼, aria-live |
| 오류 notice와 save error 중복 | 같은 원인일 때만 담당 범위 가까이 요약 | 서로 다른 오류를 덮거나 false success로 합치지 않음 |
| 별도 AI 패턴 추천/항상 보이는 변경 예정 | 이름 명확화 + 수동/패턴 도구 안으로 접기 | 확인/취소·미저장 차단·변경/유지 항목 |
| 두 Canva 경로 | 진입 이름 구분 + 등록 템플릿은 보조 접기 | 기존 endpoint·ID·auth·content-fit·review/import/apply 계약 |
| 생성/등록/승인/적용 결과 | 현재 해당 작업 아래 compact 상태 유지 | 성공·재사용·미확정·실패 구분, 다음 명시적 액션 |
| 자산 관리 링크/빈 상태 반복 | 설정 쪽 관리 진입 단일화 | 자산 없음/미승인/비활성/비호환을 같은 원인으로 취급하지 않음 |
| 위치·회전·레이어/개발자 payload | 현재 접힘 유지 | 값·reset·보안 정책. 내부 provenance/path를 새로 표시하지 않음 |

**통합하지 않을 버튼:** 기사 저장, 텍스트 디자인 저장, 배치 재시도, 패턴 적용, 초안 적용, Canva 제작, 검토 승인, import, 기사 적용/취소, GPT 생성/다른 시안. 이름이 비슷하다는 이유로 ‘디자인 저장’ 하나에 묶지 않는다.

## 6. 작업자 동선

| 작업자 상황 | 권고 동선 | 확인해야 할 경계 |
| --- | --- | --- |
| 처음 디자인하는 일반 작업자 | 저장 기사 열기 → 전략/자료 필요 확인 → 적합 후보 확인 → 필요한 명시 액션 → 즉시/저장본 확인 | 추천만으로 저장·생성·승인되지 않음 |
| 이미 있는 디자인을 조금 수정 | 세부 조정 펼침 → 글자 또는 배경 조정 → 범위별 저장 확인 → 저장본 확인 | text 명시 저장, 배치 자동 저장 분리 |
| 기관 사진이 필요한 기사 | 기관 자료 후보/입력 필요 확인 → 기존 자산 관리 | 실제 사진을 AI 생성으로 자동 대체하지 않음 |
| Canva 완성형 결과 | 후보 선택 → 가능 조건 확인 → 명시 제작 → 검토 → 승인 → import → 자산 승인/적용 조건 확인 | generated ≠ approved ≠ imported ≠ applied. full-layout 배경 전용 전환 금지 |
| GPT/정보그래픽 | 목적·규격 확인 → 명시 생성 → draft 자산 확인 → 기존 승인/적용 | gate/자산 등록/approval 계약 그대로 |
| 재사용 작업자 | 세부 조정 → 다른 기사 배치 재사용 → 복사/유지 범위 확인 → 적용 → 저장본 확인 | 배치만 복사, 대상 draft 전환·textDesign 유지 |
| 저장 실패/응답 미확정 | 입력 유지 → 범위별 실패 안내 → 저장본 확인 → 허용된 재시도만 | 접기를 retry로 취급하지 않고 생성 POST 반복 금지 |

## 7. 저장·오류 표시 원칙

- 정상: text/layout 각각 ‘저장 완료’를 작고 중립적으로 표시. 상태를 삭제하거나 하나의 saved boolean으로 계산하지 않는다.
- dirty: ‘텍스트 변경사항 있음 — 저장 필요’와 기존 저장 버튼을 강조. 접혀도 summary로 인지 가능해야 한다.
- saving: 해당 범위만 ‘저장 중’. 접거나 페이지를 스크롤해도 저장 완료로 바꾸지 않는다.
- error/unknown: 기존 입력 보존·명시 재시도·저장본 확인 안내를 눈에 띄게 유지. 서버 write 성공 가능성이 있는 응답 실패를 단순 실패/재실행 허용으로 바꾸지 않는다.
- ready/draft, asset approved/active, placement visible, 지원 슬롯은 저장 성공과 다른 조건이다. 기본 조건 충족을 공개 완료로 표현하지 않는다.
- 상세를 닫아도 hook의 `hasUnsaved`, `textStatus`, `layoutStatus`, 오류·retry 및 workspace 이벤트가 그대로 유지되어야 한다. 원문/자산 metadata를 새 이벤트에 넣지 않는다.

## 8. 최소 구현 PR 범위와 예상 파일

다음 **후속 구현 PR**의 예상 범위이며 이번 문서 PR의 diff가 아니다.

| 파일 | 최소 변경 | 건드리지 않을 영역 |
| --- | --- | --- |
| `src/components/design/article-composition-editor.tsx` | 세 범주 heading/정적 안내, 기존 details summary/빈 상태/관리 링크 밀도 정리 | session key, mutate/직렬화, props identity, hook 연결, placement handler |
| `src/components/design/article-production-pattern-controls.tsx` | 사용자-facing 제목, 수동/AI 패턴 상세 접기 | state/handler/recommendation 요청·확인 적용·disabled 조건 |
| `src/components/design/article-design-draft-controls.tsx` | 기존 DOM 내 콘셉트/초안 접기와 이름 정리 | Director/Top3 추출·이동, concept/spec/key/요청/적용·stale 계산 |
| `src/components/design/article-canva-templates.tsx` | 등록 템플릿 경로 이름/도입 문구 | CanvaTextAutofill 실행/승인/receipt, template 선택 상태 |
| `src/components/design/design-save-summary.tsx` | 정상/주의 상태 시각 위계·짧은 안내 | 상태 계산/hook API/오류·재시도·표시 조건 |
| `tests/article-design-ux-simplification.test.cjs`（신규 예상）, 기존 관련 UI 테스트 | heading/접힘/진입·상태 보존·문구 회귀 | 테스트를 맞추려고 실행 계약 완화 금지 |
| 이 문서 | 구현 결과/QA 증거 보완 | 역사적 문서 일괄 수정 제외 |

첫 PR은 기존 부모/자식 인스턴스를 유지하고 **native details의 열림 상태와 표현만** 조정한다. 큰 컴포넌트 분할, 탭/라우트 추가, 모든 도구를 한 번에 이동하는 작업은 제외한다. 새 wrapper로 key/React tree identity가 바뀌면 state가 초기화될 수 있으므로 실행 결과가 있는 상태에서 반드시 검증한다. 기본 접힘은 초기 표시 정책일 뿐, 실패/진행 중 UI를 숨기거나 컴포넌트를 조건부 unmount하는 근거가 아니다.

수정 금지: `use-composition-save-state.ts`, `public-mobile-article-reader.tsx`의 `ArticleCard`, `composition-mobile-preview.tsx`, 파일 mapper/renderer, server/API/provider/RPC, approval/visibility/gate. 공통 workspace 저장본 버튼/모달/event도 첫 PR에서 유지한다. 권한/상태 모델 변경이 필요하면 이 UI PR 범위 밖으로 분리한다.

## 9. 회귀 위험과 QA 계획

| 위험 | 필수 검증 / 통과 기준 |
| --- | --- |
| 접기/unmount로 초안·시안·requestKey 소실 | 입력/선택/진행 중 상세 닫기→열기: 같은 값/결과, 추가 요청 없음. 단순 rerender도 동일 |
| 새로운 부모/key로 stale 격리 약화 | 기사/project/template 변경 시 기존 정책대로 이전 초안/승인/결과 분리. 원래 article key 유지 |
| 저장 중 추가 입력 덮임 | 글자 수정→배치 응답→글자 유지; 저장 중 추가 수정/실패 후 최신 입력 retry/늦은 응답/기사 전환 회귀 |
| 정상 요약이 미저장/미확정 오류 숨김 | text와 layout 각각 dirty/saving/error, 접힌 summary/공통 header/저장본 경고 비교. 기존 retry 노출 유지 |
| 기본 접힘으로 실행 중 polling 중단/재생성 | Canva/GPT mock에서 접기 전후 동일 job/key, 추가 생성 POST 0, duplicate 재사용·unknown/failed 정책 유지 |
| 추천과 생성·승인·적용 혼동 | Top3 선택만으로 write/생성 없음. 콘셉트 prepare/apply, review/import/apply 단계를 각각 확인 |
| 미지원 슬롯을 제거/지원으로 오해 | 5슬롯 데이터/편집 유지, 공개 미지원 3개 안내 유지. 공통 reader/preview regression 그대로 |
| 접근성/반응형 | 키보드 summary/버튼 접근, focus 유지, heading 순서, 상태 aria-live, 긴 한국어/자산명. 390/768/1440에서 overflow 0·console error 0 |
| preview 계약 변형 | 390/520, 기본/크게/최대, 긴 본문/혼합/이미지 확대, local label dirty vs 저장본 label 차이 유지 |
| 화면 길이만 줄이고 작업 횟수 증가 | 초보 경로와 조정/복사/등록 Canva 경로를 각 1회 수행. 주요 기능 1~2단계 내 발견, CTA를 숨김으로써 외부 action이 자동 실행되지 않음 |

후속 구현 검증은 `composition-save-state`, `composition-preview-consistency`, `admin-article-pages`, Canva recommendation/review/import/full-layout UI, Visual Director/GPT/정보그래픽/hybrid/기관 매칭 테스트와 전체 회귀를 실행한다. TypeScript, lint, Webpack build, diff check 후 로컬 mock 브라우저 QA를 수행한다. 실제 생성/원격 write E2E는 이 UX 범위에 필요하지 않으며 별도 승인 없이 실행하지 않는다.

과거 임시 iframe 비교 페이지의 MutationObserver 오류는 원인이 확정되지 않았다. PR #225 최종 실제 Preview에서는 재현되지 않았다는 증거와 구분한다. 후속 QA에서 발생하면 메시지/stack/발생 화면을 기록하고 운영 영향 판단 전 임의 renderer 우회 수정을 하지 않는다.

## 10. 이번 문서 PR 검증과 영향

- 시작 main/origin-main 일치, worktree clean. 문서 한 파일만 추가하는지 검증한다.
- 코드 근거 경로와 문서 링크 존재, 필수 세 범주/위험/QA/제외 범위, Markdown 표/diff check 확인.
- 관련 저장·미리보기·기존 UI 회귀를 실행해 결과를 PR 본문에 기록한다. 문서만 변경하므로 TypeScript/lint/build와 브라우저는 새 구현 검증으로 주장하지 않으며, 기준 main의 PR #225 통과 기록과 구분한다.
- 이번 실행: 저장 상태·공통 preview·관리자 기사 페이지·Canva 실행 UI·hybrid 문구 회귀 **46/46 통과, fail 0 / skip 0**. 기존 코드 참조 5곳과 문서 링크 3개 존재 확인(신규 예상 테스트 파일 제외). 신규 문서 diff check 통과. 앱 코드 변경 없음으로 전체 테스트/TypeScript/lint/build/브라우저는 재실행하지 않았다.
- 기존 stash `a330dcb89d1a043b6c7430ac711b48242176fc1b`, `66e70a2e33a3f594b71716359470d69774e761b7`는 apply/pop/drop/수정 없이 원본 보존 확인.
- 데이터/Production 영향 없음. 신규 API·migration·Storage 파일·자동 승인·자동 적용·자동 발행 없음. PR은 OPEN으로 유지하며 병합하지 않는다.
