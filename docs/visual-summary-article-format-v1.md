# 비주얼 요약형 모바일 기사 표준 포맷 설계 v1

2026-10-15 (Asia/Seoul) · `pcs039/mobile_newsletter_studio`
기준 main: `fcc1264377b243a384fdde5aebab2c14969c7df8`
문서 브랜치: `codex/visual-summary-article-format-v1`

## 1. 권고와 범위

**B형: 비주얼 요약형 첫 화면 → 상세 기사**를 신규 opt-in 포맷으로 먼저 구현한다. 하나의 article ID 아래 두 개의 읽기 상태를 둔다. 기존 기사 레코드를 복제하거나 원문을 이미지로 대체하지 않는다. 기존 기사의 기본 렌더링을 일괄 전환하지 않는다.

‘두 화면’은 두 개의 논리적 보기이며 고정 높이의 두 페이지가 아니다. 긴 제목·공공정보·최대 글자 크기에서는 첫 화면도 세로 스크롤을 허용한다. 첫 화면에 억지로 맞추기 위한 원문 절단·중요 정보 숨김·이미지 속 텍스트 고정은 하지 않는다.

이번 결과물은 설계 문서 하나다. 코드/API/DB/Storage/Production/Staging 쓰기, migration, 외부 GPT/Canva/Adobe 생성 호출, 배포 전환 및 merge는 수행하지 않는다. PR #226은 OPEN/head `4d6a0e6f04d29456cefa080b2db69d4431101e3e`를 유지한다. 그 설계 문서는 main에 아직 없으므로 이번 브랜치에 복제·cherry-pick하지 않고 [PR #226의 문서](https://github.com/pcs039/mobile_newsletter_studio/blob/4d6a0e6f04d29456cefa080b2db69d4431101e3e/docs/article-design-ux-simplification-v1.md)를 참조한다.

## 2. 현재 모델로 가능한 것과 빠진 계약

코드/문서 읽기 기준이며 이번 작업에서 live DB 조회나 화면 E2E를 하지 않았다. JSON 칸이 있다는 사실과 실제 저장 API/공개 reader가 지원한다는 사실은 구분한다.

| 요구 | 현재 근거 / 재사용 | 부족한 부분 / 신규 개발 |
| --- | --- | --- |
| 하나의 기사 identity와 원문 | `newsletter_articles` → `ProjectContentArticle`의 id/title/summary/body/publicInfo/status, blocks/links | 표준 포맷 A/B/C와 요약/상세 상태는 없음 |
| 상세 기사 | `public-mobile-article-reader.tsx`의 `ArticleCard`: 제목/요약/본문·정보박스·quote·이미지·CTA·문의·음성 | 첫 화면과의 전환 wrapper, 돌아오기/focus/history 계약 필요 |
| HTML 핵심정보 | `article.publicInfo`, `ArticlePublicInfoCard`, `article-public-info-fields.ts` | 첫 화면 표시할 필드 allowlist와 검수 UX. 날짜/장소/금액을 AI 추론하지 않음 |
| 요약 | 기존 `article.summary`; `ArticleAiDraft.summary`를 편집 폼에 적용하는 기능 | AI 제안/사람 확정/기사 원문 summary의 별도 버전·검수 상태가 없음. 기존 summary를 자동 덮어쓰면 안 됨 |
| 디자인/배치 | article별 Composition `settings` JSON, ready/draft, 배치·textDesign·productionPattern | 신규 첫 화면 설정 namespace·validator·save action·public mapper 필요. 현재 API에 범용 설정 저장 action은 없음 |
| 기사 이미지 | 일반 image block과 기존 미디어 FK, GPT managed hero/body metadata, Design Asset source/approval/active/provenance | 대표 이미지 역할 명시와 검증된 첫 화면 DTO. 임의 첫 image를 고르는 규칙은 피함 |
| Canva 완성형 PNG | full-layout metadata + file mapper + `ArticleFullLayout` companion/HTML CTA | HTML 제목/요약을 다시 붙이면 중복. B형 기본용 텍스트 없는 이미지와 동일 취급 불가 |
| 행동 버튼 | `ProjectLinkAction` + attached block action + URL/phone/map validator | 첫 화면 표시 CTA 선택과 상세에서의 중복 처리 정책. 링크 row를 복제하지 않음 |
| 반응형/글자 확대 | 공통 text scale, reader max520, responsive image delivery/lightbox, 390/520 preview | 첫 화면 전용 작은 composition wrapper와 같은 text scale 적용 필요. 고정 래스터 글자 확대 대체 불가 |
| 공개/검토 파일 | public/admin-preview/client-review file mapper 및 자산 provenance 검사 | 새 first-screen 이미지 선택에도 같은 검사 적용, raw private path 금지 |
| URL 직접 기사 진입 | `/newsletters/[slug]?articleId=…` → `initialArticleId`; 기존 목차·검색·관심분야/기사 순서 | 현재 reader 내부 이동은 주로 React state. summary/detail URL·popstate·desktop focus까지 보장된 계약은 아님 |

