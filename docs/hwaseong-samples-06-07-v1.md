# 화성 비공개 모바일 샘플 06·07

## 범위와 보존

- #261 head `e1171c27f0b1b7c87fcb8370b44344b2cf31934f` 기반 후속 브랜치. #261은 변경·병합하지 않는다.
- Staging `hwaseong-2026-10-samples`에 신규 기사 2건, 자산 3개만 추가. 기존 5건의 기사·블록·Composition·음성·자산 행과 파일 15개의 SHA-256 비교는 동일.
- Production/Supabase `qmhvlbpedudpwtznletj`와 Staging `mvrkpmffuhcqwisqvpqi`는 다른 프로젝트. 모든 데이터 스크립트는 Staging ref와 정확한 private 프로젝트 UUID를 검사한다. 기존 HMAC 및 호스트별 쿠키를 재사용하며 인증 설정은 변경하지 않는다. 원격 서명키의 독립성은 별도 확인하지 못했다.
- Production 배포·데이터·Storage·발행 상태 변경 없음. migration 및 새 공개 URL 없음. 기존 인증 Staging 샘플 라우트만 확장.

## 06 · 인물 탐방

- 기사: `a802c522-becf-496e-b78f-e374e4b7e98d`, 순서 60.
- 제목: 천천히, 빛에 머무는 시간 — 신현정 작가.
- [중부일보 이준도 기자의 실제 인터뷰, 2026-06-08 11:09](https://v.daum.net/v/20260608110932267).
- 인물은 동탄 전시 참여 시각예술 작가 신현정. 현재 기관장이라는 주장은 하지 않는다. 2026-10-25 확인 시 이용 가능한 2026년 인터뷰에 근거한 활동 분야이며 그 이후 직책은 별도 확인되지 않았다.
- 원본 제목: 「[인터뷰] 신현정 작가 “도파민에 중독된 세상 속 한줄기 세로토닌 느껴보세요”」.
- 실제 발언 중 짧은 한 문장만 인용. 나머지는 3개 주제로 짧게 재구성하며 창작 질문·직접 답변을 만들지 않는다. 7월 종료 전시를 현재 행사로 안내하지 않는다.
- 사진: 중부일보 이준도 기자. 원본 690×518, SHA-256 `a3bafdca3a788a14401a4eb6c89975d5ef8324f2361e2e73cb81284f6e7c5ddf`. 출처 표기, 비공개 시연 한정. 외부 공개·재배포 권리 확보를 뜻하지 않는다.
- 종이색·세리프 제목·큰 실제 사진·인용문으로 문화잡지형 HTML 편집. 중요 문구는 글자 확대 가능.

## Canva 실증

- 앱의 기존 `GET /api/canva/connection?projectSlug=hwaseong-2026-10-samples`: `disconnected`. 연결·인증 설정을 변경하거나 기존 앱 실행/승인 계약을 우회하지 않았다.
- 연결된 Canva 도구에서 기존 브랜드 템플릿 `EAHXxi1onEI`(인터뷰·인물형 02 · 메인형)와 실제 9개 입력 필드 확인.
- 실제 사진 업로드 및 Autofill 수행. 초안에서 긴 제목·설명 줄바꿈을 확인하여 짧은 제목의 최종본을 1건 추가 제작. 생성형 이미지 호출 없음.
- 최종 디자인 [DAHY8l8otBs](https://www.canva.com/design/DAHY8l8otBs/edit), 1080×1920 PNG. Canva UI의 PNG 다운로드를 실행하고 기존 private 제작 자산 계약으로 수동 등록. 상세의 ‘Canva 제작 표지 확인’에서 열람.
- [공식 Autofill 요금제 안내](https://www.canva.dev/docs/apps/rest-apis/autofill-guide/) 및 [공식 2026-09-23 변경 공지](https://community.canva.dev/t/autofill-apis-are-now-available-on-canva-pro-and-above/8922) 확인. 템플릿 접근·Autofill·PNG 출력 성공. 별도 결제·구독 변경 없음. 계정의 청구 금액·잔여 유료 생성 크레딧은 조회되지 않았으며 무제한 이용을 전제하지 않음.
- 기존 템플릿의 글자 윤곽·사진 프레임은 유지. 웹의 최종 독서 화면은 더 단순한 HTML 편집으로 제공한다.

## 07 · 공식 영상 큐레이션

- 기사: `50bf808f-15b5-4484-8fee-38f7a8acb99d`, 순서 70.
- [공식 영상](https://www.youtube.com/watch?v=cLHilm6oBjI): 「[화성특급] 화성시 사람들 다 모였다! #화성에코팜테마파크 #선셋콘서트」.
- 공식 채널: [화성특례시 · 화성온TV](https://www.youtube.com/@Hwaseongsi), 채널 ID `UC6u126XB-cXV4H5_9WY2TgA`.
- 원본 설명 펼치기에서 게시일 **2026-10-15** 확인. 브라우저 실제 재생 약 33초, duration 520.541초, readyState 4 확인. 전체 시청이나 장면·발언 검증으로 보고하지 않는다.
- 요점 3개는 공식 설명란에 있는 시설·9월 선셋콘서트·원본 정보에 한정. 종료된 이벤트 참여 안내를 복제하지 않는다.
- 공식 썸네일 1280×720, SHA-256 `c9bcac5c64d2bc4ebec34ab33ec9f7eef095a323be72434dd7d901ba4af07f1d`.
- 어두운 영상 매거진, 밝은 재생 버튼, 클릭 시 `youtube-nocookie.com` 플레이어 로드. 원본 링크 항상 제공. 영상 다운로드·수정·재업로드 없음.
- [시청 공식 보도자료](https://www.hscity.go.kr/www/user/bbs/BD_selectBbs.do?q_bbsCode=1051&q_bbscttSn=20260828111811247)의 오래된 채널 링크 `@ihbsgokr`는 404. 현재 `@Hwaseongsi` 공식 채널에서 직접 URL·게시일·인증 표시 확인. 후보 소방관 영상도 확인했으나 10월 영상 우선 원칙에 따라 선정하지 않음.

## 검증과 한계

- 기존 샘플 메타데이터·배치·공개 reader 계약 변경 없음. 기존 5건의 렌더링 분기는 그대로 유지.
- 새 유형만 별도 컴포넌트로 렌더링. 검증된 원문 URL·영상 ID·2026년 게시일·프로젝트 파일 경계를 검사하며 임의 외부 iframe은 허용하지 않는다.
- 제목·요약·본문·인용문은 HTML. 기사 전환 시 플레이어 인스턴스가 교체되며 닫기 버튼으로 iframe 제거.
- 전체 626/626, skip 0. TypeScript·Webpack build·diff check 통과. lint 오류 0, 기존 경고 3개.
- 원격 390/520 QA와 배포 결과는 최종 검수 후 아래 기록에 보완한다.

## 원격 최종 QA

- fixed Staging의 `464b612` 배포 Ready, Preview SUCCESS. 관리자 인증 세션으로 7건 목록, 06·07 요약/상세, 이전 페이지·이전/다음 기사 링크 확인.
- 390/520 viewport: 실제 사진 690×518, 썸네일 1280×720, Canva PNG 1080×1920 로딩 확인. 가로 넘침 없음. HTML 본문 최대 32px 확대 확인.
- 샘플 iframe 안에서 실제 영상 재생·자막·화면 확인. 초기 iframe 0개, 클릭 후 1개, 닫기 후 0개. 기사 변경 후 iframe 0개. 원본 YouTube에서도 실제 재생 확인.
- 기존 5건의 제목·화면·정렬·이전/다음 링크 및 보존 자산 참조 확인. 원본 DB 행·파일 15개는 전후 동일. Composition placement 행의 별도 변경 전 baseline은 누락되어 바이트 단위 전후 동일성을 별도 주장하지 않으며, 기존 5개 placement가 기존 자산을 계속 참조하는 것은 확인함. 신규 생성 스크립트는 신규 기사 ID의 Composition만 호출함.
- Production 샘플 URL은 HTTP 404. Production 실행 배포는 기존 `9ed9bbc` 유지.
- 사진·썸네일 수신 전 레이아웃 높이가 줄었다가 늘어나는 현상을 줄이기 위해 신규 이미지에 검증된 intrinsic width/height 지정. 기존 5건은 변경하지 않음.
- 원격 인증 서명키 값·청구 내역·전체 영상 장면·사진 재배포 허가는 미확인. 기존 앱 Canva 자동 제작/import 연결 E2E는 미실행. 새 UI 및 sample route는 공식 발행 reader로 활성화되지 않음.
