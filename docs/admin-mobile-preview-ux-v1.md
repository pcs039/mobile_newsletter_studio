# 모바일 미리보기 UX v1

기준 main `3616f024f5db37c065a21fa957050ca3cb9e0cab`. 참조: `mobile-preview-issue-operations-v1.md`. PR #226/#229는 수정하지 않는다.

## 원인과 최소 변경

- 관리자 preview HTML은 미발행 프로젝트도 허용하지만 AI 음성 DTO의 기본 manifest는 공개 API였다. 공개 서비스는 published를 요구하므로 UI만 열려도 음성은404가 됐다.
- 새 GET `/api/project-article-preview/audio?project={slug}&article={id}[&segment={index}]`는 requireProjectApiAccess의 기존 로그인/담당자/프로젝트 잠금 정책을 그대로 사용한다. 내부 서비스의 이미 존재하는 authorized project 인자를 재사용한다. 요청에 project UUID/Storage path를 받아 권한으로 신뢰하지 않는다.
- manifest와 각 segment에서 매번 인증하고, 기존 findArticle(project_id,id)/findAudioById(project_id,id) 및 narration hash/voice/path 검증을 사용한다. AI 음성 레코드의 article_id가 null인 기존 샘플도 기사 ai_audio_id와 프로젝트 소유권으로 검증한다. 임의로 FK를 보정하거나 공개 API의 published 조건을 완화하지 않는다. 모든 새 응답은 private no-store/CDN no-store이고 실패 시 내부 경로나 예외를 노출하지 않는다.
- 서버에서 권한이 확인된 preview에만 AI manifest mapper를 적용한다. 즉시 Composition preview에도 동일 mapper를 사용한다. 업로드 음성의 기존 public-files 인증 fallback은 유지한다. 공개/기관 검수/시연 mapper는 변경하지 않는다.
- 음성은 저장·생성된 자료임을 안내한다. 로컬 본문/디자인 변경으로 음성을 자동 생성하지 않는다. manifest 준비 전 audio의 빈 src만 undefined로 바꿔 빈 URL fetch/React 경고를 방지한다.

## 현재 기사 편집 복귀

독립 reader는 현재 모바일 선택 ID를 사용한다. 데스크톱 연속 기사 화면에서는 보이는 article card ID를 읽어 편집 대상을 갱신한다. 기존 카드별 수정 링크는 유지한다. 기존 서버 상단의 초기 articleId 복귀 링크는 기사 reader 경로에서 중복 표시하지 않는다. 이미지 페이지 등 기존 fallback header는 보존한다.

embedded reader는 관리자에게만 current article 메시지를 보낸다. 부모 frame은 (1) event.origin=현재 origin, (2) event.source=해당 iframe.contentWindow, (3) project 일치, (4) frame/reload/초기 기사별 channel 일치, (5) 서버에서 전달한 같은 프로젝트 article ID allowlist/UUID를 모두 확인한다. 경로 문자열은 메시지에서 받지 않고 검증된 ID로 직접 구성한다. 표지에서는 편집 대상을 해제하고, reload/다른 previewHref는 이전 메시지를 재사용하지 않는다. ebook iframe은 이 article bridge를 사용하지 않는다.

parent의 ‘큰 창으로 보기’와 ‘현재 기사 편집’은 이동한 기사 ID를 반영한다. 편집은 새 창으로 열어 기존 편집기의 미저장 입력을 보존한다. 자동 이동하지 않는다. 링크 목적지의 ProjectAdminShell 및 저장 API 권한 검사는 유지한다. 일반 공개 reader는 adminPreview props를 받지 않으므로 새 편집 UI/bridge를 실행하지 않는다.

기존 stop 이벤트/unmount cleanup을 유지한다. 모바일 기사 전환은 pause/time0 및 이전 player unmount, 모달 종료/프레임 접기는 iframe 제거로 음성을 중단한다.

## 실제 QA 범위

실제 앱을 Staging Supabase `mvrkpmffuhcqwisqvpqi`만 연결한 로컬 서버로 실행했다. 고정 Staging 도메인을 새 코드로 배포한 것으로 보고하지 않는다. Production DB/Storage/migration write와 생성 API 호출은 없다.