### 기존 필드의 의미를 바꾸지 않을 것

- `contentPresentation`은 현재 `text | image | mixed`이며 **A/B/C가 아니다**. block metadata에서 파생되고 일반 저장에서 paragraph+image는 mixed로 정규화된다. `image`를 B형 플래그로 재해석하지 않는다.
- `showPublicTitle`, `presentation_mode=full_layout`, `managed_by` 및 source/applied snapshot은 기존 Canva/GPT 적용 계약이다. 새 요약 포맷용 값으로 덮어쓰지 않는다.
- block `asset_id`는 일반 미디어 FK다. Design Asset ID를 넣지 않는다. Design Asset은 기존 managed metadata/검증된 mapper 패턴을 따른다.
- 현재 일반 기사 저장은 block/link를 재생성할 수 있고, `normalizeContentBlocks`/`makeAtomicArticleBlocks`가 임의 metadata를 전부 보존하지 않는다. 포맷 정보를 임의 block JSON에 넣으면 편집 저장 시 유실될 수 있다.
- Composition의 ready가 원문 발행 승인·요약 검수 승인·자산 승인 전체를 의미하지 않는다. 승인 상태를 하나로 합치지 않는다.

근거: [기사 repository](../src/lib/newsletter-repository.ts), [Composition 타입](../src/lib/article-composition.ts), [Composition API](../src/app/api/project-article-composition/route.ts), [AI 초안 타입](../src/lib/article-ai-draft-types.ts), [full-layout 판별](../src/lib/article-full-layout.ts), [기존 감사](design-workflow-audit-v1.md).

## 3. A/B/C형 계약

| 유형 | 독자 경험 | 데이터 / v1 처리 |
| --- | --- | --- |
| A 비주얼 단독 | 비주얼·HTML 제목/요약·필수 공공정보·실제 CTA. 상세 버튼 없음 | 원문 보존. 이미지 실패/접근성을 위한 텍스트 대안 유지. B와 같은 첫 화면을 재사용할 수 있게 설계하되 첫 구현에서 신규 A 저장 UI는 필수 아님 |
| B 비주얼 요약 + 상세 (기본) | 첫 화면에서 핵심 파악 → 같은 기사 상세 열기 → 요약/목차 복귀 | v1 유일 신규 제작 대상. 상세는 같은 저장 article의 공통 ArticleCard. 검수된 첫 화면이 없으면 기존 기사 표시 |
| C 비주얼 요약 + 연속 콘텐츠 | 요약 다음에 여러 섹션/카드/장면 | 향후 확장. 별도 기사 row 대신 같은 article의 순서형 section 참조 검토. 지금 임의 section API/배열/renderer를 만들지 않음 |

‘B 기본’은 **향후 신규 포맷 제작의 기본 권고**다. 기존 데이터 없는 기사, 미검수 요약, 알 수 없는 mode/version/C는 기존 reader로 안전하게 fallback한다. 기존 일반 image article/Canva full-layout은 자동 A/B 변환 대상이 아니다.

## 4. 표준 화면 와이어프레임

### B형 첫 화면 — 모바일 390 기준, 최대 reader 폭 520

```text
┌─────────────────────────────────┐
│ 소식지명       목차/검색   글자 크기 │ ← 기존 소식지 shell
├─────────────────────────────────┤
│ 유형 / 기사 제목 (HTML)             │
│                                 │
│ 텍스트 없는 비주얼, 비율 유지       │ ← image 확대 가능, 간결한 alt
│                                 │
│ 사람이 확정한 핵심 요약 (HTML)      │
│ 일시 / 장소 / 신청기간 등 필요한 값 │ ← 저장된 사실 그대로
│ [상세 기사 보기]                   │ ← 내부 이동, 외부 CTA와 구분
│ [신청하기/문의 등 실제 행동]        │ ← 기존 안전한 links
├─────────────────────────────────┤
│ 이전 기사     기사 목록    다음 기사 │ ← 기존 순서/권한 유지
└─────────────────────────────────┘
```

