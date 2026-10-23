# 기사 디자인 전체 재사용 — Stage A 설계

기준 main: `9997c90a80cf816d9e29d0a589c5e3bb7e7de051`. 설계·영향도 분석만 수행한다. 이 문서의 신규 계약은 제안이며 현재 구현된 API·SQL·DB 필드가 아니다. 원격 schema·데이터·Storage 설정을 실사하거나 변경하지 않았다.

## 1. 결정 요약

1. **A 배치만 복사**는 PR #253의 v1.27/v1.28 RPC와 안전장치를 그대로 유지한다.
2. **B 같은 발행호 전체 디자인 복사**는 기존 테이블을 활용할 수 있지만 기사 row의 폰트·정렬과 Composition을 함께 갱신하므로 새 전용 atomic RPC가 필요하다. 기존 기사 전체 저장 API를 연쇄 호출하지 않는다. 기본적으로 단건부터 개발한다.
3. `textDesign` 전체 JSON 복사는 금지한다. 소제목·라벨·번호에는 기사 내용이 섞여 있다. **표현 속성만 복사하고 대상 문구는 유지**한다.
4. 현재 기사별 임의 글자 크기·CSS weight/style 저장 모델은 없다. 기존 공통 크기·확대 규칙을 재사용하며, 없는 설정을 복사했다고 안내하지 않는다.
5. B의 MVP 대상은 서버에서 공개되지 않았음을 확정할 수 있는 준비 단계 프로젝트로 제한하는 안을 권장한다. **Composition draft만으로 기사 폰트·정렬의 공개 반영이 유예되지는 않는다.** 공개 프로젝트의 대상은 별도 정책 승인 전 차단한다.
6. **C 다음 발행호 재사용**은 자산 소유권·기관 식별·권한·파일 수명 계약이 필요하다. 프로젝트 ID 제한을 풀거나 타 프로젝트 자산 ID를 그대로 넣는 방식은 채택하지 않는다.

## 2. 현재 데이터·저장 계약

| 저장 위치 | 확인한 실제 필드·규칙 | 현재 복사/표시 범위 |
|---|---|---|
| `newsletter_article_compositions` | `project_id`, `article_id`(unique), `layout_key`, `status`, `settings`, `created_at`, `updated_at` | `layout_key` 허용값은 현재 `standard` 하나, status는 `draft/ready` |
| Composition `settings` | JSON object. TS는 `Record<string, ArticleCompositionJsonValue>`. 실제 제어 경로는 `textDesign`, `productionPattern` 사용 | JSON 안의 모든 키가 검증·렌더링되는 것은 아니다. 새 복사는 허용 목록만 사용 |
| `settings.textDesign` | `captionStyled`, `bodyEmphasis`, `subtitleEnabled`, `subtitle`, `numberEnabled`, `number`, `numberShape`, `labelEnabled`, `label` | validator의 9개 키 외 값 거절. 소제목 300자, 라벨 80자, 번호 1~3자리 |
| `settings.productionPattern` | `manual/event/policy/interview` | 기존 패턴 적용은 라벨 문구·captionStyled·bodyEmphasis도 바꾸므로 단순 enum 저장과 동작이 다름 |
| `newsletter_article_composition_assets` | `composition_id`, `asset_id`, `slot`, `sort_order`, `is_visible`, `settings`; row별 ID·시각 | 배치 복사는 대상 배치를 삭제하고 새 row로 재생성. 자산 ID는 공유 참조 |
| 배치 `settings` | `anchor`, `fit`, `offsetX/Y`, `opacity`, `rotation`, `scale`, `zIndex`; `renderMode`, `surfaceColor`, `borderColor`, `borderWidth/Radius`; `titleColor`, `bodyColor`, `accentColor` | 위치·크기·색상은 자산 배치에 종속. title/body 색상을 textDesign에 저장하는 계약은 없음 |
| `newsletter_articles` | `title_font_asset_id`, `body_font_asset_id`, `caption_font_asset_id`, `button_font_asset_id`; `text_alignment`, `title_alignment`, `summary_alignment`, `body_alignment` | 폰트 ID·정렬은 Composition과 별도 저장. 기존 기사 저장 RPC가 이 값들을 함께 갱신 |
| 프로젝트 기본 글꼴 | `newsletter_projects.title_font_asset_id`, `body_font_asset_id` | 제목: 기사→프로젝트. 본문: 기사→프로젝트. 캡션/버튼: 개별 ID→기사 본문 ID→프로젝트 본문 ID |
| `font_assets` / `font_families` | 파일 ID, `family_id`, weight/style 메타데이터, 웹폰트/활성 상태 등 | `font-css.ts`는 파일·패밀리 활성/웹폰트 허용·fileUrl을 검사. asset ID 선택이 기사 CSS의 weight를 직접 바꾸지는 않음 |
| 디자인 자산 | `newsletter_project_design_assets.project_id`로 프로젝트 소유. 배치 FK는 v1.26에서 `NO ACTION DEFERRABLE INITIALLY DEFERRED` | 기관 source 메타데이터가 기관 공통 권한이나 기관 소유 테이블을 뜻하지는 않음 |
| Canva 등록 템플릿 / 디자인 키트 | `newsletter_project_canva_templates.project_id`, `newsletter_project_design_kits.project_id` | 현재 둘 다 프로젝트 단위. 키트의 heading/body font family 문자열과 기사 font asset ID는 별개 |

