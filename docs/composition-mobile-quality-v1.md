# Composition 모바일 디자인 품질 보강 v1

## 조사와 재현

기준 main: `2c02a7d7d8a910fb15cf7deac9d2d3e2ef1b9d07`.

- 즉시 미리보기는 `CompositionMobilePreview`에서 공통 `ArticleCard`를 재사용한다. 저장본·public reader도 같은 카드와 hero layer를 사용한다. 초안 자산 표시와 서버 승인·visible 조건은 각각 기존 계약을 유지한다.
- `ArticleHeroBackgroundLayer`는 배경을 최대 z-index 20, 상단 장식을 21, HTML을 30으로 분리한다. 장식 이미지는 pointer-events-none이고 상단 이미지의 회전·확대는 고정 영역 안에서 잘린다. 본문 이미지 확대 버튼은 별도 영역이다.
- 이미지 모드는 제목·요약에 흰색 90% 대비판을, fluid frame은 기본 흰색 95% 대비판을 사용한다. 사용자 지정 색상·표면색 계약은 변경하지 않는다. 임의의 사용자 색상 조합에 대한 대비 보장은 이번 검증에 포함하지 않는다.
- 제목·부제·본문은 기존 overflow-wrap, 자연 높이 및 공통 글자 확대 규칙을 사용한다. 긴 텍스트를 새로 축약하거나 높이를 고정할 근거는 발견하지 못했다.
- 즉시 미리보기의 제목 크기는 container query, 공개 reader는 viewport 기준이다. 미리보기는 작업창 가용 폭에 맞추므로 520px 선택 시 실제 폭이 더 작을 수 있다. 이 기존 동작은 유지한다.

### 확인한 결함

공공정보 카드에 결합된 긴 신청 CTA에는 `shrink-0`만 있고 최대 폭이 없었다. 로컬 합성 기사에서 fluid frame 내부 부모 폭 약 239px에 버튼 약 1,159px이 표시되어 가로 스크롤이 발생했다. 일반 배경·무배경에서도 같은 결함이 재현됐다. 이는 장식의 클릭 가림 문제가 아니라 버튼의 intrinsic/flex 폭 문제였다.

## 최소 수정

`public-mobile-article-reader.tsx`의 공공정보 primary CTA 한 곳에만 `min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]`를 추가한다. 라벨 span도 최소 폭을 해제하고 화살표는 축소하지 않는다.

전역 CSS, 배경·레이어·색상·위치·회전·불투명도 컨트롤, API, 저장 상태 hook, Composition·폰트·발행·권한 계약에는 변경이 없다. C1의 Storage·이미지 전달 모듈을 사용하거나 수정하지 않는다.

## 검증 범위

- 로컬 실제 ArticleCard SSR + Webpack 산출 CSS를 사용한 브라우저 fixture: 390/520px, PC에서 최대 520px reader, 기본/최대 글자 크기, 긴 제목·요약·본문·신청 CTA, 배경/상단 장식/본문 이미지 및 무배경 비교.
- 새 회귀 테스트: 긴 CTA·원문·URL 보존, 공공정보로 결합된 CTA 중복 없음, 배경 레이어/pointer 계약, 세 모드에서 줄바꿈 클래스 및 아이콘 보호.
- 기존 preview/reader 마크업 동등성, Composition 저장·폰트·이미지·CTA 회귀는 전체 자동화 테스트로 확인한다.
- 합성 SSR fixture는 실제 앱의 hydration·저장·lightbox 클릭 E2E를 대체하지 않는다. 원격 인증 화면을 확인하지 못한 경우 별도로 미검증으로 보고한다. 실제 기사·프로젝트·자산·Storage 변경 및 생성 API 호출은 하지 않는다.

## 남은 범위

실제 기관 배경 이미지별 색상 대비·최종 미감, 임의의 사용자 색 조합, 원격 쓰기 및 저장 후 재진입 E2E는 완료로 주장하지 않는다. 긴 CTA는 전부 표시하므로 매우 긴 문구는 버튼 높이가 커진다. 콘텐츠를 자동 축약하지 않으며 작업자가 문구를 정리할 수 있다.