기본은 이미지 위에 HTML 글자를 겹치기보다 분리 배치한다. Composition 배경/상단 장식은 지원 슬롯과 대비 보호 규칙을 재사용할 수 있지만, 새 무제한 캔버스를 만들지 않는다. 최대 글자에서는 높이가 늘고 CTA도 줄바꿈한다. CTA/행정정보는 clamp/ellipsis로 숨기지 않는다.

### B형 상세

```text
┌─────────────────────────────────┐
│ [요약으로]       [기사 목록]   글자 │
├─────────────────────────────────┤
│ 기존 ArticleCard                 │
│ 저장된 제목·원문 summary·공공정보  │
│ paragraph/info/quote/image…      │
│ 실제 HTML 링크·문의·부가 콘텐츠   │
├─────────────────────────────────┤
│ 이전 기사     기사 목록    다음 기사 │
└─────────────────────────────────┘
```

첫 화면의 검수 요약은 `article.summary`를 덮어쓰지 않고 첫 화면에만 사용한다. 상세에서는 원문 summary를 유지한다. 이미지/CTA가 양쪽 보기에서 다시 등장하는 것은 의도된 별도 화면 재사용이며 같은 화면에 중복 렌더하지 않는다. v1 상세에서 원본 blocks를 제거/필터링하여 이미지 중복을 억지로 없애지 않는다.

A는 같은 첫 화면에서 상세 버튼만 생략할 수 있다. C는 이후 연속 섹션 규칙을 확정하기 전 지원하지 않는다. PC에서는 같은 정보를 max520 reader 문맥에서 읽거나 기존 넓은 shell 안에 표시하며, e-book/PDF 페이지를 자동 생성하지 않는다.

## 5. 콘텐츠와 저장 설계 비교

| 의미 | 권고 저장 위치 / 계약 | 공개 노출 |
| --- | --- | --- |
| 기사 원문 | 기존 article title/summary/publicInfo/body + blocks/links | 기존 발행/권한/가시성 유지 |
| AI 요약 제안 | 기존 AI draft 응답의 summary를 재사용 가능한 입력으로 검토. 초기에는 로컬 제안 상태만 | 제안 자체 비공개, 자동 발행/자동 대체 금지 |
| 사람이 확정한 첫 화면 요약 | 신규 namespace의 confirmed copy + source digest + 명시 승인 정보 | 승인된 일치 snapshot만 첫 화면에서 표시 |
| 첫 화면 이미지 | 기존 승인·활성 자산의 검증된 참조. 첫 v1은 텍스트 없는 기존 GPT/기관 이미지 | server mapper가 허용한 파일 URL만 |
| 상세 콘텐츠 | 같은 article의 기존 blocks/links/publicInfo | 기존 ArticleCard 재사용 |
| 행동 버튼 | 기존 links/action ID의 allowlisted 참조, 행정정보를 새로 생성하지 않음 | safe URL/phone/map 규칙 유지 |
| A/B/C 표시 | 별도 format mode. 기존 text/image/mixed와 분리 | v1은 승인된 B만 활성, unknown/미지원은 legacy |

### 안 1 — Composition settings JSON 최소 확장 (권고)

기존 Composition 한 row에 이름 충돌 없는 `visualSummary` namespace를 추가하는 **후속 구현안**이다. 아래는 새 제안이며 현재 지원 API/확정 타입이 아니다.

```typescript
visualSummary: {
  version: "v1",
  mode: "B",
  confirmed: {
    text: "사람이 검수·수정한 첫 화면 요약",
    origin: "manual" | "article_summary" | "ai_suggestion",
    sourceDigest: "원문 snapshot digest",
    reviewStatus: "approved",
    reviewedBy: "서버에서 확인한 작업자 식별자",
    reviewedAt: "서버 시각"
  },
  visual: { kind: "managed_block", blockId: "같은 기사의 승인된 이미지 block ID" },
  publicInfoKeys: ["실제 기사 유형에 존재하는 허용 key"],
  actionIds: ["같은 기사에 존재하는 link ID"]
}
```

