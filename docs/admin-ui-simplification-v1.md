# 관리자 UI 간소화 1단계

기준 main: `437767c1c3c64a99951719c55fe25ca00a07f550`, 2026-10-19.

## 범위와 구현

향후 범위는 (1) 페이지 제목 한 줄, (2) 폰트 ZIP 등록 개선, (3) 기관 CI·BI·일러스트와 기사 디자인 연결, (4) 중복 UI/버튼/프로세스 간소화다. 이번 PR은 (1)과 원격 QA에서 발견한 배포 카드의 최소 폭 보정만 구현하며 (2)~(4)의 기능 개편은 조사·대응표다. 새 기능·권한·발행 정책을 만들지 않는다.

프로젝트 10개 page의 sidebarTitle JSX에 삽입된 `<br />`를 문자열로 교체했다. 검수·발행/배포 관리/참여 콘텐츠/반응 통계 및 기사 편집·빠른 소식·음성·자산·eBook·저장 리포트가 대상이다. 디자인/기본 정보의 단순 fragment도 같은 문자열 계약으로 맞췄다. 공통 프로젝트 선택 페이지 6개의 동일한 제목 패턴도 정리했다. ProjectAdminShell의 sidebarTitle을 string으로 제한한다. `nowrap`, ellipsis, 고정 최소 폭을 사용하지 않는다. 짧은 제목은 한 줄, 긴 제목이나 큰 글자는 가용 폭에서 자연스럽게 줄바꿈되며 단어 내부 overflow도 방지한다. 프로젝트의 실제 소식지 제목은 길이가 임의이므로 한 줄을 강제하지 않는다. 홈의 긴 소개 제목은 이번 범위에서 유지한다.

공통/프로젝트의 같은 업무는 ‘검수·발행’, ‘배포 관리’, ‘참여 콘텐츠’로 명칭을 맞춘다. href·폼·실행 버튼·상태 전이·reader·저장 hook은 변경하지 않는다. 정확히 같은 정보라는 근거가 부족한 안내는 삭제하지 않는다. 프로젝트 제목/현재 화면/진행 상태는 서로 다른 정보여서 통합하지 않았다.

## 주요 화면 감사 및 후속 대응표

| 화면 | 핵심 행동 | 현재 문제 또는 혼동 가능성 | 이번 조치 / 후속 |
|---|---|---|---|
| 프로젝트 목록 / 신규 | 발행호 선택·기본 정보 입력 | 긴 소개 제목과 프로젝트명은 업무 제목과 구분 필요 | 신규 기본 정보 제목만 정리, 프로젝트 카드 재설계는 후속 |
| 기사 목록 | 선택·순서 저장·편집 | 상태가 다수지만 구성 정보는 이미 접힘 | 기존 경로/명시 순서 저장 유지 |
| 작성·수정 | 원문 입력·저장·디자인 | 공통 workflow와 기사 workspace 단계가 반복 | 제목만 정리, PR #226에 따라 후속 단계 요약 |
| 기관 디자인 | 기관 기준·자료·자산·발행호 준비 | 기관 기준과 기사 적용을 혼동할 수 있음 | 기관 자산→웹용 파생본→승인→기사 배치로 책임 구분 |
| eBook | PDF/페이지·핫스폿 | 모바일 기사와 이미지 페이지는 별도 결과물 | 제목 정리, 합치지 않음 |
| 이미지 / 음성 | 업로드·검수·연결 | Design Asset과 일반 미디어 자산은 테이블/FK/사용 경로가 다름 | 제목 정리, 공통 라이브러리로 무조건 합치지 않음 |
| 검수·발행 | 직접 발행/기관 검수/시연 공유 | 공통 준비 단계와 발행 화면 자체 상태가 중복돼 보임 | 제목 통일, 승인·공개·시연 의미는 유지 |
| 배포 관리 | URL/QR·채널·기록 | 발행과 배포를 같은 행동으로 오해 가능 | 제목 통일, 다음 단계 링크·실제 발행 버튼 유지 |
| 참여 콘텐츠 | 설문·이벤트·응답 | 전체 프로젝트 큐와 단일 프로젝트 화면 제목이 분리됨 | 제목 통일, 전체 목록 이동은 유효한 별도 범위 |
| 반응 통계 / 저장 리포트 | 기간별 성과·출력 | 실시간 집계/저장본/프로젝트 상태 카드가 동시 노출 | 제목만 정리, 데이터 기준시점 안내는 삭제 금지 |
| 설정 | 기관/발행호/담당/주소 | 고급 설정이 비전문 작업자에게 과밀할 수 있음 | 후속 progressive disclosure, 이번 폼 변경 없음 |