- 기존 기사 `7ebdeffb-ccd0-454a-9771-22b102c11a81`, AI audio `838ddcb1-1403-4035-8cd2-c678736f5b51`: manifest hasAudio=true/stale=false, segment200/1,157,760bytes. 길이72.36초. 1.5배 재생 중 paused=false/currentTime15초 이상, 정지→time0. 즉시 Composition preview에서도 실제 재생 진행 확인.
- 실제 HTTP: admin manifest/segment200, anonymous401, 미담당 local QA user403, 다른/없는 기사 ID404. 미발행 public AI manifest404 유지. Staging에 다른 프로젝트 기사 fixture가 없어 실제 교차 프로젝트 샘플 E2E는 수행하지 않았고, 서비스의 project_id+article_id 조회 및 다른 프로젝트 인자 거절은 테스트로 검증했다.
- 독립390px reader: D→이전 C 이동 후 편집 href가 C로 변경되고 실제 C 편집 URL 진입. iframe도 C→D 뒤 parent href가 D로 갱신. iframe 재생 paused=false/time32초 이상, 모달 종료 후 iframe/audio0 확인.
- 업로드 샘플이 없어서 기존 AI MP3 바이트를 기존 UI로 Staging에1건 업로드했다. 자산 `858cb02a-8847-46d3-8b47-4baf9f592b0c`, path `canva-e2e-test/1792419410663-00c5156d-8ce7-424f-a89d-1cc529fe1959.mp3`. 기존 A 기사 `27fa46d7-cc52-450f-99a8-ba164dba8b19`에 일시 연결 후 음성 소스를 uploaded로 명시 저장했다. 1.25배 paused=false/time11초 이상, 정지→time0 확인.
- 검증 후 A의 source=none/audio_id=null로 복구했고 새 파일은 미연결 QA 자료로 남겼다. 파일에 실제 기사 낭독문이 아닌 재생 테스트 자료라는 검수 메모를 남겼다. 기존 AI 음성/source/reference와 기사 sort_order10/20/30/40는 유지했다. A의 정상 저장으로 updated_at와 일반 저장 계약에 따른 block ID는 바뀔 수 있으며 이를 원본 row 보존 검증으로 보고하지 않는다. 신규 기사/프로젝트는 만들지 않았다.
- 관리자 새 UI는390/768/1440에서 가로 overflow 없음. 로컬 개발 중 기존 편집기의 native details를 hydration 전에 조작한 경로에서 open 속성 차이 경고1건을 관찰했다. 변경한 preview/iframe의 production build QA 결과와 구분한다. 기존 편집기 details 전체를 리팩터링하지 않는다.

## 회귀와 배포

신규 테스트는 mapper 불변성, 관리자 manifest/segment scope·캐시·권한·입력 검증·네트워크 실패, 실제 음성 서비스의 published-only 경계, same-origin iframe listener 위조/이전 channel/기사 allowlist 차단, 공개 reader 편집 UI 미노출, player stop/unmount, 기존 review/demo session gate와 자체 URL 회귀를 포함한다. 검수/시연의 활성 세션을 새로 발급해 실제 청취하지는 않았다.

전체 테스트/TS/lint/Webpack build/diff check 및 최종 production build QA 결과는 PR에 기록한다. Production 반영은 별도 PR 승인·병합이 필요하며 DB migration/권한 정책 rollout은 필요 없다. 이번에는 merge하지 않는다.

## 최종 검증 결과

- 전체 442/442, 신규 14/14 테스트 통과. TypeScript, lint, Webpack production build, diff check 통과. lint 기존 warning 3건/신규 0건.
- Staging 전용 환경의 최종 production build를 localhost에서 실행해 390/768/1440px 모두 가로 overflow 0, 새 탭 console error/warning 0 확인. 기존 개발 모드 details 경고는 이 경로에서 재현되지 않았다.
- 최종 build AI 음성 duration 72.36초, playbackRate 1.25, paused=false/currentTime 증가 확인. 모달 C→D 이동 뒤 부모 편집 링크가 D를 가리키고 target=_blank인 것을 확인했다.
- 원격 Vercel Preview 상태는 PR 생성 뒤 확인한다. 고정 Staging 배포 및 활성 기관 검수/시연 세션의 실제 청취는 이번 검증 범위에 포함하지 않았다.