- **최소 단계는 기존 GPT hero/body 등 이미 연결된 텍스트 없는 managed image block을 선택**한다. 기관 사진은 기존 image block/미디어 소유권·승인 계약을 조사해 검증 가능한 경우에만 허용한다. 임의 Storage URL 입력은 받지 않는다. 아직 기사에 연결되지 않은 Design Asset 직접 참조는 후속 mapper 확장 대상으로 구분한다.
- Canva 사용 자체는 기존 제작/검토/승인/import/apply 절차를 유지한다. 현재 텍스트가 포함된 full-layout 결과는 `visual.kind` 후보에서 제외한다. 텍스트 없는 Canva 자산으로 검증된 종류만 향후 허용한다. asset_type을 background로 임의 변경하지 않는다.
- 초안/AI 제안은 로컬로 시작하고 명시 확정 시 confirmed를 저장한다. 영구 제안 이력/협업 수정까지 요구하면 안 2로 확대한다. 서버는 client의 reviewedBy/At/approved를 그대로 신뢰하지 않는다.
- sourceDigest는 정규화된 title/summary/publicInfo/body 및 관련 visible block/link의 ID·핵심 값·순서를 포함하고, visualSummary 자체와 임시 mapper URL은 제외한다. block 참조와 원문이 바뀌면 승인 상태 재확인이 필요하다. 임의 저장 시각 변경만으로 stale 판정하지 않도록 의미 상태 기준을 명세/테스트한다.
- 원문 변경 시 기존 자산/요약을 삭제하지 않는다. 제작자에게 재확인을 요구하고 공개 첫 화면은 숨겨 기존 상세 기사로 fallback한다. 승인된 과거 요약을 현재 사실인 것처럼 계속 노출하지 않는다.
- Composition settings 타입은 JSON을 담을 수 있으나 **현재 저장 API/reader는 이 필드를 지원하지 않는다**. 기존 endpoint에 좁은 action·validator·ownership·digest 비교를 추가하고, unknown key를 받아주는 범용 JSON write API는 만들지 않는다.
- source 검사와 설정 저장은 다른 관리자와 race가 있을 수 있다. publish/read에서도 sourceDigest를 재확인하여 stale 요약 공개를 막는다. 원문+요약 동시 transaction까지 보장해야 한다면 기존 RPC의 확장 필요성을 별도 검토하고 승인 없이 migration을 만들지 않는다.
- 공개 mapper는 confirmed text/선택 정보·안전한 image URL만 DTO로 제공한다. reviewer 식별자, AI 초안, 내부 provenance/storage path를 브라우저로 내보내지 않는다. private asset gate를 새 JSON 참조로 우회하지 않는다.

**migration 전망:** 기존 JSON 용량과 한 article 한 Composition 계약을 사용하므로 column/table migration 없이 구현할 가능성이 높다. 다만 API action/타입/mapper/클라이언트 저장 UI 개발은 필수다. 현재 raw settings 보존·copy/draft apply·기사 저장의 managed block 재생성 영향까지 확인하기 전 ‘migration 없이 완료 가능’으로 확정하지 않는다. 일반 기사 저장으로 block ID가 바뀌면 임의 재연결하지 않고 stale fallback한다.

### 안 2 — 별도 요약 revision/review 저장 구조

요약 draft/AI proposal/사람 확정본/이전 승인본을 각각 version·source snapshot·감사 이력으로 보존하는 article 하위 구조를 만든다. 원문 기사 row는 하나다.

| 비교 | 안 1 JSON | 안 2 별도 revision 구조 |
| --- | --- | --- |
| 초기 변경 | 설정 namespace + API/mapper/UI | table/권한/인덱스/API/transaction·migration 설계 |
| 검수/이력 | 현재 확정본 + 로컬 제안 중심 | 협업/제안·확정·변경 이력에 유리 |
| 동시 편집 | digest 검증+공개 fallback, lost update 방지 별도 확인 | revision/CAS 및 승인 transaction 설계 가능 |
| 권고 | B형 read-only prototype → 좁은 저장 계약 후 우선 | 감사 추적/협업 요구 확정 시 후속 승인 |

기존 `article.summary`를 ‘AI 요약’으로 재정의하거나 paragraph block에 요약을 숨겨 저장하는 안은 권고하지 않는다. 원문 의미 변경과 일반 저장 유실/상세 중복/검색 혼선을 만든다. 이번 PR은 두 안 모두 적용하지 않는다.

