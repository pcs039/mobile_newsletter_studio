# 디자인 제작 흐름 감사 v1

작성일: 2026-10-15 (Asia/Seoul) · 기준 repository: `pcs039/mobile_newsletter_studio`

## 1. 결론과 감사 범위

새 편집기를 만들기보다 **현재 편집 상태·저장 상태·독자에게 표시되는 범위를 일치시키는 작업**을 먼저 한다. 자산 업로드, Composition 배치, HTML 디자인, 기사 간 배치 복사, 저장본 reader는 이미 있다. 가장 큰 빈틈은 기능 수가 아니라 작업자가 “지금 보이는 디자인이 저장됐는지, 실제 독자에게도 보이는지” 판단하기 어렵다는 점이다.

- 감사 기준 `main = origin/main = f2af284a53c72c398bb1dfa9eed3b6b43790f3c9`. `git fetch origin` 후 일치 확인. 시작 working tree clean.
- 문서 브랜치: `codex/design-workflow-audit-v1`. 이번 PR은 이 문서 한 파일만 추가한다.
- stash 원본: `a330dcb89d1a043b6c7430ac711b48242176fc1b`, `66e70a2e33a3f594b71716359470d69774e761b7`. 적용·삭제·수정하지 않는다.
- 코드, migration 정의, 테스트, 기존 문서 및 GitHub PR 상태/검증 기록을 읽었다. 이번 감사에서 앱 화면 E2E나 DB 조회를 새로 수행하지 않았다. 이전 E2E 증거는 날짜/PR에 귀속하며 현재 Production의 실시간 검증으로 표현하지 않는다.
- 앱 기능 코드, DB, Storage, 환경변수, 도메인, migration 적용 변경 없음. 외부 AI/Adobe/Canva 생성 호출 없음. Production v1.38은 이전 승인 rollout 상태를 유지한다.
- 문서 작성 당시 PR #222까지 main에 병합돼 있다. Adobe 후처리 기반 PR #218은 OPEN이며 main 구현으로 집계하지 않는다.

### 판정 기준

| 등급 | 의미 | 증거 범위 |
| --- | --- | --- |
| A | 구현 및 검증 완료 | 명시한 기능 범위의 코드와 회귀 테스트 또는 기록된 E2E가 있음. 모든 환경의 현재 live 검증을 의미하지 않음 |
| B | 구현되었으나 보완 필요 | 경로는 있으나 저장·표시·운영 동선에 개선점 또는 live QA 공백이 있음 |
| C | 일부만 구현 | 편집·모델·미리보기 중 일부만 연결됐거나 핵심 목표 범위가 빠져 있음 |
| D | 미구현 | 현재 main에 해당 실행/편집 경로 없음. provider enum이나 기획 안내만으로 구현으로 보지 않음 |

## 2. 실제 제작 동선과 데이터 경계

1. `/projects/[projectId]/design`: 기관 브랜드 컬러·글꼴·로고 → 원본/참고자료 접수 → 웹 제작 자산 등록·승인 → 발행호 배치 재사용. 개별 기사 편집기는 아님.
2. `/projects/[projectId]/articles`: 기사 목록 → `/reading?articleId=…&tab=content`로 편집. PR #222에서 목록을 분리했다.
3. `/projects/[projectId]/reading?articleId=…&tab=composition`: 저장된 기사 → 디자인 조정 시작 → 제작 패턴/AI 시각 전략 → 필요한 생성·후보 검토 → 세부 배치·HTML 디자인.
4. `ArticleWorkspaceTabs`의 저장본 미리보기 → `/newsletters/[slug]?preview=admin&articleId=…` iframe. 작성 폼의 미저장 입력 전체를 전달하는 live preview가 아니다.
5. `/client-review`와 `/newsletters/[slug]`: 각 권한/공개 조건을 거친 공통 reader. Composition ready, 자산 approved/active, 배치 visible 조건에 따라 표시가 달라진다.