업무 흐름은 준비→작성→구성→검수→발행→배포/분석이다. shell workflow/하위 작업과 왼쪽 메뉴의 역할이 일부 겹치지만 capability와 현재 위치가 다르다. 안전한 후속은 진행 단계 요약 및 보조 메뉴 접기이며 기능·진입점 삭제가 아니다. 조사한 메뉴 href는 기존 route와 연결되며 명백한 잘못된 링크는 발견하지 못했다. 모든 데이터 조합과 역할별 실제 클릭을 검증했다는 뜻은 아니다.

## 폰트 ZIP 조사

근거: `src/app/api/font-packages/route.ts`, `src/components/font-asset-manager.tsx`, `src/lib/font-css.ts`.

- admin 전용 multipart POST. ZIP 30MiB(코드의 30×1024×1024), 내부 entry60개, 폰트20개, 개별 폰트10MiB, 추출 총80MiB 제한. woff2/woff/ttf/otf와 라이선스 문서를 서버 JSZip으로 추출한다. 위험 경로·일부 숨김 파일 검사를 한다.
- 추출 검증→원본 ZIP Storage 업로드→내부 파일 순차 업로드→font_families→font_assets 기록. 원본 업로드가 실패하면 즉시 반환하므로 등록 전체가 중단된다. 중간 실패 후 이미 업로드한 파일의 트랜잭션식 회수/재개는 보이지 않는다. 원본 ZIP 경로는 `families/{id}/original/…`, 웹폰트 사용/활성은 별도 정책이다.
- API가 30MiB를 허용하는 것과 실제 호스팅의 request body 한도는 별개다. 이번에 실제 대용량 업로드/실패를 재현하거나 플랫폼 한도를 측정하지 않았다.
- 우선 오류를 ‘요청 도착 전/원본/추출 파일/DB 기록’ 단계별로 구분하고 원본 보존을 포함한 재시도 계약을 설계한다. 브라우저 압축 해제는 전송량/함수 메모리 감소 대안이나 단독 해결은 아니다. 서버 재검증·권리 정보·원본 보존·부분 실패 재개가 필요하다. 파일을 무조건 잘라 업로드하거나 원본 실패를 무시하지 않는다. 신규 dependency/업로드 방식은 이번 PR에 추가하지 않는다.

## 기관 자산 조사

근거: `src/app/api/project-design-kit/assets/route.ts`, `src/lib/project-design-asset-write.ts`, `src/lib/design-asset-metadata.ts`, `src/lib/institution-asset-matching.ts`, `src/lib/article-composition.ts`, `src/lib/article-hero-background.ts`, `src/lib/design-processing/provider.ts`.

- Design Asset은 원본(source_design: AI/SVG/EPS/PSD/PDF, 최대50MiB), 참고자료, 로고(PNG/JPG/WebP 최대5MiB), 제작용 SVG/PNG/JPG/WebP(최대10MiB)로 분리된다. 원본 intake와 웹 제작 자산의 Storage/parentSourceAssetId를 재사용할 수 있다. 원본을 브라우저에서 즉시 렌더하는 기능과 파일 보관은 다르다.
- approved/active와 source provenance, 프로젝트 소유권이 별도다. 기관 매칭은 institution/raster/활성/용도·실제 대상 조건을 검사하는 후보 추천이며 자동 승인·적용이 아니다. SVG 원본의 저장 지원이 자동 래스터 변환/안전한 inline 표시를 보장하지 않는다.
- provider operation 이름과 processing job 기반이 있으나 AI/PSD 일괄 자동 웹 변환이 완성됐다고 볼 수 없다. 후속 최소 범위는 원본→수동 웹용 파생본 등록 연결과 승인→지원 슬롯 picker 안내다. 외부 Adobe 연결은 별도 결정이다.
- Composition은5개 슬롯을 편집한다. 공용 reader가 지원하는 배경(hero_background)과 상단 장식(hero_illustration)을 우선한다. title_icon/body_decoration/footer_banner는 현재 공개 미지원 안내를 유지한다. Canva full-layout은 텍스트까지 포함하므로 배경으로 강제 변경하지 않는다.

