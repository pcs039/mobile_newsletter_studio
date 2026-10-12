# Canva Template Registry v1

`src/lib/canva-template-registry.ts`가 제공된 8계열 × 4종 Brand Template ID의 canonical 목록이다.
id는 `family_01`~`family_04`, displayName은 계열명과 번호다. 변형별 실제 시각적 특성은 추정하지 않는다.
recommendedFor는 계열의 용도 설명이며, priority 1~4는 제공된 번호 순서다. 성능·품질 순위 또는 자동 선택 규칙이 아니다.

## 기존 구조와의 관계

- 기존 `canva-template.ts` / `canva-template-repository.ts`는 프로젝트별 등록, 필드 매핑, 권한 경계를 계속 담당한다.
- canonical 항목은 DB row가 아니며 project access, OAuth, 실행 권한을 부여하지 않는다. 프로젝트에 자동 등록하지 않는다.
- 8개 family와 articleType/productionPattern은 별개다. 콘셉트·초안·renderer 로직 및 기존 enum을 변경하지 않는다.
- 기존 Canva template type/field 이름 타입을 참조한다. 신규 저장 계약·API·UI·migration·dependency는 없다.

## 필드 계약

사용자가 Canva에서 직접 조회해 제공한 30개 검증 dataset을 원문 필드명과 순서 그대로 기록한다.
text 필드는 `requiredFields`, image 필드는 `imageFields`이며 `datasetStatus: "verified"`다.
여기서 requiredFields는 text 타입 필드 목록을 뜻하며 API가 별도로 필수 입력 여부를 보장한다는 의미는 아니다.

다음 두 개만 dataset이 비어 있어 `datasetStatus: "needs_republish"`, 두 필드 목록은 null이다.

- culture_tourism_01 / EAHXx2-zSJU
- cardnews_02 / EAHXyPsE0cs

`EAHXyJwJhts`는 검증된 이미지 필드 없음(`imageFields: []`)이며 null과 구별한다.
`EAHXyDK6GeM`에는 KPI_3_UNIT을 추가하지 않는다. 기존 행사 E2E 필드명을 복제하거나 임의 표준화하지 않는다.
검증 자료의 독립 사본은 `tests/fixtures/canva-template-datasets.json`에 보관한다.
이번 작업에서는 Canva API 조회·Autofill 실행·DB write가 없다.

후속 실행 연결 시에는 기존 admin/same-project/Staging gate와 실제 dataset/type 검증을 그대로 거쳐야 한다.
canonical ID만으로 실행 가능하다고 판단하면 안 된다.

## 검증

`node --test tests/canva-template-registry.test.cjs`: 32개 ID 정확 일치, 계열/번호/순서, unique id/external ID,
verified 30개/needs_republish 2개, 제공 dataset과 text/image 필드 정확 일치, 빈 이미지 목록,
KPI_3_UNIT 제외, 불변 목록 및 exact lookup을 확인한다.