| 데이터 | 역할 / 재사용 시 주의 |
| --- | --- |
| `newsletter_project_design_kits` | 프로젝트 브랜드 기준. 모든 추천·자산 적용을 자동 수행하는 시스템이 아님 |
| `newsletter_project_design_assets` | 원본·참고·제작 자산과 승인/활성/출처/재사용 metadata. PNG, JPG, WebP, SVG 웹 제작 자산 등록 경로 존재 |
| `newsletter_article_compositions` / `newsletter_article_composition_assets` | article별 status/settings와 slot/asset/placement settings. HTML textDesign은 Composition settings에 저장 |
| `newsletter_articles` / content blocks / links | 기사 원문과 동작. 일반 저장 RPC는 block/link를 재생성하므로 디자인 적용 전용 RPC와 동일한 row 보존 계약이라고 간주하면 안 됨 |
| GPT/Canva managed image block | Design Asset ID를 metadata로 참조하며 `block.asset_id=null`. 일반 미디어 FK에 Design Asset ID를 넣지 않음 |

주요 근거: [design page](../src/app/projects/[projectId]/design/page.tsx), [reading page](../src/app/projects/[projectId]/reading/page.tsx), [workspace tabs](../src/components/article-workspace-tabs.tsx), [Composition 타입](../src/lib/article-composition.ts), [asset metadata](../src/lib/design-asset-metadata.ts).

## 3. 요청한 10개 기능의 완성도

| 기능 | 등급 | 현재 구현 및 실제 동작 경로 | 부족한 점 / 개선 방향 |
| --- | --- | --- | --- |
| 1. 디자인 배경 이미지 업로드·적용 | B | `ProjectDesignIntakeSection` → `/api/project-design-kit/assets` → private `design-production-assets`; 기사 `CompositionAssetPicker` → `/api/project-article-composition` → `hero_background`(background/pattern). contain/cover, opacity, offset 지원 | draft 자산도 편집 배치 가능하지만 공개에는 approved+active+visible+ready만 반영. “편집용 배치”와 “독자 표시 가능”을 구분. 완성형 Canva card_frame을 배경으로 바꾸지 않음 |
| 2. Design Asset 등록·선택·재사용 | B | 원본 연결, 유형/출처/용도 필터, 승인/보관, 단건·bulk 등록, 같은 프로젝트 슬롯 호환 선택. source/reuseScope/transparency metadata 존재 | workspace에서는 풍부한 필터가 있으나 기사 picker는 주로 목록/승인 정렬. 관리 화면으로 이동 후 같은 기사·슬롯으로 돌아오는 동선 보완. reuseScope 라벨을 cross-project 사용 권한으로 해석하지 않음 |
| 3. 이미지·아이콘·텍스트 레이어 | C | 5개 slot 편집 모델, HTML 소제목·번호·라벨·info/quote/caption 지원. 실제 공용 렌더 자산 slot은 `hero_background`, `hero_illustration` 2개 | `title_icon`, `body_decoration`, `footer_banner`는 편집·저장/일부 즉시 preview까지만 있음. 자유 텍스트 레이어 편집기는 없음. 먼저 미지원 표시, 이후 필요한 슬롯 하나씩 공용 renderer 검증 |
| 4. 위치·회전·레이어 순서 | B | `PlacementControls`: anchor, fit, offset ±200px, scale .25–3, rotation ±180°, opacity 0–1, zIndex 0–20, sortOrder. 슬라이더/숫자 조정 후 450ms debounce 및 blur 저장 | pixel 기반 배치가 다른 폭/텍스트 길이에서도 안전한지 판단 도움 부족. preview의 offset/scale 변화와 저장 실패를 구분. 자유 캔버스 드래그/리사이즈 핸들은 D이며 이번 우선순위에서 제외 |
| 5. HTML 텍스트 + 배경 | A (지원 범위) | 공통 `ArticleHeroBackgroundLayer`가 배경/상단 장식 아래, HTML을 z30/밝은 surface 위에 보호. `fluid_frame`은 본문 길이에 따라 늘어남. text colors/contrast warning 및 HTML 디자인 컴포넌트 재사용 | 지원 범위는 배경·상단 장식·기존 HTML 요소. 배경 이미지 안 글자/CTA와 HTML 중복을 자동 해결하는 기능은 아님. Canva full-layout은 별도 companion/HTML CTA 경로 유지 |
| 6. 모바일 반응형 | B | reader 폭 제한, break-words, text scale 기본/크게/최대, 유동 프레임, 360/390/430 preview preset, 좁은 관리자 shell scale-down. GPT/Canva responsive AVIF/WebP 전달 + PNG fallback | 즉시 preview는 max390이고 실 reader는 max520. 고해상도 Canva Retina live QA 미완료. 배치 pixel offset·긴 글·확대의 조합 검증 필요 |
| 7. Composition 저장·복사·재사용 | B | create/placement CRUD, ready/draft, textDesign 저장. v1.27 단건/v1.28 batch RPC는 placement를 atomic 복사하고 대상 Composition을 draft로 둠 | **배치 복사**이지 완성 디자인 전체 복제 아님. Composition-level textDesign/productionPattern은 복사하지 않음. 신규 대상 settings는 `{}`, 기존 대상 settings는 유지. UI가 복사/유지 항목과 draft 전환을 명확히 표시하도록 보완 |
| 8. 기사 편집 ↔ 디자인 편집 | B | content/composition/review 탭 + 저장된 articleId deep link. 디자인 변경은 별도 Composition API, 원문은 기사 저장 API | `/design`의 “기사 선택 후 디자인 조정” 등 링크가 여전히 articleId 없는 `/reading`으로 향함. 지금은 새 기사 화면이므로 의도와 목적지 불일치. `/articles` 경유/기사 선택 문맥 보존 권고 |
| 9. 편집 중/저장본 미리보기 | C | `CompositionMobilePreview`는 로컬 composition 설정 즉시 반영; 모달 iframe은 실제 저장본. 폼의 제목 motion preview도 별도로 존재 | 즉시 preview의 보통 본문은 360자로 잘라 표시. 일반 분기는 CTA/publicInfo 전체 계약과 다르고, fluid/text-design 분기는 아이콘·본문 장식·배너를 렌더하지 않음. 이를 최종 공개 결과로 믿으면 오판 가능 |
| 10. 공개/편집 렌더 일치 | C | public/admin iframe/client-review는 공통 reader 및 hero/textDesign helper 사용. GPT/Canva managed block file mapper도 공통 권한 검증 뒤 제공 | 별도 즉시 preview가 5슬롯 mock과 2슬롯 실 reader 사이에서 다르게 표시. draft/미승인 표시는 의도된 차이지만, 일반 image block 표현/CTA/본문 길이 차이는 별도 교정 필요. 전체 WYSIWYG 완료라고 표시하지 않음 |

