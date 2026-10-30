# 발행 버전별 콘텐츠 사전 준비 — 테스트 계획 v1.0

- 기준: 2026-10-30, PR #289 / Staging `51537b51176b9427368c6705a2cf4549872fe5eb`.
- 1~8절은 **향후 구현의 검증 계획**이다. 문서 작성만으로 테스트를 통과시켰다는 뜻이 아니다. 후속 R0.5에서 실제 수행한 읽기 전용/로컬 검증은 9절에 별도로 기록한다.
- 계약: [아키텍처](publication-prepared-content-architecture-v1.md), 단계·승인: [rollout](publication-prepared-content-rollout-v1.md).

## 1. 환경과 불변 기준값

1. SQL/RPC는 승인 후 격리 PostgreSQL의 fixture로 먼저 검증한다. 실제 설치 버전·필수 컬럼·권한·함수 및 snapshot/hash 구현의 호환성을 확인한다.
2. Staging 시범 DB는 `mvrkpmffuhcqwisqvpqi`, 고정 도메인은 `canva-staging.datadiction.co.kr`다. Production `qmhvlbpedudpwtznletj`와 main은 대상이 아니다. 문자열 guard뿐 아니라 실제 접속 신원·환경·배포 SHA를 확인한다.
3. 원격 쓰기 전에 별도 승인을 받는다. 캐시/회수/수정/삭제 시험은 disposable 복제 프로젝트·전용 링크·파일에서 수행한다. 실제 화성시 7개 기사의 원문/디자인/Composition/음성에 저장·삭제·교체 시험을 하지 않는다.
4. 원본 baseline은 프로젝트/기사/블록/링크/Composition/폰트/디자인/음성의 ID·순서·참조·내용 hash, 기존 발행 상태/이벤트, 기존 공유 상태로 남긴다. 파일 hash 목록은 비공개 검증 위치에만 보관한다.
5. 준비 작업이 쓰는 것은 승인된 신규 메타데이터와 파생 이미지 prefix뿐이다. 기존 MP3·원본은 byte-for-byte 유지, OpenAI/TTS 생성 호출은 0이어야 한다.

## 2. 발행·준비 상태를 혼동하지 않는 테스트

| ID | 조작/조건 | 합격 결과 |
|---|---|---|
| C01 | 기존 정기호 prepare 실행 | 종전 공개 대상·revision·주의사항만 조회. 준비 Storage 쓰기나 정기호 이벤트 추가 없음 |
| C02 | 새 준비 작업만 ready 완료 | project.status/published_at, regular/rolling 상태, 독립 기사 상태, Demo grant 불변. 독자 공개 자격이 생기지 않음 |
| C03 | ready 생성 후 기존 publish 성공, head 활성화 성공 | 기존 발행 이벤트 1건은 원래 RPC 결과 그대로. 별도 준비 head/activation 영수증만 기록 |
| C04 | 준비 실패/시간 초과/미완료 중 publish | 기존 발행이 정상 가능하고 허가된 현재 동적 reader 제공. 준비 실패가 발행 실패로 둔갑하지 않음 |
| C05 | 기존 publish 실패 또는 응답 불명 | 준비본이 발행 성공을 만들어내지 않음. 기존 request key로 영수증/현재 상태 확인 전 임의 활성화 없음 |
| C06 | 동일 prepare_key 동시 제출/응답 유실 후 조회 | 같은 입력은 한 작업, 다른 actor/project/scope/input은 충돌 또는 권한 거부. lease/attempt 없이 중복 worker 실행 없음 |
| C07 | ready payload/manifest를 바꾸려는 쓰기 | 거부. 새 원본은 새 준비 ID. 이미 봉인한 파일 경로를 upsert하지 않음 |
| C08 | 같은 activation_key 재조회와 현재 head 교체 후 재조회 | 당시 결과와 현재 head/상태를 구분. 과거 성공 영수증으로 재활성화하지 않음 |
| C09 | 같은 내용 재발행 및 비공개 후 재발행 | 기존 새 발행 binding과 새 준비 ID. 이전 ID의 독자 URL이 자동 부활하지 않음 |
| C10 | 준비 메타데이터 쓰기 전후 기존 v1.40 revision 조회 | 캐시 작업 자체가 프로젝트 updated_at/내용을 건드려 발행 확인값을 오염시키지 않음 |

