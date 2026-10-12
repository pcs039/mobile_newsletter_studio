# Article Design Template Recommendation v1

`recommendArticleDesignTemplates(article, concept?)`는 canonical registry의 verified 항목에서 Top 3를 반환하는 순수 함수다.
기존 기사 모델과 콘셉트 타입을 사용하며 콘셉트·초안·UI·renderer·Autofill 실행 코드는 변경하지 않는다.
Canva/LLM API, DB/Storage, migration, dependency 추가 없음.

## 입력과 점수

기존 `buildPatternRecommendationInput`의 길이 제한 및 저장된 visible paragraph 선택을 재사용한다.
구조화된 공공정보는 기존 `getArticlePublicInfoEntries`의 허용 필드만 읽는다. 이미지·링크·비공개 metadata는 읽지 않는다.
키워드 반복 횟수는 점수에 영향을 주지 않는다.

1. family: 독립 신호 그룹 두 개 이상과 핵심 주제 신호가 필요하다. 같은 키워드가 여러 정규식에 중복 매칭되는 경우도 단독 근거로 쓰지 않는다. 공공정보가 있으면 보조 근거로 사용한다.
2. variant: 금액/절차/공연/전시/공모/프로필/비교/추이/Q&A/체크리스트/대화 등 요청된 방향을 명시적 규칙으로 가중한다.

최종 score는 family 점수 × 100 + variant 점수다. 확률 또는 모델 confidence가 아니다.
동점은 registry priority, canonical id 순으로 처리하여 동일 입력에 동일 결과를 보장한다.
기존 concept의 policy/event/interview pattern은 이미 콘텐츠 근거가 있는 해당 family에만 작은 보너스를 준다. concept만으로 분류하지 않는다.
variant는 요청된 역할 기준의 초기 휴리스틱이며 자동 선택/적용하지 않는다.

needs_republish 항목은 모든 점수 계산 결과와 무관하게 후보에서 제외한다.
근거가 없는 일반/빈 기사에는 verified 카드뉴스 01/03/04를 score 0과 명시적 확인 안내로 반환한다.
이는 일반 기사에 특정 계열이 확실히 맞는다는 의미가 아니다.

## 출력

templateId / canvaBrandTemplateId / family / variant / displayName / rank / score / reason.
필드 매핑이나 자산 ID, Storage path, OAuth 정보, 기사 본문은 결과에 포함하지 않는다.
추천은 registry 조회 결과이며 실제 Canva 실행 가능 여부나 project 권한을 대신하지 않는다.