세부 근거:

- 등록: [intake UI](../src/components/project-design-intake-section.tsx), [bulk import](../src/components/design/bulk-production-asset-import.tsx), [asset API](../src/app/api/project-design-kit/assets/route.ts), [write helper](../src/lib/project-design-asset-write.ts).
- 배치: [editor](../src/components/design/article-composition-editor.tsx), [picker](../src/components/design/composition-asset-picker.tsx), [Composition API](../src/app/api/project-article-composition/route.ts), [repository](../src/lib/article-composition-repository.ts).
- HTML: [hero layer](../src/components/article-hero-background-layer.tsx), [text controls](../src/components/design/article-text-design-controls.tsx), [text elements](../src/components/article-text-design-elements.tsx), [body elements](../src/components/article-body-design-elements.tsx), [colors](../src/lib/article-text-colors.ts).
- 복사: [단건 SQL](../supabase/schema_v1_27_article_composition_copy.sql), [일괄 SQL](../supabase/schema_v1_28_article_composition_batch_copy.sql), [batch UI](../src/components/design/issue-design-batch-apply.tsx).
- 화면: [즉시 preview](../src/components/design/composition-mobile-preview.tsx), [저장본 modal](../src/components/article-mobile-preview-modal.tsx), [phone shell](../src/components/admin-mobile-preview-frame.tsx), [공개 reader](../src/components/public-mobile-article-reader.tsx), [공개/admin entry](../src/app/newsletters/[slug]/page.tsx), [review mapper](../src/lib/client-review-render.ts).