## 3. 의존성·노출·최신성 검증

아래 변경 각각에 대해 기존 source와 prepared source의 일치/불일치, 현재 동적 결과와 준비본 결과를 비교한다. `article.updated_at`이 그대로인 fixture도 반드시 포함한다.

| ID | 변경 대상 | 필수 기대값 |
|---|---|---|
| D01 | 제목·요약·본문·소제목·블록·링크·정렬 | stale 즉시 감지. regular 새 요청은 현재 수정본, Demo 원고 snapshot 불일치는 기존 `SOURCE_CHANGED` |
| D02 | Composition·placement·디자인/대표 이미지·홈/핫스팟/오버레이·표지 | 기사 시각이 그대로여도 dependency 변경 감지. ID와 배치/이미지 좌표 유지 |
| D03 | 프로젝트 상속 폰트·기본값·family/weight·face 활성 | 해석된 폰트가 바뀌면 stale. 현재 대체 서체·공통 CSS 정책, 이미지 안 글자는 불변 |
| D04 | 음성 연결·승인·대본/음색/hash·v3/만평 선택 입력 | 현재 선택이 달라지면 이전 manifest/파일 거부. 준비 작업이 생성 API를 호출하지 않음 |
| D05 | 새 기사/블록/자산/선택 후보 추가 | 이전 manifest에 이미 있던 ID만 재검사하는 누락을 검출 |
| D06 | renderer/schema/crop/템플릿 코드 버전 변경 | 다른 표현 버전의 준비본을 재해석하지 않음. 지원 불가면 현재 동적 경로 |
| D07 | 같은 path·같은 크기 이미지 덮어쓰기, DB row 유지 | 현재 Storage identity/hash 증거 없으면 캐시 hit 금지. 경로·크기·시간만 같다고 재사용하지 않음 |
| D08 | 원본/파생본 삭제·손상, MIME/차원/해시 위조 | 과거 바이트를 현재 파일처럼 제공하지 않음. 허용되는 현재 동적 매체 또는 오류 |
| D09 | regular draft·rolling draft·rolling published | regular draft는 프로젝트 공개 아래 종전대로 대상; rolling draft는 제외 |
| D10 | rolling 시작/종료 정확한 시각과 직전/직후 | 현재 함수의 경계 포함 의미와 동일. 미래/만료 본문을 initial payload에 숨겨 넣지 않음 |
| D11 | 긴급/수시 우선순위·관심분야·검색 | 필수 기사/기존 순서 규칙 유지. 사용자 선택을 다른 준비 scope나 DB sort_order로 저장하지 않음 |
| D12 | Demo 선택 기사 외 테스트 복제본/다른 프로젝트 기사 | 허용된 7건만. raw payload/검색 index/썸네일/음성/공유에서 제외된 자료가 노출되지 않음 |

source digest의 canonical fixture에는 null/빈 문자열, 한글/영어·공백·줄바꿈, 키 삽입 순서, 같은 sort_order의 ID tie-break, 시간대 표현, 숫자 표현을 넣는다. capture/finalize/resolve가 동일 투영을 사용해야 한다. 기존 정기호 MD5 revision, `demoSnapshot`, 독립 기사 source/payload hash는 별도 fixture로 비교하며 서로 치환하지 않는다.

## 4. 권한·URL·캐시 매트릭스

다음 상태 변화는 **HTML, RSC/서버 데이터, cover, thumbnail, map, 폰트/디자인 참조, 음성 manifest, 첫 64KiB, 이어받기/seek, HEAD, 조건부 GET**에서 각각 시험한다.