근거: [Composition 모델](../src/lib/article-composition.ts), [textDesign validator](../src/lib/article-text-design.ts), [제작 패턴](../src/lib/article-production-pattern.ts), [v1.25](../supabase/schema_v1_25_article_compositions.sql), [v1.26](../supabase/schema_v1_26_composition_asset_delete_integrity.sql), [기사 저장 v1.38](../supabase/schema_v1_38_article_order_atomic.sql), [폰트 FK](../supabase/schema_v0_9_font_library.sql), [폰트 CSS](../src/lib/font-css.ts).

### 렌더링에서 의미하는 범위

- 즉시 미리보기는 `CompositionMobilePreview`에서 공통 `ArticleCard`와 로컬 Composition 값을 사용한다. Draft/미승인 자산도 편집용으로 표시할 수 있다.
- 저장본·public의 Composition 텍스트 디자인은 ready 구성을 조회한다. 배경·상단 이미지는 ready + visible + 같은 프로젝트 + active + approved + 허용 종류/버킷 등의 조건이 추가된다. 프로젝트·기사 공개 검사도 별도로 유지된다.
- 공개 지원 슬롯은 `hero_background`, `hero_illustration`. `title_icon`, `body_decoration`, `footer_banner`는 저장 가능하지만 공개 미지원이다. 복사가 지원 슬롯을 늘리지는 않는다.
- 제목·본문의 크기/굵기와 글자 확대는 공통 CSS 및 reader 상태다. 즉시 미리보기 제목 크기는 container 기준, reader는 viewport 기준이며 미리보기의 실제 가용 폭도 고려해야 한다. 글자 확대 설정을 디자인으로 저장하거나 복사하지 않는다.
- 글꼴 ID/정렬은 `ArticleCard`가 기사 값에서 직접 읽으므로 공개 프로젝트에서 수정하면 Composition draft와 무관하게 즉시 보일 수 있다. regular 기사는 `isArticlePubliclyVisible()`에서 article status로 배제되지 않는다. **기사 status=draft라는 이유만으로 B를 안전한 비공개 작업이라고 판정하면 안 된다.**
- `showPublicTitle`, `contentPresentation`, 개별 블록 정렬·body_design 및 모션 설정은 이 MVP에서 유지한다. 따라서 “모든 픽셀이 원본과 동일”을 보장하는 복제가 아니다.