## 6. 첫 화면/상세 URL과 이동 계약 (신규)

권고 public URL은 기존 route/query를 확장한다.

- 첫 화면: `/newsletters/{slug}?articleId={id}&articleView=summary`
- 상세: `/newsletters/{slug}?articleId={id}&articleView=detail`
- 목록: 같은 소식지의 기존 목차 UI. `articleView`와 별개인 새 목차 URL을 이번 단계에 억지로 만들지 않는다.
- query가 없으면 승인된 B만 summary, 그 외 legacy. A는 상세 버튼 없이 summary; `detail` 직접 접근은 보존 원문을 보여 접근성/기존 링크를 차단하지 않는 방향. C/unknown/유효하지 않은 설정은 legacy.

위 `articleView`는 **현재 존재하지 않는 제안**이다. 현재 `articleId`는 mobile initial selection에 사용되지만 desktop은 목록형 카드 흐름이고 이동이 모두 URL history와 동기화되지는 않는다. 다음을 신규 구현해야 한다.

1. 첫 화면→상세는 같은 origin/slug/id의 실제 링크를 제공하고 `push`로 history 한 단계 추가. URL 직접 진입/새로고침/popstate를 같은 parser로 복원한다.
2. ‘요약으로’는 유효한 동일 article 요약 진입 history가 있으면 back, 직접 detail 진입이면 명시 summary URL로 이동한다. 무조건 `history.back()`하여 외부 사이트로 보내지 않는다.
3. 기존 목차는 current article을 표시하고 필요하면 요약으로 돌아갈 문맥을 유지한다. 다른 기사 선택/이전·다음 이동은 그 기사의 기본 view로 이동하며 새 article row를 만들지 않는다. 관심분야/긴급/기관 중요도 순서 유지.
4. summary/detail 이동 후 heading focus·스크롤 위치를 명확히 관리한다. focus용 heading은 screen reader가 접근할 수 있어야 하고 글자 확대 설정은 유지한다. swipe는 기존 기사 간 이동으로 유지하며 detail 진입으로 의미를 바꾸지 않는다.
5. desktop도 같은 URL 선택/내부 이동을 보장한다. 나머지 목록 카드를 모두 무조건 제거하는 대규모 reader 개편 대신 해당 article의 view/focus 문맥을 추가하는 범위를 먼저 검증한다.
6. admin preview는 기존 `preview=admin`/`embedded=adminPreview`를 같은 허용 환경에서만 보존한다. 임의 return URL·외부 origin을 받지 않는다. 공개 URL에 preview flag를 넣어도 기존 인증 검사가 그대로 적용된다.
7. client-review는 기존 `?project=…`와 검토 session을 유지하면서 allowlisted articleId/articleView를 추가 지원해야 한다. 현재 route는 이 필드를 처리하지 않으므로 구현 전부터 직접 접근이 된다고 주장하지 않는다. session 만료/반려/승인 상태와 파일 권한 우회 금지.
8. 기사 ID가 없거나 공개 대상이 아닌 경우 private 존재 여부/이미지를 새로 노출하지 않는다. 기존 unavailable 정책을 유지하고 잘못된 ID를 다른 기사의 상세처럼 표시하지 않는다.

analytics는 별도 검토한다. summary→detail을 서로 다른 article_view 두 건으로 중복 집계하지 않는 정책과 실제 CTA 추적을 기존 기능에 맞춰 결정한다. 이번 설계가 신규 event/schema를 요구하지는 않는다.

## 7. 제작자 동선과 PR #226 관계