| ID | 조건 | 합격 결과 |
|---|---|---|
| A01 | private/미발행/archived/soft-delete/hard-delete | 현재 프로젝트 gate가 거부. 과거 head/캐시/URL로 우회 불가 |
| A02 | valid share → revoke/expiry | 새 검증은 기존 오류 코드로 거부. 캐시 hit·이전 쿠키·다른 share의 positive 결과 재사용 금지 |
| A03 | 무기한 화성 Demo | 현재 승인된 무기한 예외를 유지. 새 준비본이 임의 만료·재발급/회수를 수행하지 않음 |
| A04 | current source와 share.source_snapshot 불일치 | 준비본 miss로 바꿔 새 원고를 동적 제공하지 않음. `SOURCE_CHANGED` 유지 |
| A05 | 쿠키 차단/누락·잘못된 토큰·다른 프로젝트/기존 다른 쿠키 | 현재 구분된 오류 처리. 새로운 공개 fallback/무한 redirect 없음 |
| A06 | prepared_id/asset key/part/segment를 타 scope 것으로 바꿈 | 같은 프로젝트라도 다른 grant/scope 자격으로 준비본 열람 불가 |
| A07 | active A → B 후 A의 이미지/음성 URL·ETag/Range/HEAD 요청 | 과거 ID는 거부. 304나 브라우저/CDN 캐시가 현재 권한 확인을 대신하지 않음 |
| A08 | 자산 승인/활성 해제·파일 참조 해제·음성 삭제 | 현재 미디어 소속/정책을 확인. 파일이 Storage/캐시에 남아 있어도 제공하지 않음 |
| A09 | 공용 public 폰트·외부 영상·기존 직접 다운로드 | 기존 공개 주소/기기 복사본이 회수됐다고 판정하지 않음. 새 준비 URL이 추가 비공개 우회를 만들지 않는지 별도 확인 |
| A10 | anon/authenticated의 새 표 직접 접근·RPC·actor 위조 | 권한 거부. service_role만으로 사용자 자격을 대신하지 않고 서버/DB 대상 소유권 재검증 |
| A11 | 관리자 preview·unlock/역할/담당자 변경 | 일반/Demo payload를 관리자 검수 데이터처럼 사용하지 않음. 현재 해당 경로의 접근 계약 보존 |
| A12 | 카카오 미리보기 GET/HEAD와 반복 최초 진입 | 준비 쓰기·회수·세션 소비·열람 집계 추가 없음. 현재 직접 표지/쿠키/진단 흐름 유지 |

캐시 적중/누락 양쪽에서 위 매트릭스를 반복한다. 거부 결과도 cross-request 장기 캐시하지 않아 재발행/권한 복구가 즉시 반영돼야 한다. 회수 commit 후 시작한 새 요청을 기준으로 검사하며 이미 시작한 stream/수신 파일을 원격 회수하는 성공 조건을 만들지 않는다.

## 5. 경합과 장애 주입

| ID | 주입 지점 | 합격 결과 |
|---|---|---|
| F01 | capture 중 별도 연결이 article/Composition/폰트를 commit | 단일 snapshot과 일치한 source 묶음만 생성. 여러 REST의 혼합 저장본이 ready가 되지 않음 |
| F02 | 이미지 준비 중 원본/디자인/음성 교체 | finalize/활성화/읽기의 fresh 검증에서 stale 감지. 새 원본을 이전 ID에 덮어쓰지 않음 |
| F03 | ready 직전/활성화 검증 이후 편집 commit | 다음 독자 요청은 현재 수정본 또는 적법한 거부. 이전 prepared를 잠시 노출하는 허용 창을 만들지 않음 |
| F04 | 준비 선점 성공 후 HTTP 응답 유실/worker 종료/lease 만료 | 같은 키로 상태 확인. 유효 lease 중 이중 실행 금지. 명시 재개는 새 attempt 경로이며 기존 자산 덮어쓰기 없음 |
| F05 | Storage 성공 후 DB finalize 실패/응답 유실 | 파일 존재만으로 ready/active 처리하지 않음. 상태/proof 확인 후 재개 또는 private 고아로 남김 |
| F06 | DB ready 성공 후 activation 실패/영수증 유실 | 기존 공개 결과 유지. activation_key 조회가 현재 head와 과거 결과를 구분 |
| F07 | head A를 읽은 두 작업자가 B/C 활성화 | CAS 한 쪽만 성공. 늦은 worker가 새 head를 덮어쓰지 않음. generation으로 ABA 확인 |
| F08 | unpublish/revoke/archive/delete와 활성화 동시 실행 | pointer가 잠시 남아도 현재 gate가 거부. 활성화가 상태/공유 권한을 되돌리지 않음 |
| F09 | 새 RPC/표만 없음·응답 지연 | 기존 원본/권한 경로가 정상일 때만 동적 복귀. 새로운 DB schema가 없는 구배포도 유지 |
| F10 | 권한 DB 자체 장애/원본 확인 불가 | cached permit·과거 준비본·signed URL로 제공하지 않고 fail closed |
| F11 | mixed renderer 배포/구버전 앱 복귀 | schema/renderer 정확히 대조. 맞지 않는 준비본은 사용하지 않고 현행 동적 코드로 복귀 |
| F12 | 파생 파일 누락/변조/불완전 업로드·잘못된 Range | 잘못된 바이트/partial proof 제공 금지. 원본 MP3는 불변, 64KiB 제한/이어받기/seek 보존 |
| F13 | 기존 v1.38 저장/reorder·AI/Canva article-first writer와 준비 경합 | 새 광범위 부모 잠금/clock trigger가 도입되지 않았는지 확인. 교착/40001은 명시적으로 보고; 기존 발행 계약을 임의 수정하지 않음 |
| F14 | 고아/구준비본 정리의 참조 조회 실패·부분 삭제 | v1 기본 GC OFF. 별도 승인한 정리 시험만 수행하고 unknown 참조는 삭제하지 않음 |