근거: [즉시 미리보기](../src/components/design/composition-mobile-preview.tsx), [공통 reader](../src/components/public-mobile-article-reader.tsx), [공개 Composition 조회](../src/lib/article-composition-repository.ts), [CSS](../src/app/globals.css), [기사 공개 규칙](../src/lib/article-publication.ts).

## 3. A/B/C 복사 정책

| 계약 | A 배치만 복사(현재) | B 전체 디자인(권장 MVP) | C 기관 디자인·다음 발행호(후속) |
|---|---|---|---|
| 범위 | 배치 rows의 asset/slot/order/visible/settings | A + 허용된 textDesign 표현 속성 + productionPattern/layout_key + 기사 폰트 ID 4개·정렬 4개 | B의 디자인 값과 대상 프로젝트에 정당하게 등록된 자산 매핑. 기관별 기본값은 별도 계약 |
| 기사 내용 | 제목/요약/본문/블록/링크 유지 | 동일. textDesign의 소제목/번호/라벨 문자열도 대상 값 유지 | 동일. 원본 호의 날짜·문구·기관명·CTA가 넘어오지 않도록 콘텐츠 값 제외 |
| 덮어쓰기 | 대상 기존 배치 전부 교체 | 선택된 범위의 대상 설정만 교체, 알 수 없는 settings 키 및 비대상 기사 필드 유지 | 대상 프로젝트의 자산 매핑·선택 범위 확인 전 실행 금지 |
| 자산 | 같은 프로젝트의 동일 자산 ID 참조 | 같은 프로젝트, active·보관 제외·종류/슬롯·파일 형식 검증. Draft 편집 허용, 승인 경고 | 다른 프로젝트 raw ID 금지. 대상 소유 새 ID 또는 향후 명시적 기관 공유 권한 필요 |
| 폰트 | 유지 | nullable ID 4개를 그대로 적용해 동일 프로젝트 상속 재현. 유효한 전역 폰트 참조 검증 | 대상 기본값 상속 또는 유효한 명시 ID 고정 중 선택을 명시. 묵시적 원본 상속 이전 금지 |
| 독립성 | 원본 배치 변경과 연동 안 됨. 자산 파일은 공유 | 복사한 설정 값은 독립. 자산/폰트 파일·활성 상태 및 프로젝트 기본값은 공유 의존성 | 파일 복제 여부/소유권/삭제 보호에 따라 달라짐. 별도 보존 계약 전 불변성을 주장하지 않음 |
| 상태 | 대상 Composition draft; article status 유지 | 동일. 승인·ready·발행을 자동 복사하지 않음. 공개 대상은 MVP에서 차단 | 대상 자산은 별도 승인 필요. 원본 승인이 대상 승인으로 자동 이전되지 않음 |
| 원자성 | 기존 단건/일괄 atomic RPC | 기사 표현 필드 + Composition + 배치 + 결과 receipt를 하나의 DB transaction으로 | DB commit과 Storage 작업은 별개. 준비/검증/매핑 후 DB 확정 및 고아 파일 복구 필요 |
| 실패/재요청 | PR #253 결과 불명 잠금·수동 확인 유지 | 아래의 전용 requestKey/receipt 계약 필요. A로 자동 fallback 금지 | 미디어 준비 실패면 DB 적용 금지. 재시도·정리 계약 포함 |

### B의 정확한 필드 경계