## 4. 기존 고도화 기능: 재사용할 것과 제한

| 기능 | 상태 / 경계 | 근거 |
| --- | --- | --- |
| 제작 패턴·콘셉트·초안 | 기존 패턴 추천, 콘셉트 3안, 변경 예정 확인, atomic apply. 임의 콘텐츠 생성/기존 배치 교체를 피함. 초안 적용 전 시각 preview는 없고 요약 → 적용 → preview 방식 | [draft 설계/E2E](article-design-draft-v1.md), [concept 설계](article-design-concepts-v1.md), `article-production-pattern-controls.tsx`, `article-design-draft-controls.tsx` |
| Visual Director / 기관 매칭 / hybrid | 순수 규칙 판단, 실제 대상 사진 우선, 정보 부족 시 사람 확인, 대표/보조 상태 분리. 기존 추천기를 재사용할 것 | [Director](article-visual-director-v1.md), [기관 매칭](visual-director-institution-asset-matching-v1.md), [hybrid](visual-director-hybrid-orchestration-v1.md), PR #211/#215/#216/#217 |
| 정보그래픽 | steps/key_numbers/comparison/checklist/schedule, 내부 deterministic SVG, 제한 초과 확인 필요, draft 자산 등록. 자동 기사 적용 아님 | [설계](visual-director-information-graphic-v1.md), PR #213/#214 |
| GPT 생성·시안·기사 적용 | 기존 prompt/spec/variant/job/중복 방지·승인 분리. managed hero/body block apply/revoke는 Staging gate, v1.37 필요 | [품질](gpt-image-quality-rules-v1.md), [적용](ai-image-article-apply-ux-v1.md), PR #219/#220 |
| Canva registry/추천/제작 | canonical 32개, verified 30 / needs_republish 2. 추천≠실행 가능. content-fit 검증은 `event_festival_02 / EAHXxCyfpSI` 하나만. 자동 생성 금지, Staging 실행 gate | [registry](canva-template-registry-v1.md), [fit](canva-content-fit-v1.md), `canva-recommendation-execution.ts`, PR #200–#207 |
| Canva 검토→import→적용 | 생성≠검토 승인≠자산 승인≠기사 적용. approved 결과의 명시적 PNG import, 중복 재사용. full-layout은 원문 companion/실제 HTML CTA를 보존하고 hero_background로 사용하지 않음 | [import](canva-approved-design-import-v1.md), [full-layout](canva-full-layout-apply-v1.md), PR #208–#210 |
| 이미지 전송 | 권한 검사 후 기존 Next encoder로 AVIF/WebP 변환, 원본 PNG/lightbox 유지. 파생 Storage 없음. 브라우저 전송량 감소와 원본 egress 감소는 별개 | [실측 및 backlog](image-delivery-optimization-v1.md), PR #221 |
| Adobe 및 원본 자동 분리 | main의 `design-processing/provider.ts`는 operation registry이지 실행 client가 아님. 원본 접수→분리/Design DNA 안내도 실제 자동 완성 경로로 간주하지 않음. Adobe 후처리 PR #218은 OPEN, unavailable adapter 기반 | [PR #218](https://github.com/pcs039/mobile_newsletter_studio/pull/218), `project-design-intake-section.tsx` |

### 브랜치·중단/보류 사항

