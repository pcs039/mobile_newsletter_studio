# 혼합 시각 구성 UX 문구 정리 v1

기존 AI 시각 전략 카드 안의 혼합 시각 구성 안내·상태·버튼 문구만 정리한다.

- 대표 시각 요소는 기사의 중심 시각 자료, 보조 시각 요소는 기사 이해를 돕는 추가 자료로 설명한다.
- 실제 인물·시설·행사 현장은 기관 사진을 우선하며, 사진이 없으면 자료 입력이 필요하다. AI 이미지가 실제 대상 사진을 자동 대체하지 않는다.
- Canva는 작업자가 별도로 확인할 추천 후보다. `Canva 후보 확인`은 제작·승인·기사 적용을 실행하지 않는다.
- 기사 내용이나 추천 조건 변경 시 `현재 내용으로 다시 확인`을 안내한다. 기존 생성 자산은 삭제하지 않고 이전 결과로 유지한다.
- 보조 시각 요소 준비 실패와 대표 결과 유지를 구분한다.
- 준비 완료와 승인·기사 적용 완료를 구분하고, 검토 후 별도 적용을 안내한다.

## 변경 범위

`HybridVisualControls`의 UI 문구와 설명만 변경했다. 기존 조건 분기, 상태 전이, 실행 순서, 생성·선택·승인·적용 정책, provider, API, DB schema, migration, dependency, renderer는 변경하지 않았다.

## 검증

- 실제 컴포넌트 렌더링/핸들러 테스트 5개 추가. 관련 문구·기존 혼합 구성 테스트 24/24 통과.
- 전체 Node 테스트: 273개 중 272개 통과, 1개 skip. 실제 PostgreSQL RPC 통합 테스트는 전용 DB 환경이 없어 실행하지 않았다.
- TypeScript, lint, Webpack production build, diff check 통과.
- 기존 lint warning 3개 유지(기존 img 2개 및 미사용 buttonLabel 1개), 신규 warning 0.
- 실제 React 컴포넌트를 로컬 fixture 서버에서 1440/768px로 확인. 역할 안내, Canva 후보, 기사 변경 재확인, 보조 실패 및 대표 결과 유지 확인. 가로 overflow 및 console error 0.
- 로컬 fixture 응답만 사용했다. 외부 GPT/Canva 호출과 DB/Storage write는 없으며 Production에는 접근·쓰기하지 않았다.