- **복사:** 배치 허용 필드, `captionStyled`, `bodyEmphasis`, `numberShape`, `subtitleEnabled/numberEnabled/labelEnabled`, 검증된 `productionPattern`, `layout_key`, font ID 4개, article 정렬 4개.
- **유지:** 대상 `subtitle`, `number`, `label` 문자열. 해당 대상 문구가 없는데 원본 enabled가 true이면 렌더링상 빈 요소가 생기지 않도록 그 enabled를 false로 정규화하고 확인 화면에 안내한다. 원본 문구를 자동 채우지 않는다. 라벨 등 문구 복사 기능은 별도 범위다.
- 패턴 enum과 허용된 표현 속성을 일관된 최종 결과로 저장한다. 복사 뒤 `applyArticleProductionPattern()`을 다시 호출하면 대상 라벨이 “행사/정책/인터뷰”로 바뀔 수 있으므로 호출하지 않는다. 패턴명은 제작 방식 힌트이지 원문 덮어쓰기 명령이 아니다.
- 미지의 Composition/배치 settings를 통째로 복사하지 않는다. HTML/raw SVG, 임의 CSS·URL·provider payload를 새 설정에 넣지 않는다. 기존 validator의 enum·색상·범위를 서버에서 적용한다.
- 캡션/버튼 null은 기사 본문/프로젝트 기본값을 따른다. 동일 프로젝트에서는 4개 raw ID와 null을 함께 복사하면 기존 상속 의미가 유지된다. 출력의 **family와 실제 CSS 굵기**를 구분해 설명한다.
- current renderer가 제외하는 비활성·웹폰트 미허용·파일 미확인 참조는 전체 디자인 적용을 차단하고 유효한 선택을 요구한다. 자동 재활성화·파일 교체·임의 fallback은 하지 않는다. 기존 저장본 렌더링 정책 자체를 고치지 않는다. 이슈 #239는 별도다.
- 기사별 font-size/font-weight/font-style의 신규 필드는 만들지 않는다. “글자 크기까지 원본과 동일하게 저장”이 필수라면 별도 typography 토큰·validator·공통 renderer 설계/승인을 먼저 받아야 하며 MVP 완료로 포함하지 않는다.
- B MVP는 원본 배치 0개를 PR #253과 동일하게 차단한다. “글자 스타일만 사용하고 대상 배치를 유지”는 별도의 비삭제성 모드가 필요하므로 예외 토글로 암묵 허용하지 않는다.

## 4. 서버 계약·권한·원자성(향후 구현 제안)

신규 RPC·API의 이름/SQL 버전은 아직 확정하지 않는다. 기존 v1.27/v1.28 의미를 변경하거나 기능이 준비되기 전에 UI에 B를 노출하지 않는다.

### 준비·확인

서버가 원본/대상 project·article 권한을 검증한 뒤 복사 계획을 반환한다. 계획은 배치 수·교체 수, 슬롯·자산 승인/활성 상태, 대상 문구 유지/비활성화, font ID와 해석된 family·상속, 정렬, 패턴/layout 차이, 공개 반영 위험을 포함한다. 클라이언트가 보낸 필드 묶음을 무검증 저장하지 않는다.

제안하는 논리 입력은 모드, 원본/대상 ID, 사용자 확인, requestKey, 준비 시 원본/대상 revision이다. 이는 현재 API에 존재한다고 가정하지 않는 신규 계약이다. source/target revision은 서버의 원시 DB 값·관련 자산/폰트 상태·프로젝트 기본값을 묶어 계산한다. 화면용 `updated` 문자열 또는 기사 `updated_at` 하나만으로 배치/settings 변경을 검출했다고 간주하지 않는다.

### 트랜잭션

