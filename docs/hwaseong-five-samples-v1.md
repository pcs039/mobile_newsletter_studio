# 화성시 10월호 Staging 샘플 5건

Production 기사·Storage·발행 상태는 수정하지 않았다. Staging `mvrkpmffuhcqwisqvpqi`의 신규 비공개 프로젝트 `hwaseong-2026-10-samples`에만 원문 복제본·이미지·요약 음성과 Composition을 저장했다. 기존 Staging 프로젝트도 유지한다. migration·새 버킷·직접 업로드 gate·외부 생성 API는 사용하지 않는다.

## 원문 대조

사용자가 지정한 `muan-26-09` / `02314762-0d1d-49e8-ad30-5c058f2ddeee`는 실제 DB에서 「무안작은영화관, 9~11월 무료 기획전 운영」이며 해당 프로젝트의 다른 기사도 무안군 소재였다. 따라서 기존에 읽기 전용 확보한 `hwaseong-2026-10`의 화성시 원문을 활용했다.

| 샘플 | 보존한 원문 | 원본 article ID | Staging article ID |
|---|---|---|---|
| 생활행정·정책 | 화성시, 폐건전지·종이팩 교환으로 자원순환 실천 | `5f00b067-0a65-4678-b733-09e735916803` | `b48352e0-dbbe-4cca-bbcc-f88988b27d32` |
| 관광지도 | 화성특례시, ‘모두의 행복, 더 큰 화성’으로 새로운 도약 | `71f78dc0-e8ae-41a9-99ac-9b5ebd798030` | `336fcac1-c773-4f72-a4b8-c07d06b032e7` |
| 행사·문화 | 10월 화성, 시민과 함께 즐기는 축제의 달 | `e57fefc3-2fba-4303-8621-652ebb389e66` | `2d080a0e-42c6-499d-9611-16bbc675495e` |
| 창작 3컷 | 남부권 반려가족놀이터 개장…반려견과 함께하는 특별한 하루 | `07cc20ce-48f5-462b-9888-26cbf5375c36` | `723d4dff-9d15-4515-af0a-0d725eb94b5e` |
| 한국어·English | 같은 반려가족놀이터 원문 | 동일 | `5f6d8133-9da3-42c8-ab3c-c981e25cc585` |

관광지도는 [화성특례시 공식 그림지도](https://www.hscity.go.kr/www/intro/trstMap.jsp)의 원본 이미지와 좌표를 사용했다. 주요 6곳에 폴리곤 터치 영역 및 큰 선택 버튼을 제공한다. 장소 안내·주소·전화는 공식 자료에 근거하며 방문 조건·행사 일정은 별도 확인을 안내한다. 만화 대사·영어 번역·요약은 시연 편집으로 구분하며 상세 원문을 대체하지 않는다.

## 열람 및 구현 경계

목록: `https://canva-staging.datadiction.co.kr/projects/hwaseong-2026-10-samples/samples`

기사: 같은 경로에 `?articleId=<Staging ID>`로 요약, `&view=detail`로 상세. `&width=390` 또는 `&width=520`으로 모바일 폭을 점검한다. 목록·이전 페이지·이전/다음 기사 링크는 동일 프로젝트와 폭을 유지한다.

Staging 환경·DB ref·사이트 설정 확인, 정확한 샘플 slug, 기존 HMAC 로그인·프로젝트 담당 권한을 모두 요구한다. Production과 일반 Preview에서는 비활성이다. 기존 공개 reader 및 API의 권한은 변경하지 않는다. 새 발행 방식이 아니라 비공개 제안용 표시 화면이다. 상세는 공통 `ArticleCard`·기존 Composition·폰트 CSS·글자 확대·음성 player·이미지 확대를 재사용한다. 파일은 기존 인증 proxy를 통하며 raw public Storage URL이나 signed token을 배포하지 않는다. noindex/no-follow/no-referrer로 설정한다.

외부 담당자의 무로그인 접속을 새로 허용하지 않는다. 현재 결과는 관리자/담당자 로그인 후 시연한다. 정식 발행·기관 승인·시연 토큰 생성은 하지 않는다. 이미 발행된 페이지와의 시각 차이는 공통 ArticleCard 재사용 범위와 요약용 신규 UI를 구분하여 QA 보고한다.

로컬 OS의 설치된 한국어 음성을 사용해 요약을 합성하고 업로드 음성으로 등록했다. 외부 TTS API 또는 AI 음성 생성은 호출하지 않았다. 음성 대본은 요약 안내이며 상세 원문 전체 낭독이 아니다.

## 변경 범위 및 보존

새 샘플 전용 route·client component·metadata parser와 좌표·테스트만 추가했다. 기존 작성·저장 API, reader, Composition 저장, 인증, 발행, Storage 정책을 변경하지 않는다. C1 코드는 사용하지 않는다. PR #226/#229/#246–249/#255 및 stash 두 개를 보존한다. 고정 Staging만 새 head로 배포하며 Production 배포·환경설정은 유지한다.