Storage와 DB를 하나의 transaction이라고 가정하지 않는다. 원본 객체의 mutable identity를 검증할 수 없는 fixture는 HIT가 아닌 동적 경로가 합격이다. 실제 프로젝트 삭제나 실제 공유 링크 회수로 장애를 만들지 않는다.

## 6. PR #289 기준선과 측정 조건

아래는 기존 PR #289에서 기록된 **측정 결과**이며 이번 설계의 예상 성능이 아니다. 기준 SHA는 `51537b5`다.

| 지표 | 최초 시연 세션 5회 중앙값 | 동일 세션 재접속 5회 중앙값 |
|---|---:|---:|
| 초기 decoded HTML | 1,516,816 bytes | 1,516,818 bytes |
| 표지 LCP | 644ms | 608ms |
| 기사 진입 → 버튼 활성화 | 17ms | 14ms |
| 재생 click → playing | 10ms | 11ms |
| 재생 전 현재 음성 전송 | 65,536 bytes | 65,536 bytes |
| 실제 재생 시 음성 GET | 준비 + 이어받기 2회 | 준비 + 이어받기 2회 |

측정 환경은 Mac Chrome, 390×844, 같은 Staging을 읽는 GET-only 로컬 계측 중계, no-store 응답, 기사 진입 약 1.5초 후 재생 클릭이다. 버튼 관측 해상도는 10ms다. 첫 세션은 Demo 쿠키를 새로 발급받은 경우이며 서버/브라우저의 모든 cold cache를 초기화했다는 뜻이 아니다. 즉시 클릭이나 실제 휴대전화의 첫 소리 시간을 위 수치로 주장하지 않는다.

PR #288 단계의 별도 서버 함수 계측에는 DB GET 6회/Storage GET 1회가 기록돼 있으나 후속 브라우저 요청은 제외된 수치다. PR #289의 모든 요청·새 prepared resolver와 동일 범위라는 가정으로 그대로 차감하지 않는다. 초기 TTFB/전체 문서 수신, DB 내부 scan/CPU, Storage HEAD/GET 및 변환 시간의 **동일 조건 #289 기준선은 구현 직전에 다시 확보**한다.

## 7. 구현 전후 성능 실험

### 7.1 실험군