1. 서버 인증은 기존 `requireProjectApiAccess()` 및 프로젝트 담당 권한·프로젝트 잠금 조건을 재사용한다. DB RPC는 service_role 전용 권한과 방어적 role 검사/search_path를 갖춘다. 브라우저가 주장하는 actor·기관명만 신뢰하지 않는다.
2. 같은 프로젝트의 서로 다른 기사인지, 삭제/보관 및 공개 정책에 맞는 대상인지 검사한다. MVP는 공개 프로젝트를 배제하고 기관 검수/시연 링크의 기존 자료 변경·접근 계약을 유지한다. 승인·발행 상태 변경은 복사에 포함하지 않는다.
3. 원본·대상 기사/Composition/배치와 필요한 자산·폰트 상태를 일관되게 읽고 transaction에서 expected revision을 재검증한다. 빈 원본·stale·missing/inactive 자산·폰트·소유권 불일치는 **write 전 전체 거절**한다. B 일괄 확장 시 대상 하나라도 실패하면 전체 거절한다.
4. 기사 row UPDATE는 승인된 폰트·정렬 컬럼에만 제한한다. 기존 `save_newsletter_article_atomic`을 기사 전체 payload로 호출하면 stale 본문·블록 교체 위험이 있으므로 사용하지 않는다. `sort_order`, article status, 발행 시각·유효기간, CTA, 음성, content blocks/link row IDs를 유지한다. article `updated_at`은 표현 설정 변경으로 갱신될 수 있음을 정상 영향으로 구분한다.
5. 대상 Composition의 선택된 표현 설정과 배치를 갱신하고 draft로 둔다. 새 placement row ID는 현재 A처럼 생성 가능하되 기사·블록·링크·자산/폰트 ID는 임의 재발급하지 않는다. source는 갱신하지 않는다.
6. 결과 receipt를 같은 transaction에 기록하고 commit한다. 일부 필드만 적용된 성공을 허용하지 않는다.

잠금은 기존 copy RPC의 기사 ID 정렬 규칙을 출발점으로 한다. 구현 전 기사 저장 v1.38·기존 copy·FK trigger·프로젝트 삭제·향후 A1 trigger의 실제 잠금 순서를 함께 검토해야 한다. 정렬된 잠금만으로 모든 교착 방지가 완료됐다고 주장하지 않는다. 자산 승인/폰트 비활성 변경과 경합할 때도 유효성 검증과 commit이 모순되지 않도록 필요한 row lock/버전 검사를 설계한다.

### 중복·응답 유실

B에는 최소한의 **durable 요청 receipt**가 필요하다. 별도 대형 템플릿/관리 테이블이 아니라 actor/project/requestKey와 요청 해시, 원본·대상, 최종 결과를 식별할 서버 기록이다. 정확한 테이블·보존 기간·마이그레이션은 별도 승인 대상이다.

- 같은 key + 같은 요청은 동일 결과를 반환한다. 이미 적용된 뒤 source가 바뀌어도 완료된 receipt 재조회가 stale 판정보다 우선한다. 같은 key + 다른 대상/모드/해시는 충돌로 거절한다.
- requestKey만으로 권한을 부여하지 않는다. 기존 결과 조회에도 동일 프로젝트 접근 권한을 검사한다.
- commit 후 응답 유실은 결과 불명으로 두고 전용 결과 조회로 복구한다. record가 안 보인다고 즉시 실패로 판정하지 않는다(아직 실행 중일 수 있음). 배치/폰트가 같다는 GET 결과는 성공 증거가 아니다.
- 확인되지 않은 요청을 새 key로 자동 재시도하지 않는다. 같은 key의 명시적 재확인/재호출 허용은 서버 idempotency와 원자성 테스트가 끝난 후에만 연결한다. 업무 충돌을 PostgreSQL serialization retry 코드로 가장하지 않는다.
- A는 PR #253의 탭 단위 잠금과 [운영 복구 절차](composition-copy-safety-v1.md)를 계속 사용한다. B의 이력·복구 API가 A까지 자동 해결한다고 주장하지 않는다.

## 5. 작성자 UX

기존 `2. 디자인 → 세부 디자인 조정 → 다른 기사 디자인 불러오기`와 발행호 일괄 적용 영역을 재사용한다. 새 상위 메뉴/페이지는 추가하지 않는다.

