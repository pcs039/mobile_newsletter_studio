# 기관 웹용 자산 추천 → Composition 배치 연결 v1

기준 main `083d979be6ce2785ad32b685d06ef72f215150d7`. PR #240의 정보구조와 기존 저장·공개 계약을 유지한다.

## 조사 결과와 재사용 경계

- 기관 추천의 `assetId`는 `newsletter_project_design_assets.id` 그대로다. 추천용 proxy URL만 추가하며 ID 변환이나 파일/자산 복제는 없다.
- 기존 후보 선택은 확인 상태만 기록한다. 기존 Composition 선택기는 자산 클릭 즉시 `add_placement`를 저장한다. 두 동작을 변경하지 않는다.
- 새 추천 연결은 후보 선택 → 배치 위치 확인 → 위치 선택/교체 확인 → 명시적 적용이다. 기존 picker로 다시 찾아가는 조작을 줄이고 저장 시점을 분명히 한다.
- 배경판은 background/pattern, 상단 이미지·장식은 illustration/decoration을 지원한다. 제목 아이콘·본문 장식·하단 배너는 공개 미지원이므로 새 연결에서 제외한다.
- `logo`, `source_design`, `reference`, card_frame/banner/icon 및 비호환 자산을 다른 종류로 바꾸지 않는다. 로고의 원형 보존과 본문 사진/포스터 전체 표시 기능은 별도 범위다.
- 원본 AI/PSD/EPS/PDF/SVG는 design-intake-assets, 웹용 제작 자산은 design-production-assets에 별도로 등록하고 parent_source_asset_id로 연결할 수 있다. 자동 변환 엔진은 없다.

## 정책

Draft와 Approved 모두 관리자 편집 배치가 가능하다. 공개 reader는 별도로 ready 구성 + visible 배치 + approved/active 자산 + 기존 기사/프로젝트 공개 권한을 검사한다. 추천 선택·편집 적용이 자산 승인이나 발행을 수행하지 않는다.

이번 연결은 기존 추천이 제공하는 PNG/JPEG/WebP 기관 자산 중 현재 project, active, draft/approved, design-production-assets, 호환 슬롯을 만족하는 자산만 제공한다. 폐기/사용 금지 표기 자산도 제외한다. 서버 권한·소유권·활성·보관·유형/슬롯 검사는 기존 POST가 그대로 담당한다. UI helper는 서버 권한 검사의 대체가 아니다.

추천 API 자체는 변경하지 않으므로 참고자료 등의 후보도 계속 볼 수 있지만 배치 연결 버튼은 제공하지 않는다. SVG는 기존 matcher가 후보에서 제외하므로 이번 PR에서 추천 범위를 확장하지 않는다.

## 구현

- `institution-asset-placement.ts`: 공개 지원 슬롯에 대한 UI eligibility/라벨, callback 타입.
- `institution-asset-placement-confirm.tsx`: 이름/이미지/승인 상태, 위치, 기존 자산과 교체 확인, 독자 표시 조건 안내, 명시 적용 버튼.
- Match → Draft/Hybrid → Pattern → Composition의 기존 client 컴포넌트에 optional callback만 전달한다. RSC/글꼴 Context/key/저장 hook은 변경하지 않는다.
- Composition은 기존 selectAsset/add_placement와 기본 배치 설정을 호출한다. 기존 handler에 성공 receipt 반환만 추가하며 API payload/권한 의미는 동일하다.
- 새 자산 교체는 기존 single-slot row를 기존 API가 재사용한다. 다른 슬롯·기존 자산 파일은 유지한다. 기본 위치/크기/투명도 재설정 사실을 확인 UI에 표시한다.
- 동일 슬롯/동일 자산이면 새 POST 없이 현재 배치를 사용한다. 숨김 배치는 자동으로 표시하거나 초기화하지 않는다.
- 미저장/저장 중에는 새 적용을 막고, 추가 입력은 기존 hook이 보호한다. 중복 클릭은 pending ref로 막는다.
- 결과 불명/실패 시 선택을 보존하고 자동 retry하지 않는다. 새로고침으로 실제 배치를 확인한 뒤 다시 선택한다. 동일 자산이 이미 저장됐다면 재사용한다. 새로운 durable idempotency/RPC 계약을 추가하지 않는다.

## 검증과 QA

신규 회귀: Draft/Approved, 비활성/보관/다른 project/원본/로고/형식/슬롯 차단, 선택과 적용 분리, 교체 확인, 동일 자산/숨김 중복, double-click, 저장 실패 유지 및 기존 API ID/교체 row 재사용. 기존 Composition 초안·응답 순서·글꼴/RSC·공개 표시 테스트도 실행한다.

고정 Staging QA는 기존 `canva-e2e-test` 기사 1건과 명시적으로 표시한 QA 전용 Draft PNG 2개를 사용한다. 실제 기관 촬영 자료나 생성형 API를 사용하지 않는다. 승인 상태 변경 없이 기존 등록 API로 준비하며 실제 적용/교체/재진입과 390/520 preview를 검증한다. 최종 원격 결과/변경 데이터 ID와 미검증 범위는 PR 본문에 기록한다.

Production write/배포/발행/승인 변경 없음. API/RPC/reader/DB schema/migration/Storage 버킷·정책/dependency 변경 없음. PR #226/#229와 stash 2개, 이슈 #239는 보존한다. 이 PR은 병합하지 않는다.