- control: 고정된 #289 코드/설정/원본. treatment: 같은 원본의 준비본 reader. production 트래픽이나 실제 발행물로 A/B하지 않는다.
- 최초/재접속 각각 최소 5회, 실행 순서를 교차한다. 같은 브라우저·viewport·망·리전·원본/MP3·읽기 대기시간을 고정한다. 5회는 중앙값과 범위만 보고하며 신뢰도 높은 p95라고 표시하지 않는다.
- 각 cache 상태를 분리한다: (a) ready/head HIT + 프로세스 byte cache HIT, (b) ready HIT + byte cache MISS, (c) 준비본 없음, (d) source/renderer/노출 집합 stale, (e) 미디어 identity 불확실, (f) RPC/schema 장애. 권한 거부를 빠른 HIT로 집계하지 않는다.
- 브라우저 cache, 서버 프로세스 cache, private 준비 객체 존재, DB buffer 상태를 각각 기록한다. 확실히 비우지 못한 층을 cold로 부르지 않는다. 지역/배포 cold start가 섞이면 표기한다.
- 모바일 세로 390×844, 520px, 가로 844×390, PC HTML e-book 1366×768에서 기본 회귀를 확인한다. 성능 비교의 대표 크기는 390×844로 고정한다.

### 7.2 지표와 계측

| 지표 | 계측·구분 |
|---|---|
| HTML bytes·TTFB·전체 수신 | decoded 문서와 compressed wire bytes를 구분. streaming 최초 조각/실제 표지 마크업/전체 완료도 분리 |
| 표지 LCP·제목/이미지 paint | 브라우저 Performance/Element Timing. HTTP 문자열 수신 시각을 paint로 보고하지 않음 |
| DB 왕복·처리 | 요청별 PostgREST/RPC 수, server↔DB 왕복, DB 내부 집계/scan/CPU를 별도로 측정. 한 RPC가 한 내부 조회라는 주장은 금지 |
| Storage·이미지 | HEAD/GET 횟수, 원본/파생본 bytes, 원본 proof 확인 비용, Sharp decode/crop/encode, 캐시 lookup/전달 시간 |
| 음성 준비 | 활성 버튼 시각, 현재 역할의 준비 bytes/Range, manifest 중복 GET, 클릭 전 준비 완료 여부 |
| 실제 재생 | click→playing, 이어받기 요청, 중복/누락 Range와 64KiB 제한. 0초/1.5초/10초 읽기 대기를 구분 |
| 실제 첫 소리 | 삼성 갤럭시의 카카오톡/Chrome/삼성 인터넷에서 사용자 청감 또는 동기화된 녹화/오디오로 별도 측정. 측정 불가면 미검증 |
| 오류·부하 | cache result별 오류율·실패 stage·동적 fallback 부하. 로그에는 요청 ID/코드/숫자만; 토큰·쿠키·원고·미디어 바이트 없음 |

### 7.3 구현 전 합의할 목표 — 아직 실측 개선값 아님

1. 안전성: A/C/D/F 계약 실패 0건, 기존 발행·Demo 오류 의미 변경 0건이 최우선이다.
2. 초기 문서: 같은 fixture에서 #289 decoded HTML 대비 1% 이내 증가를 예산으로 제안한다. 모든 이미지/MP3의 초기 인라인·일괄 다운로드는 금지다.
3. 준비본 HIT에서는 해당 이미지의 요청 시 Sharp 변환 0회, 검증 가능한 원본의 전체 재다운로드 0회를 목표로 한다. 필요한 현재 identity HEAD/DB 조회는 비용에 포함한다. 불확실한 원본은 동적 비용을 숨기지 않는다.
4. Demo v1은 기존 접근/source 2왕복과 새 resolve 1왕복을 기본 예상 경로로 검토한다. 표지/폰트/선택 proof 등의 추가 비용을 포함해 **실제 초기 DB 왕복이 #289보다 감소해야** 성능 합격이다. 이것은 목표이며 배포 전 확정 호출 수나 속도 보장이 아니다.
5. 이미지/음성 매체의 gate도 동일 데이터를 묶어 읽는 것을 목표로 하되 권한 0조회나 장기 permit cache를 목표로 삼지 않는다. 준비·이어받기 두 요청은 계속 검증한다.
6. 표지 LCP/문서 수신/음성 시작은 paired 중앙값과 모든 원시 표본으로 비교한다. 반복 실험에서 악화가 확인되면 rollout을 중지한다. 버튼의 수 ms 차이를 관측 해상도보다 정밀한 개선이라고 판단하지 않는다.
7. 현재 #289의 준비량·음성 클릭 지연을 보존하는 것이 목표다. 실제 첫 소리의 개선 수치는 구현/실기기 측정 전 제시하지 않는다.

## 8. 회귀 및 승인 증거