## 디자인 UX 및 단계별 권고

PR #226 head `4d6a0e6f04d29456cefa080b2db69d4431101e3e`의 `docs/article-design-ux-simplification-v1.md`를 git object에서 읽었다. 파일은 main에 아직 없으며 이번 PR로 가져오거나 기존 PR을 수정하지 않는다.

‘디자인 선택→세부 조정→미리보기/확인’을 기사 첫 화면 제작의 하위 작업으로 둔다. 향후 비주얼 요약+상세(B형)를 기본으로 검토하되 같은 article ID/원문 블록/실제 HTML CTA/텍스트 확대를 보존한다. generated/approved/imported/applied/published는 서로 다른 상태다. 첫 화면과 상세 전환, 사람이 확정한 요약, A/B/C형 저장은 별도 설계로 확정해야 하며 이번 제목 PR에서 새 metadata를 만들지 않는다.

우선순위: 제목 정리(이번)→폰트 단계별 실패/재개 설계→기관 웹용 자산/승인/기사 picker 연결→PR #226의 접기/단계 요약→비주얼 요약/상세 포맷. TTS/편집 복귀/개별 발행/지난호는 별도 문서 PR에서 다룬다.

## 검증 및 경계

전체 테스트·TypeScript·lint·Webpack build·diff check와 390/768/1440px 브라우저 QA를 수행하고 실제 결과는 PR에 기록한다. QA는 로컬에서 실제 페이지와 공통 shell을 사용하고 원격 데이터는 읽기만 한다. Production/Staging DB·Storage write, migration, 생성 API 호출, merge 없음. PR #226/#229와 stash2 원본 보존. 순수 제목 변경이므로 API/renderer 기능을 따라 쓰는 형식적 신규 단위 테스트는 추가하지 않고 기존 회귀 및 실제 폭 측정을 사용한다.

### 로컬 실제 페이지 QA 결과

검수·발행/배포 관리/참여 콘텐츠/반응 통계 × 390/768/1440px =12개 조합에서 `<br>`0, 제목 높이30px/line-height30px(1줄), 제목 잘림0, document 가로 overflow0을 측정했다. 실제 사이드바 메뉴 클릭으로 참여 콘텐츠 이동도 확인했다. console error0. 로컬 전용 계정으로 실제 Next 페이지와 Staging 읽기 데이터만 사용했다. 원격 업로드·발행·설문 저장을 실행하지 않았다. 긴 소식지명/홈 소개 제목의 한 줄 강제는 검증 대상이 아니다.

전체428/428(skip0), TypeScript/lint/Webpack build/diff check 통과. 기존 warning3/new0. 인증된 원격 Preview QA와 로컬 QA는 구분하여 PR에 기록한다.

### 원격 Preview 추가 QA

로그인된 Preview의 실제 무안군 프로젝트를 읽기 전용으로 확인했다. 네 제목은 390/768/1440px에서 모두1줄/잘림0이었다. 최초 head에서는 긴 공개 URL이 있는 배포 관리만390px 가로 overflow가 있어 동일 page의 grid-cols-1/minmax(0,1fr) 및 두 자식의 min-w-0로 보정한다. 복사/발송/저장 로직은 변경하지 않는다. 로컬 Staging 샘플에는 이 길이 조건이 없어 처음 QA에서 검출되지 않았다. 실제 발행·저장·복사 버튼은 실행하지 않는다. 최종 보정 head와 재검증 결과는 PR에 기록한다.