1. 작성 탭에서 **기존 원문 저장**. 이 작업으로 요약 승인/발행을 자동 처리하지 않는다.
2. ‘첫 화면 요약’에서 기존 summary 가져오기 또는 현재 AI draft의 제안을 검토한다. AI 제안임을 표시하고 수정 전/후와 확인 필요 사실을 보여 준다. 비어 있거나 사실 불일치면 명시 확정 불가. 새 AI provider는 필요하지 않으며 실제 호출은 별도 사용자 액션/기존 정책을 따른다.
3. 첫 화면 이미지/디자인 제작의 하위 작업으로 PR #226의 **디자인 선택 → 세부 디자인 조정 → 미리보기 및 확인**을 사용한다. Visual Director는 제작 방식 판단, Composition은 HTML·배치, GPT/Canva는 필요할 때만 기존 명시 실행 경로다.
4. 디자인 선택에서 ‘텍스트 없는 비주얼’과 ‘글자가 포함된 완성형 Canva’를 구분한다. 현재 full-layout이 적용된 기사는 변환을 자동 수행하지 않고 기존 취소/복구 계약을 먼저 확인하도록 한다.
5. 원문 summary와 첫 화면 확정 요약을 다른 필드/상태로 표시한다. 요약 확정, 자산 승인, Composition 준비 완료, 기사 검수·발행은 각각 기존/신규 명시 액션이다.
6. 즉시 미리보기는 편집 중인 첫 화면/상세를 전환해 확인하고, 저장본은 저장된 승인/공개 조건으로 확인한다. PR #224 hook/요청 순서·초안 보호를 변경하지 않고 새 요약 state는 별도 관리한다. 새 요약 실패를 기존 textDesign 저장 완료로 표시하지 않는다.
7. 검수자는 기본/최대 글자·일시/장소·HTML 행동 링크·상세 원문을 확인한다. 승인/저장했다고 자동 발행하지 않는다. 기존 발행 절차를 따른다.

PR #226은 화면 정보구조 설계이며 새 포맷 저장/reader 로직의 선행 구현이 아니다. #226을 병합하거나 head를 바꿀 필요 없이 이 설계를 검토할 수 있다. 후속 구현 때 디자인 도구를 두 곳에 복제하지 말고 ‘첫 화면 디자인’ 문맥에서 기존 인스턴스를 재사용한다.

## 8. 공개 및 실패 처리

- 기존 project 발행 상태, article 공개/유효기간/긴급 정책, public title, review session, asset active/approved/provenance 조건을 그대로 적용한다.
- B 활성 조건: 지원 mode/version + 검수된 요약 + 일치 sourceDigest + 검증된 비주얼 + 유효한 상세 원문. 하나라도 부족하면 legacy 상세로 fallback하고 편집자에게 원인을 표시한다. broken image에서는 HTML 제목·요약·공공정보·상세/CTA가 사라지지 않아야 한다.
- Composition을 사용한 첫 화면 디자인은 ready/approved/active/visible 및 지원 슬롯 조건을 따른다. 미지원 3슬롯을 활성화하지 않는다. 초기 포맷 활성화를 자동 ready 전환으로 구현하지 않는다.
- 공개 HTML에는 확정 요약만 제공한다. AI 제안/검수자 metadata나 inactive/draft 파일이 포함되지 않아야 한다. publicInfo·CTA는 원문 참조로 검증하고 dangerous URL은 기존 helper로 차단한다.
- 원문/blocks/links/원본 이미지와 hash/provenance 보존. 요약 포맷 취소는 모드 비활성화이지 자산·원문 삭제가 아니다. 자동 full-layout revoke/자동 asset apply는 하지 않는다.

## 9. 단계별 최소 구현과 예상 파일

| 단계 | 구현/검증 범위 | 예상 파일과 제외 |
| --- | --- | --- |
| 0 현재 PR | 모델·URL·검수/QA 설계 문서 | 이 문서 한 파일. merge 금지 |
| 1 read-only prototype | B fixture, 첫 화면 공용 text scale/image/정보 helper, detail은 기존 ArticleCard, summary/detail history·focus. 실제 DB 저장/생성 없음 | 신규 `article-visual-summary.ts`/작은 첫 화면 component, reader wrapper 및 route parser 관련 테스트. 독립 상세 renderer 금지 |
| 2 저장/검수 최소 | JSON 안 1 검증 후 좁은 API action, 서버 ownership·digest 검증, 확정 요약 UI·mapper. 기존 관리된 이미지 block 한 종류부터 | Composition API/repository, 공개/admin/client-review DTO mapper, reading 디자인 영역, 새 summary 전용 상태. 기존 hook/ArticleCard 계약 변경 최소 |
| 3 제한 Staging E2E | 별도 승인된 기사 1건 snapshot→요약 확정→공개조건 preview→원복. 원문/row·파일 보존 확인 | 별도 승인 전 write 금지. Production write/migration/생성 API 필요 없음 |
| 4 A 호환·배포 준비 | 상세 없는 콘텐츠·접근성 fallback·기존 image/full-layout 회귀 | 기존 기사 일괄 migration/자동 발행 없음. C/영구 AI revision/미연결 Design Asset 지원 후속 |