- 발행: 작성자 직접/기관 검수/legacy 승인-only, 중복키/현재 상태, regular draft/rolling 시간 경계, 비공개/재발행.
- Demo: 원본 공유 URL·직접 표지·쿠키 오류 구분·noindex/no-referrer·카카오 미리보기, 7건 scope와 source 변경 거부.
- reader: 표지→목차→요약→인라인 상세→접기→이전/다음, 관심분야/검색/뒤로가기/직접 URL, 글자 확대, 가로/PC 1·2쪽.
- 미디어: 썸네일 크롭, 지도 1024×700/핀·확대, 만평/인터뷰 A·B/영상, 14개 논리 음성 경로와 기존 파일 선택, 요약/상세 중복 재생 방지, 이동 시 중단.
- 참여: 의견 비공개/설문·공유 정책을 준비본에 고정하지 않음. Demo 제출 비활성 및 댓글 차단 유지. 시민 운영 데이터를 fixture로 사용하지 않음.
- 독립 기사: [기존 A 테스트 계약](article-independent-publication-stage-a-tests-v1.md)의 별도 상태·revision·이벤트·철회/과거 공개본 의미를 변경하지 않음. 미구현 계약을 통과했다고 보고하지 않음.
- 증거 묶음: 정확한 코드/원본/renderer/schema 버전, 권한·fault matrix, 준비본 hit/miss, 요청별 비용, 비교 표본, 환경, 실기기/자동화 구분, 데이터 불변 결과. 운영 토큰·원본 파일을 PR/공개 로그에 첨부하지 않는다.

초기 R0 검증은 링크/용어/계약·명시적 미검증·docs-only diff 확인이었다. 서비스 빌드나 원격 쓰기 테스트를 설계 검증인 것처럼 실행하지 않는다.

## 9. R0.5 수행 결과 및 남은 합격 조건

### 9.1 실제 수행한 범위

- 기준 SHA #289 `51537b5`, 설계 PR #290 `7d6d4ef`에서 읽은 코드. 서비스 소스 변경 없이 기존 TypeScript helper를 로컬 Node에 로드했다. Next 서버/브라우저를 실행한 테스트가 아니다.
- transport는 정확한 Staging origin의 `/rest/v1/`, `/storage/v1/` GET/HEAD만 허용하고 비 GET/HEAD·다른 origin/OpenAI를 거부했다. Production 접속·DB/Storage 쓰기·TTS 호출 0회. 키·share bearer·응답 원문은 출력/저장소에 보관하지 않았다.
- 기존 권한/source 검증과 helper를 구성된 Staging 설정으로 1회 warm-up 후 5회 계측했다. 원본 표 조회는 별도 GET이므로 **DB 단일 snapshot 검증이 아니다**. broad hash 입력은 메모리에서만 사용했다. private 결과 파일에는 요청별 숫자·표 이름·성공 여부만 남겼다.
- 초기 helper는 매회 DB 12 GET/Storage 1 GET, 총 246.33~301.72ms, 중앙값 272.08ms였다. 병렬 쿼리 시간을 합쳐 전체 시간을 계산하지 않았다. font/Composition이 설정 누락으로 생략된 실행은 최종 성능 표본으로 사용하지 않았다.
- 관광 썸네일의 변환 캐시 MISS/HIT를 각각 5회 비교했다. 매 MISS 전에 해당 모듈의 Map만 새로 만들고 바로 재호출해 HIT를 측정했다. 브라우저/CDN/DB cold cache 시험이 아니다. 실제 지도/파일은 변경하지 않았다. 양쪽 모두 원본 전체 516,304B를 읽었다.
- 대표 표지·지도·음성·폰트 각 1건의 HEAD/info를 읽었다. 네 객체 모두 version 필드는 있었으나 is_versioned=false였다. ETag/수정시각은 존재하나 영속 SHA-256/current-overwrite 강한 증거는 미확인이다. overwrite/삭제/조건부 응답 실험은 하지 않았다.

정확한 표본·비용별 해석은 [아키텍처 11절](publication-prepared-content-architecture-v1.md)에 기록했다. PR #289의 HTML/LCP/playing 기준선은 6절과 혼합하지 않는다.

