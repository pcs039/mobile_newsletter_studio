# 기사 글꼴 설정 위치 개선 v1

## 기존 구조와 이동

- 글꼴 ID는 Composition 설정이 아닌 기사 `title/body/caption/button_font_asset_id`에 저장된다. 기존 `/api/project-content`는 기사 내용·블록·폰트를 함께 저장한다.
- `ArticleWorkspaceTabs`는 작성/디자인/검수 패널을 hidden으로 유지하여 탭 이동 시 작성 초안과 Composition hook을 보존한다.
- 디자인 패널의 앞부분에 `ArticleFontSettings`를 배치한다. 네 가지 현재 선택값은 항상 표시하고 각 `변경` disclosure를 열 때만 기존 검색 목록·실제 폰트 미리보기를 표시한다.
- PR #226 문서의 progressive disclosure 원칙을 참고했다. 해당 PR/브랜치와 Composition 편집 기능은 변경하지 않는다.

## 단일 입력·저장 소유권

- 기사 폼에 안정적인 `article-editor-<articleId>` ID를 부여한다. 디자인 패널의 네 hidden font input은 HTML `form` 속성으로 해당 폼과 연결한다. 같은 이름의 입력을 작성 패널에 복제하지 않는다.
- 기존 폼의 `new FormData(form)`에 외부 연결 입력이 포함된다. 디자인 카드의 저장 버튼은 기존 폼의 유효성을 확인하고 `requestSubmit()`만 호출한다. 새로운 저장 API·부분 update·DB 구조를 만들지 않는다.
- 저장 범위는 **작성 내용과 글꼴 함께 저장**이라고 명시한다. 작성 탭의 미저장 본문도 동일 요청에 포함된다. 제목이 없거나 native validity가 실패하면 요청하지 않고 작성 탭으로 돌아간다.
- Composition 미저장/저장 중/미확정 상태는 기존 `article-design-save-state` 신호를 사용한다. 이 상태에서는 글꼴 저장 버튼을 막아 기사 저장 후 갱신으로 Composition 초안을 잃지 않게 한다. Composition은 자신의 기존 저장 버튼으로 저장한다.
- 기사 폼은 `article-editor-save-state`로 articleId/saving/error만 알린다. 다른 기사 이벤트는 무시한다. 저장 중에는 글꼴 입력을 비활성화하고 실패 시 선택값과 오류를 보존한다. 이 이벤트는 UI 안내용이며 권한 검증 수단이 아니다.
- workspace의 저장본 미리보기 주의 안내에 글꼴 dirty/saving도 포함한다. 작성 탭의 기존 기사 저장 버튼·payload·API·검증·발행 계약은 그대로다.

## 값·상속 및 기존 기능

- 새 패밀리 선택은 기존 PR #236 대표 파일 ID 계약 그대로다. 저장된 개별 Bold/비활성/누락 ID를 검색·접기·탭 이동만으로 바꾸지 않는다.
- 프로젝트 기본 제목/본문 폰트와 캡션/버튼의 본문 폰트 상속을 유지한다. 캡션/버튼의 샘플은 편집 중 선택한 본문 글꼴도 따른다.
- 굵기별 저장 모델을 추가하지 않는다. 실제 weight/style은 기존 CSS가 결정한다.
- 작성 고급 설정에서 폰트 입력만 제거하고 제목/요약/본문 정렬 등은 유지한다.
- 새 기사는 먼저 작성·저장한 뒤 디자인 단계에서 폰트를 고른다. 기사별 key 및 native details의 마운트 유지로 기사 간 초안이 섞이지 않도록 한다.

## 검증