- Composition #162–#165, 흐름 정리 #167–#168, 복사 #169–#173, 공용 렌더 #179–#184는 MERGED. 남은 로컬/remote 브랜치가 많아 브랜치 존재만으로 미완료라고 판단하지 않았다.
- `codex/adobe-post-processing-foundation-v1` / PR #218 OPEN: entitlement, 실제 adapter, durable 실행/결과 계약 확인 전 보류. 이번 감사에서 merge/실행하지 않는다.
- `codex/adobe-illustrator-integration-poc`, `codex/design-kit-foundation` 관련 stash는 WIP가 있다는 사실만 확인. 내용을 checkout/apply하여 main 기능으로 집계하지 않았다.
- v1.36 Canva full-layout / v1.37 AI 기사 적용: PR #210/#220의 Staging 실제 apply→duplicate→revoke 기록 있음. Production migration은 별도 rollout 보류. v1.38 Production 적용이 이 두 migration의 적용을 의미하지 않음.
- v1.35 초안: 문서는 Staging 적용 증거를 제공한다. 이번 감사에서는 Production DB 함수 존재를 새로 검사하지 않았으므로 Production 동작 완료로 확대하지 않는다.
- 실제 활성 client-review 세션에서 GPT/Canva 적용 이미지 E2E는 미완료. 과거 일반 HTML/frame 검토 E2E와 구분한다.
- high-resolution Canva live QA pending: 기존 실측 Canva PNG는 397×559. 1000px 이상 원본의 Retina 글자/얇은 선/아이콘 검증 증거 없음.
- Storage→Vercel 원본 egress 및 persistent derivative/source-hash cache는 후속 검토. 새 Storage 쓰기/캐시 권한 약화로 이번 UX 범위를 넓히지 않는다.
- 기존 설계 문서의 `미적용/OPEN 유지`는 작성 당시 기록이 남아 있을 수 있다. 예: full-layout 문서와 image delivery 문서의 보류 문구. **최신 PR state 및 rollout 증거를 우선**하고, 이 감사에서 다른 문서를 임의 수정하지 않는다.

## 5. 주요 문제와 원인

| 우선 확인할 문제 | 코드에서 확인한 원인 | 작업자 영향 / 증거 한계 |
| --- | --- | --- |
| 저장 범위 혼재 | 기사 저장은 별도 폼, 배치는 자동 저장, textDesign은 로컬 변경 후 명시 저장. 모두 다른 endpoint/상태 | “저장” 한 번으로 전부 저장되는 것으로 오해 가능 |
| 미저장 textDesign 소실 가능성 | editor `onChange`가 `composition.settings.textDesign`을 수정하고 배치/status mutation 성공 시 `setComposition(result.composition)`으로 전체 교체 | 저장 전 글자 설정→배치 변경→서버 응답 순서에서 로컬 글자 값이 덮일 수 있는 **정적 코드 근거**. 이번 live 재현은 미수행; 최소 후속 회귀 대상으로 지정 |
| 저장 실패와 preview 불일치 | 배치 `onPreview`는 먼저 로컬 반영, mutate 실패는 notice만 설정하고 persisted state 복원/dirty 표시 없음 | 실패했는데 화면에는 바뀐 디자인이 남아 저장 성공으로 오인 가능 |
| 5슬롯 UI / 2슬롯 reader | repository의 `RenderedArticleHeroSlot`은 두 종류. 즉시 preview의 일반 분기만 5슬롯 표시 | 공개에 안 나오는 요소를 배치하는 시간 낭비. 안내가 접힌 세부 설정 안에 있음 |
| preview 종류가 많음 | motion preview / Composition 즉시 preview / 저장본 iframe의 입력·본문 범위가 다름 | 전체 동일 렌더로 받아들이기 어려움. 저장본을 최종 확인 경로로 명시할 필요 |
| 저장되지 않은 기사 입력 미반영 | 디자인 탭 article props는 서버의 저장 기사, 폼 state와 직접 연결되지 않음 | 기사 수정 후 저장 전 디자인을 보면 이전 제목/본문을 기준으로 추천·표시 |
| preview 배치가 긴 화면 아래로 이동 | editor는 `2xl:grid-cols-[minmax(0,1fr)_390px]`, 그 미만은 세로 흐름 | 1440/768에서는 제어와 즉시 결과를 오가야 함. 후속 실화면 사용성 측정 필요 |
| 추천 진입점 중첩 | ArticleCanvaTemplates, Director/Top3, concept/draft, 별도 AI pattern 추천/수동 패턴이 한 흐름에 공존 | 어떤 경로가 HTML 조정/새 파일 생성/전체 PNG 제작인지 선택 부담 |
| 재사용 범위 오해 | atomic copy는 placement만 교체, Composition settings를 복제하지 않음 | 배경·장식은 같지만 글자 디자인이 달라질 수 있음. 새 저장 구조보다 요약 명확화 우선 |
| 자산 승인/표시 상태 혼재 | manual picker는 active/nonarchived draft 포함, public helper는 approved+ready만 허용 | “사용 가능”이 곧 공개 가능하다는 뜻이 아님. 승인·표시 상태를 가까이 제시 |