### 9.2 로컬 모의 검증

| 모형 | 수행 결과 | 입증하지 못한 것 |
|---|---|---|
| 현재 데이터 복제본의 broad canonical SHA-256 | 11/11 변경 검출: 기사 제목, 부모 timestamp 유지한 블록 metadata/Composition, 신규 기사·링크·placement·음성 후보, 폰트 활성/패밀리, 디자인 활성, 음성 선택 proof | 최종 allowlist 완전성, SQL canonical 동등성, RLS, 단일 MVCC. 전역 폰트 전체 hash는 최종안 아님 |
| DB 행은 같고 Storage 바이트만 변경됐다고 놓은 모형 | row digest가 같아 검출 불가임을 확인 | 실제 운영 파일 overwrite나 ETag/version 변경 감지 시험 아님 |
| 작은 준비/활성화 상태 모형 | 12/12 계약 사례 통과: 동일 prepare key/입력 충돌, 구 attempt 거부, 파일 proof 실패, source stale finalize, ready 불변/일회 binding, CAS 경합, 응답 유실 영수증/current head, activation key 충돌, ABA, 현재 권한 거부, Demo SOURCE_CHANGED, mixed renderer/schema/source/proof fallback | 실제 DB 동시 연결·행 잠금·유일 인덱스·SQL rollback/권한 검증 아님. 단일 프로세스의 논리 모형 |
| 준비 payload JSON 재사용 모형 | RAM parse 5회 중앙값 0.30ms | fresh 권한/source·신규 RPC·Storage·SSR 제외 하한. 실제 prepared HIT 속도 아님 |

### 9.3 R1 격리 구현에 추가할 게이트

1. **변경 검출:** 저장 경로별 fixture를 최종 투영의 동일 SQL 문으로 capture/resolve한다. 부모 timestamp 불변·신규 행·삭제·동점 순서·폰트 후보·선택 음성 변경을 포함한다. 현재 0행인 홈/오버레이 등은 별도 synthetic fixture가 필요하다.
2. **Storage:** disposable 객체에서만 같은 크기 overwrite·삭제·info/ETag·GET/Range/조건부 응답·CDN 경계를 검증한다. 현재 계측 파일에는 쓰지 않는다. 증거를 확보하지 못한 자산은 dynamic_only가 합격이며 영속 파생 HIT를 켜지 않는다.
3. **DB 내부 비용:** 격리 PostgreSQL에서 대표/확대 fixture의 기존 조회와 새 projection/resolve를 실행계획·actual time·buffers·행 수·JSON/hash 비용으로 비교한다. DB 왕복 수와 별도 열에 기록한다. JS 5.18ms를 SQL scan 결과로 대입하지 않는다.
4. **전체 비용:** 기존 grant/source + 새 resolver의 source 이중 읽기, payload 매번 반환/서버 RAM 후보 적중/프로세스 miss를 비교한다. RAM 후보와 head/hash/binding/renderer 불일치면 fresh 반환만 사용한다. 실제 준비본 HIT/MISS 시간은 그때 최초 측정한다.
5. **멱등성/경합:** 두 DB 연결로 head 생성/교체/해제 tombstone·ABA, activation unique key·CAS·영수증 원자성, lease takeover 뒤 stale finalize를 검증한다. 권한 검사는 중복 영수증 반환보다 앞선다.
6. **복귀:** schema/RPC 부재와 timeout을 주입하되 권한/source DB 자체 오류와 구분한다. fallback 시간 예산과 기존 오류 코드를 비교한다. 원고 변경된 Demo를 캐시 장애로 새로 제공하면 실패다.

### 9.4 타당성 판정

**조건부 진행 가능: R1 격리 검증까지. 원격 migration/serving 승인 근거로는 부족하다.** 2표/내부 RPC 4개로 논리 계약은 표현 가능하다. 최종 의존성 투영·SQL 비용·Storage 현재 동일성 검증이 남아 있다. 추가 테이블/RPC를 먼저 늘리지 않고 기존 4개 함수와 두 표의 제약/입력을 구체화한다. 성능 이득이 확인되지 않으면 동적 경로를 유지하며 관측되지 않은 개선률을 제시하지 않는다.