| 선택 | 문구와 기본 동작 |
|---|---|
| 배경·이미지만 복사(기본) | 현재 A. 실제로는 모든 기존 배치 슬롯을 복사함을 상세에 표시하고 공개 미지원 슬롯을 구분 |
| 전체 디자인 복사 | 배치·글자 스타일·글꼴·정렬·제작 패턴. 소제목/라벨/번호 문구·기사 내용은 유지한다고 바로 안내 |
| 글자 디자인까지 복사 | 폰트 제외 여부가 모호해 MVP에서는 별도 제3 선택으로 만들지 않음. 필요하면 위 전체 모드의 변경 항목 상세에서 설명 |

원본 선택 → 배치/스타일/글꼴 변경 요약 확인 → 명시적 적용 → **한 번의 최종 확인** → 실행 → 저장된 디자인 미리보기 순서다. 원본 정보는 선택만으로 적용하지 않는다. 기존 UI에서 원본 선택·적용·확인 약 3회 조작에 모드 선택이 필요한 경우 1회만 추가하고, 수정/저장을 여러 화면에서 반복 요구하지 않는다.

확인 화면에는 대상 제목·배치 교체 수·변경되는 폰트/상속/정렬·draft 전환·미지원 슬롯과 대상 문구 유지 여부를 표시한다. 기존 디자인이 있으면 “현재 배치와 선택한 스타일을 교체”라고 명시한다. 범위 밖 값은 유지하며 자동 승인·발행은 없다. 문제 없는 항목마다 별도 승인 체크박스를 만들지 않는다.

원본 GET 실패·0개·stale·권한·필수 참조 오류는 적용 차단과 필요한 조치만 안내한다. 작성 내용·글꼴·Composition에 미저장/저장 중/오류가 있으면 B 진입을 차단하고 기존 저장 흐름으로 안내한다. 기사 내용을 복사와 묶어 몰래 저장하지 않는다. 대상 article snapshot 갱신은 Context/RSC 구조를 바꾸지 않고 기존 저장본 재조회/안전한 수신 방식으로 설계하며, 오래된 폼이 복사한 폰트 값을 다시 덮지 않도록 저장 baseline과 dirty 상태를 함께 갱신한다.

원격 실행·결과 불명 중에는 해당 범위의 입력을 보호하고 기사 전환·새로고침 후에도 요청을 식별한다. 390/520px 미리보기·최대 글자 크기 및 768/1440 관리자 화면에서 덮어쓰기 요약이 잘리지 않아야 한다.

## 6. 다른 발행호 C — 프로젝트 경계와 단계

현재 `newsletter_projects.organization_name`과 `issue_label`은 문자열이고, `ProjectWorkspaceInfo`도 기관명/발행호를 표시한다. 확인한 디자인 경로에는 기관 ID 기반의 공통 자산 소유권·멤버십 계약이 없다. `canAccessProject()`는 관리자 또는 프로젝트 담당자 접근을 판정한다. **기관명이 같다는 사실은 다른 프로젝트 읽기/쓰기 허가가 아니다.**

### C-초기: 프로젝트 경계를 유지하는 명시적 가져오기

- 원본/대상 두 프로젝트 접근 권한을 서버가 각각 검증한다. 대상 프로젝트에 유효하게 등록된 자산과 명시적 매핑이 준비되지 않으면 적용하지 않는다.
- 기관 제공 파일은 현행 등록 흐름으로 대상에 별도 등록하는 방식이 가능하다. 자동 교차 프로젝트 import는 아직 없다. 새 파일/asset ID/대상 소유권을 만들며 원본 승인·active를 자동 승계하지 않는다. provenance에는 원본 관계·해시 검증 정보를 안전하게 남길 계약을 별도 정의한다.
- 자동 파일 복제를 도입하면 private 접근·overwrite 금지·검증·준비 실패·DB 실패·고아 파일 정리와 원본 삭제 영향을 설계해야 한다. DB rollback이 Storage 복사를 되돌린다고 가정하지 않는다. 공용 원본 URL 또는 signed URL을 Composition 설정에 복사하지 않는다.
- 폰트 라이브러리는 현재 전역이므로 유효한 ID 자체는 재사용 가능하지만, 대상 프로젝트 기본값을 유지할지 원본의 해석된 명시 ID로 고정할지 미리 확인한다. 파일·라이선스 상태는 현행 정책을 따르며 새 라이선스 승인 시스템은 만들지 않는다.
- 같은 Canva external template ID를 대상 프로젝트에 등록하는 것은 template 등록의 재사용이다. 프로젝트별 등록 row·field mapping·실행 권한을 검증해야 하며 Composition/Canva 결과물/자산 승인을 함께 이전하는 기능으로 취급하지 않는다.