주요 재사용: `ArticleCard`, `ArticlePublicInfoCard`/공공정보 필드 helper, `PublicTextSizeToggle`, responsive 이미지/lightbox, 기존 file mapper/공개 gate, Visual Director/추천/기존 생성·검토·import·apply. 새 개발: 첫 화면 모델/DTO/HTML component, 요약 검수/저장, view URL/history/focus, safe fallback 및 통합 QA. 기존 full-layout renderer의 글자 중복 억제 규칙을 새 B 전체에 적용하지 않는다.

## 10. 회귀 위험과 검증 계획

| 위험 | 필수 검증 |
| --- | --- |
| 원문 summary 덮어쓰기/본문 삭제 | 요약 작성·확정·취소 전후 원문 title/summary/publicInfo/body 및 block/link ID·값 불변. 일반 기사 저장의 ID 재생성은 별도 stale 감지 |
| AI 제안의 사실 오염 | 날짜/금액/장소 원문 대조, 제안/확정 구분, 미승인/정보 부족/stale는 공개 불가. 자동 생성/자동 발행 0 |
| JSON 보존·동시 편집 | pattern/textDesign/copy/draft 저장 뒤 visualSummary 정책 검증, 다른 settings 키 보존, source 변경 race와 public stale fallback, 다른 기사/프로젝트 차단 |
| URL/back/desktop 차이 | 요약→상세→back, detail 직접 진입→요약, reload/popstate, 목차/검색/이전다음, 관심분야 정렬, 비공개/없는 ID, preview/review flag 및 session 만료 |
| HTML/래스터 혼동 | GPT 텍스트 없는 자산·기관 image·Canva full-layout 각각 검증. full-layout B 후보 차단, 실제 HTML CTA/alt/companion 유지 |
| 접근성/레이아웃 | 390/768/1440, 기본/크게/최대, 긴 제목/요약/공공정보, 키보드 이동/focus·화면낭독 heading·이미지 실패/확대. 가로 overflow/console error 0 |
| 상세/preview 회귀 | 기존 text/image/mixed/AI hero/body/full-layout·음성·map·survey·링크. 원문 ArticleCard 비교, 즉시/저장본 차이 안내 유지 |
| 승인/gate 누락 | draft·inactive·미승인 자산·숨김 block/placement·Composition draft·발행 전·만료 article 차단. client-review/public/admin 각 실제 권한 확인 |
| analytics 중복 | summary/detail에서 기존 article_view 중복 방지 정책 확정, preview/review analytics 제외 유지. 실제 CTA 한 번 추적 |

후속 구현에서는 전체 회귀, TypeScript/lint/Webpack build/diff check 후 위 브라우저 QA를 수행한다. 활성 review session·고해상도 Canva Retina 미완료 backlog는 이 문서로 완료 처리하지 않는다. read-only prototype 결과를 원격 저장/발행 E2E로 표현하지 않는다.

## 11. 이번 문서 PR의 검증과 안전 상태

이번에는 코드·타입·호출 경로와 기존 문서를 읽고 제안/현행을 분리했다. 문서 링크/기존 코드 경로·diff 한 파일·참조 #226 head 보존과 관련 회귀 테스트를 확인하여 PR에 기록한다. 화면 코드 변경이 없으므로 신규 reader 동작·브라우저 QA·저장 성공을 주장하지 않는다.

이번 실행: Composition 저장 상태·공통 preview·기존 full-layout/file 권한·관리자 기사 페이지 회귀 **34/34 통과, fail 0 / skip 0**. 로컬 참조 링크 6개 존재 확인, 신규 문서 diff check 통과. 전체 테스트/TypeScript/lint/build/브라우저는 문서 전용 변경이므로 재실행하지 않았다. 이는 제안한 새 B형이 구현·검증됐다는 뜻이 아니다.

stash 원본: `a330dcb89d1a043b6c7430ac711b48242176fc1b`, `66e70a2e33a3f594b71716359470d69774e761b7`. apply/pop/drop 없이 보존한다. #226 브랜치·head 변경 없음. 문서 전용 새 PR을 OPEN으로 유지하고 merge하지 않는다. API/DB/Storage/Production/Staging 변경 및 외부 생성 호출 없음.