## 6. 우선 개선할 기능 5개

| 순위 | 최소 개선 목표 | 재사용 / 성공 기준 | 예상 영향 |
| --- | --- | --- | --- |
| 1 | **디자인 저장 상태와 독자 표시 상태 안내** | 기존 편집 UI 안에 미저장/저장 중/실패 및 ready/승인/지원 slot 요약. 미저장 textDesign이 배치 응답으로 사라지지 않게 보호. 저장본 preview를 최종 확인 동선으로 연결 | client state/UI·회귀 테스트 중심. 신규 API/DB/RPC 불필요 |
| 2 | **즉시 preview 신뢰도 개선** | 우선 지원 2슬롯에서 긴 본문, HTML 정보/CTA, image block을 실 renderer와 비교. mock 영역을 전체 공개 결과처럼 표시하지 않음. 공통 컴포넌트 추출은 작은 단위로 | reader 동작 변경 없이 공용 조각 재사용 우선. 390/768/1440 및 기본/최대 글자 QA |
| 3 | **자산 선택→승인→복귀 동선** | `/design` 기사 진입을 `/articles`로 연결, 현재 기사/슬롯 문맥 보존, picker에서 승인·호환·출처 확인. 기존 관리/권한 API 그대로 사용 | route 링크·picker/UI. 자동 승인/배치 없음 |
| 4 | **추천·제작 경로의 단계적 노출** | 시각 전략 요약 → 해당 전략 후보/실행 한 경로 → 수동/고급 설정. 기존 concept/pattern/Canva 기능을 제거하지 않고 필요할 때 펼침 | UI 접힘/설명 위주. provider/gate/중복 방지 로직 유지 |
| 5 | **배치 재사용 확인 강화** | 복사되는 배치와 유지되는 텍스트·원문·draft 전환을 실행 직전 요약. batch 대상/교체 범위를 확인 | v1.27/v1.28 기존 RPC 유지. 전체 디자인 프리셋 저장소는 이번 단계에서 만들지 않음 |

새 자유 캔버스, Adobe 통합, 다른 31개 Canva template calibration, 전체 textDesign 복사 RPC 확장은 위 작업의 선행조건이 아니다. public 미지원 슬롯 활성화도 저장 상태 정리와 분리한다.

## 7. 가장 먼저 구현할 최소 작업 범위

권고 후속 작업: **기사 디자인 저장·표시 상태 정합성 v1**. 이번 감사 PR에서는 구현하지 않는다.

### 포함

1. 서버에서 확인한 Composition과 로컬 textDesign 초안을 구분한다. 배치 mutation 결과가 미저장 텍스트 초안을 지우지 않게 한다. 기사 변경 시에는 해당 기사 state를 초기화한다.
2. 항목별 저장 중/실패/미저장 상태를 표시하고, 실패한 낙관적 preview를 “저장본”으로 표시하지 않는다. 재시도는 사용자 액션으로 하며 자동 반복 write를 추가하지 않는다.
3. 텍스트 저장 성공 후 dirty 해제, 실패 시 초안 유지. pattern/draft apply는 텍스트를 함께 변경할 수 있으므로 기존 확인 UI에서 미저장 값 처리 원칙을 명시한다.
4. ready/approved/active/visible/지원 slot 상태를 기존 세부 UI 가까이에 요약한다. draft를 공개하도록 gate를 바꾸지 않는다. 미지원 3슬롯 데이터는 삭제하지 않고 공개 미반영 안내만 강화한다.
5. 현재 디자인은 편집용, 저장본 미리보기는 저장 데이터 기준임을 명시한다. 미저장 값이 있으면 저장 후 확인 안내를 제공한다. 새로운 preview renderer를 이 PR에 함께 만들지 않는다.

### 예상 변경 파일 (확정 diff 아님)