### C-기관 기반: 별도 설계가 필요한 확장

기관 식별자·프로젝트 연결·기관 자산 소유권·접근 권한·다중 발행호 참조 및 삭제 보호가 필요하다. 현행 프로젝트 자산에 global 접근을 추가하는 것보다 명시적 기관 자산 모델과 프로젝트 사용 허가를 검토하되, 이번 단계에서 테이블·bucket·policy를 정하거나 만들지 않는다.

이행 위험은 동명이인/기관명 표기 차이에 따른 잘못된 기관 병합, 기존 자산 project FK 변경, 승인 책임 이전, cross-project 파일 노출, 공유 파일 삭제·upsert, 기존 공개 화면의 URL/캐시 변경이다. 기존 프로젝트를 자동으로 기관 그룹에 편입하거나 파일을 일괄 이동하지 않는다. 백업·복구/권한·데이터 매핑을 확인한 별도 migration 계획과 Staging 승인이 선행되어야 한다.

근거: [프로젝트 기본 schema](../supabase/schema_v0_5.sql), [프로젝트 디자인 키트](../supabase/schema_v1_14_project_design_kits.sql), [디자인 자산](../supabase/schema_v1_15_project_design_assets.sql), [Canva 등록](../supabase/schema_v1_33_canva_templates.sql), [프로젝트 접근](../src/lib/project-api-access.ts), [사용자 권한](../src/lib/app-auth.ts).

## 7. 구현 순서·예상 파일·검증

| 단계 | 범위 / 예상 변경 파일 | 진입 조건 |
|---|---|---|
| 0 현재 Stage A | 이 문서만 | 코드/DB 변경 없음, 문서 PR OPEN |
| 1 B 계약·격리 DB | 신규 전체복사 validator/plan, 신규 SQL migration 및 격리 SQL/경합 테스트(파일명·버전 추후 확정) | 공개 대상 차단 정책, 문구 보존, typography 범위·request receipt 보존 기간 결정. 기존 v1.27/v1.28 변경 금지 |
| 2 B 서버·기존 UI | `article-composition-repository.ts`, 기존 Composition API 또는 별도 B endpoint(호환성 비교 후 결정), `composition-copy-safety.ts`, `composition-copy-status.tsx`, `article-composition-editor.tsx`; 폰트 baseline 연동이 필요한 기존 workspace/form 파일 | DB/API 계약 검증, PR #238 Context/RSC 구조 유지. 기본 비활성, 새로운 writer/UI 공개 전 migration·권한 준비 확인 |
| 3 QA·선별 활성화 | 단건 B부터 Staging QA. `issue-design-batch-apply.tsx`의 B 일괄 확장은 후속 | Staging 쓰기·migration 별도 승인. Production은 별도 승인. 팀원 기사 편집 중 강제 refresh/overwrite 금지 |
| 4 C-초기 | 대상 자산 준비·mapping/import 계약; 필요 시 `project-design-kit/assets/route.ts`, 파일 접근/보존 모듈 | 양쪽 프로젝트 권한·파일/DB 분리 복구·자산 승인/삭제 계약. 승인 전 구현 금지 |
| 5 C-기관 기반 / 선택형 크기 토큰 | 별도 schema·권한 또는 공통 typography renderer 설계 | 사용 수요 확인 후 별도 PR. B MVP에 끼워 넣지 않음 |