- 신규 6개 테스트 + 기존 관련 회귀(입력 소유권 이동에 맞춘 배선 테스트 갱신). 전체 486/486, TypeScript/lint/Webpack build/diff check. lint 기존 warning 3개, 신규 0개.
- 로컬 PR 코드 + Staging 연결로 기존 기사 `27fa46d7-cc52-450f-99a8-ba164dba8b19`를 사용했다. 작성→디자인→작성 이동, 네 named input이 기존 폼에 각각 한 번 연결됨을 실제 DOM에서 확인했다.
- 작성 중 임시 문장과 제목 폰트를 디자인 저장 버튼으로 함께 저장해 DB 확인 후, 다음 저장에서 임시 본문을 원복했다. 본문/캡션/행동 버튼의 독립 변경과 버튼의 본문 상속도 저장·재진입 확인했다.
- 최종 샘플 글꼴: 제목 NanumGothic / 본문 NanumMyeongjo, 캡션 NanumGothic, 행동 버튼은 본문 상속. 원래 본문·다른 기사·프로젝트 상태는 유지했다.
- Composition 소제목 로컬 초안이 있을 때 글꼴 저장 disabled 및 안내 확인. 해당 Composition 초안은 저장하지 않고 reload로 폐기했다.
- 제목 누락 시 API 저장 없이 작성 탭 복귀 확인. 실패 보존/다른 기사 이벤트 차단은 자동화 테스트로 검증했다.
- 390/768/1440px overflow 0. 실제 저장본 iframe의 NanumMyeongjo CSS family 및 최대 글자 크기 확인. 공개 reader와 font-css 구현은 변경하지 않는다.
- Staging은 비공개 상태를 유지했다. 익명 공개 발행 화면을 새로 발행해 재검증하지 않았다.
- 개발 중 key 경고를 수정했다. Hot reload 중 일시적인 렌더 오류가 한 번 기록됐으나, Staging 전용 Webpack 빌드의 cold-load·재진입에서 정상 렌더링 및 console error/warning 0을 확인했다. 빌드 기반 390/768/1440px에서도 overflow 0이다.

## 안전 범위

Production 접근·DB/Storage write·migration·새 API·dependency·폰트 등록·외부 생성 API 호출 없음. Staging의 기사 저장만 기존 경로로 수행했으며 발행·승인·Composition 적용 계약은 변경하지 않았다. PR은 OPEN으로 유지하고 병합하지 않는다.

## PR 최종 QA 보정

- 같은 tick의 중복 제출을 동기 ticket으로 차단한다. article form unmount 때 세대를 무효화해 이전 요청의 늦은 응답이 저장 확인 상태나 router 이동을 실행하지 않게 했다. 효과 setup/cleanup/setup 후에도 이전 요청이 새 요청의 잠금을 해제할 수 없다.
- 저장 중 workspace의 작성·디자인·검수 입력과 탭 전환을 잠근다. 기존 기사 저장 API, Composition queue, 서버 권한 검사는 그대로다.
- 보정 회귀 4개를 추가했다. 전체 486/486, TS/lint/Webpack/diff check 통과. 신규 warning 0.
- Staging 전용 빌드 + 로컬 QA 프록시에서 첫 저장을 DB 전달 전 503 처리했다. 본문 초안/글꼴 보존 후 최신 입력으로 명시 재시도했다. 더블클릭 포함 집계 2 POST 중 1건만 DB 전달(나머지 1건은 의도한 실패).
- 이어 응답을 5초 지연한 별도 저장 중 기사 목록→다른 기사로 SPA 이동했다. 늦은 응답 뒤에도 다른 기사 및 그 로컬 초안이 유지됐다. 전체 집계 3 POST / 2 DB 전달 / 1 의도한 실패. 테스트 임시 문장은 DB에 남지 않았다.
- 정상 저장 뒤 미저장 경고 해제, 다른 기사 ID/상속 격리, 실제 저장본 폰트·최대 글자 크기, 정상 세션 390/768/1440 overflow 0 및 console error/warning 0 확인. 의도한 503 실패의 브라우저 네트워크 오류는 정상 세션 결과와 구분했다.
- Composition 미저장 상태 차단은 실제 UI로 검증했고 저장 중/실패·미확정 상태는 기존 hook의 hasUnsaved/isBusy와 workspace 회귀 테스트로 검증했다. 실제 Composition API 실패를 만들지는 않았다.
