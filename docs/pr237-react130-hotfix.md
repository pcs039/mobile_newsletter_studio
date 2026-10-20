# PR #237 React #130 조사 및 최소 보정

## 원인

서버 `reading/page.tsx`는 `ArticleFontSettings` JSX를 `fontSettings` 슬롯으로 전달했다. 클라이언트 `ArticleWorkspaceTabs`는 이 값을 즉시 완성된 `ReactElement`라고 가정하고 `cloneElement`로 저장 상태와 콜백을 주입했다.

React Flight는 아직 준비되지 않은 슬롯을 `Symbol(react.lazy)` 지연 노드로 전달할 수 있다. 이 노드는 `type`/`props`를 가진 완성된 element가 아니다. `cloneElement`는 이를 해석하거나 기다리지 않고 `element.type`을 복사하여 `type: undefined` element를 만든다. React renderer가 이를 렌더링하면 “Element type is invalid … got: undefined” (클라이언트 Production React #130)가 발생한다. 일반 ReactElement를 직접 만든 기존 단위 테스트는 이 스트리밍 경계를 재현하지 못했다.

실제 배포에서 최초 로드와 작성/디자인 화면이 실패한 반면, 빠른 로컬 로드에서는 재현되지 않았다. 서버 슬롯의 준비 시점에 따른 결함이며, 오류 코드만으로 import/export나 Turbopack 결함으로 단정하지 않는다.

## 수정

- `fontSettings`를 `ReactNode`로 받고 그대로 렌더링한다.
- 클라이언트 Context로 Composition 미저장 상태, 기사 저장 중/오류, dirty/필수값 복귀 콜백을 공유한다.
- `ArticleFontSettings`의 폰트 선택, native form 연계, 기사와 함께 저장, 상속 및 독립 ID는 유지한다.
- 저장 API/DB/Storage/발행 계약, 기사 저장 gate, 기존 Composition hook은 변경하지 않는다.

## 회귀 검증

실제 Next 내장 Flight decoder에 지연 청크를 전달하는 테스트를 추가했다. 이전 clone 방식이 `type: undefined`를 만들며 실제 React 서버 renderer에서 실패함을 확인하고, 수정한 실제 workspace 트리는 지연 노드를 그대로 유지하여 렌더링됨을 검증한다. 기존 저장 중 잠금, Composition 충돌, 재시도, 늦은 응답 무효화 테스트도 유지한다.

브라우저/빌드 및 원격 검증 결과는 PR 검증 결과에 기록한다. Production은 정상 배포 `a9082eac037de7117ce0595743b3dddc34d8f244`로 롤백한 상태를 유지하며 이 보정 PR은 병합/Production 승격하지 않는다.

## 실측 결과

- 같은 로컬 Production Webpack 빌드에서 임시 서버 슬롯에 300ms 지연을 주어 원래 `cloneElement` 경로의 React #130을 브라우저에서 재현했다. 수정 후 같은 조건에서 정상 표시·새 페이지 console error/warning 0을 확인했다. 임시 QA 페이지는 최종 변경에서 제거했다.
- Next 기본 Turbopack 로컬 빌드는 CSS 처리 하위 프로세스의 포트 바인딩 `Operation not permitted`로 중단됐다(확장 실행에서도 동일). 따라서 이를 통과로 보고하지 않는다. Webpack Production 재현으로 결함이 Turbopack에만 한정되지 않음을 확인했다. 원격 기본 빌드 결과는 Vercel Preview에서 별도 확인한다.
- Staging Supabase에 연결한 로컬 Production 앱에서 기존 샘플 `canva-e2e-test / 27fa46d7-cc52-450f-99a8-ba164dba8b19`의 미저장 본문과 제목 폰트를 함께 저장·재진입 검증했다. 제목만 NanumGothic→NanumMyeongjo로 변경한 동안 본문·캡션·버튼 값은 유지됐고 저장 완료 후 미저장 안내도 해제됐다. 검사 후 본문 및 제목 폰트는 원래 값으로 저장했다. 발행·Storage 변경은 없었다.
- Composition 로컬 초안에서 글꼴 저장 버튼 비활성·선저장 안내를 확인했다. 초안은 새로고침으로 폐기했고 Composition API 저장은 하지 않았다. 실제 글꼴 preview loaded 상태도 확인했다.
- 기존 기사 작성→디자인→검수→작성 이동, 새 기사 최초 로드 정상. Chrome CSS viewport 실측 390/768/1440, 각 scrollWidth==clientWidth, console error/warning 0. 브라우저 zoom으로 인한 크기 차이를 보정하고 `innerWidth`로 검증했다.