- `src/components/design/article-composition-editor.tsx`: persisted/local 구분, 요청 성공/실패 및 dirty 표시, 표시 조건 요약.
- `src/components/design/article-text-design-controls.tsx`: 미저장/저장 중/저장 실패 UX 연결.
- `src/components/design/composition-mobile-preview.tsx`: 편집용/미저장 상태 설명만 연결. 이 최소 작업에서는 renderer 재구성 제외.
- `tests/article-composition-editor-state.test.cjs` (신규 예상): 실제 컴포넌트 state 회귀.
- `docs/design-workflow-save-state-v1.md` (필요 시): 저장 범위와 검증 기록.

### 완료 기준 / 회귀 범위

- 글자 수정→배치 변경→성공 응답 뒤에도 미저장 글자 유지; 저장 클릭 후 재조회 값 일치.
- 배치/텍스트 실패 시 저장 성공 표시 금지, retry 중복 방지, 원문 불변.
- 기사 전환·탭 재렌더·pattern 적용에서 다른 기사/오래된 설정이 섞이지 않음.
- draft/미승인/hidden/미지원 slot은 공개 가능으로 표시하지 않음.
- 1440/768에서 기존 조작과 상태 설명 overflow/console error 없음; 저장본 검증은 명시적으로 저장된 fixture 사용.
- 기존 copy/batch/draft/Canva/GPT/reader 회귀 실행. 실환경 write E2E가 필요하면 별도 승인된 Staging fixture만 사용하고 원복. Production write 없음.

## 8. 데이터·Production 영향과 검증

이번 감사 PR의 변경은 문서 추가만이다. SQL, provider, UI, API, dependency, Storage, Production v1.38 변경 없음. PR을 OPEN으로 남기며 merge/Production 배포하지 않는다. GitHub PR 생성에 따른 Preview CI는 문서 diff의 통상 검사이며 Production rollout이 아니다.

권고 최소 구현도 기존 Composition endpoint/저장 계약을 유지할 수 있어 migration·새 외부 API·새 Storage 구조가 필요하지 않다. 기존 endpoint를 이용하는 사용자 저장은 이후 구현/E2E 승인 범위로 분리한다. v1.35/36/37 Production rollout이나 v1.38 변경을 끼워 넣지 않는다.

### 이번 실행 검증

- 전체 기존 회귀 테스트: **338/338 통과, fail 0, skip 0**. 아래 명령은 로컬 disposable PGlite SQL 테스트를 포함하며 원격 DB mutation/생성 API를 호출하지 않는다.

  ```sh
  CANVA_SQL_TEST_RUNTIME=/private/tmp/mns-full-layout-sql/node_modules/@electric-sql/pglite node --test tests/*.test.cjs
  ```

- TypeScript (`tsc --noEmit`) 통과. lint 오류 0, 기존 warning 3개 유지(발행 page/completion의 img 2개, health check의 미사용 인자 1개); 신규 warning 0.
- 문서 로컬 링크 40개 모두 존재 확인. 요청한 10개 기능 분류 및 한 파일 문서 diff 범위 확인, staged diff check 통과.
- 앱 코드/의존성 변경이 없는 문서 PR이므로 이번에는 Webpack build와 브라우저 E2E를 재실행하지 않았다. 기존 시각 검증 증거와 이번 338개 회귀 결과를 구분한다.
- 이번에는 read-only 코드 감사이므로 새 live 생성/적용/화면 E2E 및 Production DB 조회를 수행하지 않았다. 통과 테스트만으로 모든 시각적 일치나 미배포 함수 rollout을 완료했다고 주장하지 않는다.
- 이전 검증 근거: [PR #193](https://github.com/pcs039/mobile_newsletter_studio/pull/193) 및 draft 문서의 fluid/HTML/frame E2E; [PR #210](https://github.com/pcs039/mobile_newsletter_studio/pull/210)의 Canva Staging apply/revoke; [PR #220](https://github.com/pcs039/mobile_newsletter_studio/pull/220)의 GPT Staging apply/revoke; [PR #221](https://github.com/pcs039/mobile_newsletter_studio/pull/221)의 read-only 전송 QA. 활성 review session 및 고해상도 Canva의 남은 검증은 위 backlog에 유지한다.