테스트 계약:

- A의 빈 원본·재조회·unknown/복구 잠금·비복사 PATCH·단건/일괄 회귀 유지.
- B의 제목/본문/블록/링크/공공정보/음성/순서/기사 상태 digest·row ID 보존; source 미변경, 대상 허용 컬럼과 Composition만 변경.
- textDesign 문구 보존, 빈 문구 enabled 정규화, 알 수 없는 키·색상·폰트·슬롯/프로젝트 불일치 차단.
- raw null 상속, 제목/본문/캡션/버튼 독립 값, 비활성·파일 누락·패밀리 비활성·이슈 #239 호환성 구분, 실제 CSS 굵기를 임의 변경하지 않음.
- 양쪽 draft/dirty/error·저장 중·기사 전환·늦은 응답·복사 후 이전 폼 저장·프로젝트 기본 폰트 동시 변경.
- 기존 공개 프로젝트의 regular draft 기사도 B 차단; 승인/ready/공개 승계 없음; 기존 검수/시연 링크의 stale 처리 유지.
- requestKey 중복·다른 payload·응답 유실·commit 후 조회 실패·in-flight/no-record·동시 copy/save/delete/approval 변경을 실제 다중 연결로 검증. 단일 연결 모의만으로 경합 검증을 대체하지 않음.
- 즉시/저장본/public의 390/520·최대 글자 크기·CTA·이미지 확대·글꼴·TTS 회귀. Draft의 preview 차이는 유지하며 공개 미지원 슬롯 확대 금지.

## 8. 독립 발행 PR과의 충돌

2026-10-23 읽기 전용으로 PR 파일 목록과 head를 확인했다. 이 브랜치에 해당 코드를 가져오지 않는다.

| PR | 보존 head | 충돌 가능성 |
|---|---|---|
| A1 #246 | `07f9818f63e14ac6da0e3da6ff08190233394f45` | SQL의 기사 삭제/소유권 보호·revision 모델과 새 B의 기사 갱신·잠금·receipt 설계가 의미상 겹침. SQL 버전과 잠금 순서 재검토 필요 |
| A2 #247 | `1e2e1683f79569a7268998df3ee08335d7b1c589` | `article-publication-snapshot.ts`, canonical/media 모듈이 고정하는 Composition·상속·폰트 표현과 B의 변경 범위 일치 필요. B는 편집본 변경이며 기존 불변 공개 revision을 수정하면 안 됨 |
| C1 #248 | `bab9dc5d2a5ba968ddc3fda43bada25816cf2d64` | 같은 호 B는 Storage 작업이 없어 직접 공통 파일 변경을 피할 수 있음. C import는 `src/app/api/project-design-kit/assets/route.ts`, `newsletter-file-storage.ts`, `supabase-config.ts`, `image-delivery-server.ts`와 충돌 가능. TTS/보존 namespace와 GC도 의미상 영향. C1을 이미 배포된 보호 기능으로 가정하지 않음 |

기존 정기호는 live 데이터 반영, 향후 독립 발행은 draft/공개 revision 분리라는 계약 차이가 있다. B가 독립 발행을 수행하거나 자동 replace해서는 안 된다. 신규 폰트/크기 토큰을 향후 추가한다면 A2 snapshot allowlist·renderer/schema version도 별도 검토해야 한다. C1의 알려진 namespace 과잉 차단 결함은 이번 설계/PR에서 수정하지 않는다.

PR #226/#229/#246–249와 원본 stash 2개를 보존한다. 설계 문서만 검증하고 코드 테스트·TypeScript·lint·build는 불필요하게 반복하지 않는다. 실제 구현·migration·remote Storage 작업·기능 활성화는 별도 승인 후 진행한다.
