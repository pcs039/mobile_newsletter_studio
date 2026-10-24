# 화성시 7건 시연본: 원본 충실도 최소 보정

PR #263의 `349310c50834f63d72e2e6ca5b9f45f6ee82197e`에서 분기했다. PR #261/#262/#263은 변경하거나 병합하지 않는다. 대상은 Staging의 비공개 `hwaseong-2026-10-samples` 프로젝트뿐이다. 최신 운영 정보로 전체 기사를 다시 만드는 작업이 아니다.

## 03: 과거 행사와 원문 유지

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 기사 제목·본문 | 「10월 화성, 시민과 함께 즐기는 축제의 달」 | 동일 |
| 요약의 행사명 | 루나빛축제·안곡서원 문화제·노작홍사용창작연극제 | 기존 작업본 표기 그대로 유지 |
| 이미지 | 호수의 빛·전통 건축·무대 일러스트 | 동일, 새 행사 이미지로 교체하지 않음 |
| 요약 안내 | 현재 행사 소개처럼 읽힐 수 있음 | `2026년 10월호 작업본의 행사 소개를 재구성한 시연입니다. 현재 신청·참여 안내가 아닙니다.` |
| 상세의 자료 안내 | 일반적인 최신 조건 확인 안내 | 당시 행사명·내용·서술을 보존한 자료이며 현재 신청·참여 안내가 아님을 명시 |

원문은 이전에 확보한 기사 `e57fefc3-2fba-4303-8621-652ebb389e66`이다. DB 입력일은 2026-10-12이며, 공식 인쇄물 발행일 증빙은 아니다. 시연 제작 시점(2026-10-25 KST)과 자료 작성 시점을 구분한다. 기존 작업본에 날짜가 없는 행사의 날짜·장소·예약 가능 여부를 새로 만들어 넣지 않았다. 「창작연극제」 등의 원문 표기를 공식 행사명 검증 완료로 재분류하지 않는다. 지난 행사라는 이유로 삭제하거나 다른 최신 행사로 교체하지 않았다. 추가 행사 조사·재제작은 하지 않았다.

## 04·05: 확인 근거 없는 입장 절차 정정

### 확인 자료

- [개장 안내, 동물보호과, 2026-05-27](https://www.hscity.go.kr/www/user/bbs/BD_selectBbs.do?q_bbsCode=1183&q_bbscttSn=20260527152526702)
- [하절기 운영 안내, 2026-06-15](https://www.hscity.go.kr/www/user/bbs/BD_selectBbs.do?q_bbsCode=1051&q_bbscttSn=20260615144659752)

두 자료에서 동물등록 반려견, 만 13세 이상 보호자 동반, 무료 이용을 확인했다. QR 입장 필수 조건은 확인하지 못했다. QR 설명은 이미 확보한 기사 작업본에도 있었으므로 이번 감사로 그 작성 주체나 AI 생성 여부까지 확정하지 않는다. Production 원본은 수정하지 않고 Staging 복제본의 해당 문장만 정정한다.

개장 안내는 09–18시와 운영기간·휴무일을, 6월 안내는 **하절기** 07–21시 확대 및 탄력 조정 가능성을 설명한다. 하절기 시간이 10월에도 유효하다고 단정하지 않는다. 독자에게 현재 시간·휴무일은 공식 공지에서 다시 확인하도록 안내한다. 이번에는 시간표를 새로 구현하거나 현재 운영시간을 추정해 입력하지 않는다.

| 위치 | 변경 전 | 변경 후 |
|---|---|---|
| 04·05 article.body 및 상세 본문 블록 | `이용객은 반려견 등록 후 QR코드를 통해 입장할 수 있으며, 별도의 복잡한 절차 없이 편리하게 이용할 수 있다.` | `동물등록을 마친 반려견과 만 13세 이상의 보호자가 함께 무료로 이용할 수 있다.` |
| 상세 본문 블록 제목 | `기존 10월호 원문 · 그대로 보존` | `10월호 작업본 · 이용 조건 정정` |
| 05 한국어 요약 | `등록 후 QR 입장` | `동물등록 · 보호자 동반` 및 등록 반려견·만 13세 이상 보호자·무료 설명 |
| 05 영어 요약 | `Register your dog, then enter with a QR code.` | `A registered dog must be accompanied by a guardian aged 13 or older. Admission is free.` |
| 05 영어 상세 | 원문의 QR 입장 번역 | 등록·보호자 연령·무료 조건으로 정정, 운영시간·휴무일은 공식 공지 확인 |
| 04·05 자료 안내/메타데이터 | 원문을 수정하지 않았다는 일반 안내 | 입장 조건만 정정했음을 명시, 두 공식 출처와 자료 게시일 기록 |
| 05 이미지 | 왼쪽 안내판에 `QR` | 글자 없는 안내판의 파생 이미지. 장면·색상·한영 제목은 유지 |

기존 04 확정 만평(3차 이미지)에는 QR 문구·표지판이 없어 변경하지 않았다. 03·04·05 저장 음성 대본에는 QR 설명이 없어 파일·대본·음성 행을 변경하지 않았다. 04의 내용 불일치 음성 숨김 정책도 유지한다. 기사 제목·요약 필드·기존 만화 대사와 나머지 원문은 유지한다. 보정 후 활성 본문·영문·메타데이터에서 QR 입장 설명 잔존 여부를 검사한다. 원본 백업·이 문서의 변경 전 기록·파일명 `no-qr`은 현재 이용 절차로 노출되는 정보와 구분한다.

### 이미지 제작 기록

기존 `/private/tmp/hwaseong-samples-v2/accessible.png`를 시각 확인한 뒤 내장 OpenAI `image_gen` 편집을 **1회** 사용했다. Canva 새 생성이나 기존 다섯/일곱 이미지 재생성은 하지 않았다. 기존 QR 포함 Storage 객체를 삭제·덮어쓰지 않고 새 private 경로에 WebP를 저장한다. 기존 자산 ID와 이미지 블록 ID는 유지하고 표시 참조만 새 파생 파일로 연결한다.

- [편집 결과 PNG](assets/hwaseong-samples/accessible-no-qr-v1.png): 1,400,992B, 1469×1071
- [모바일 WebP](assets/hwaseong-samples/accessible-no-qr-v1.webp): 35,094B, 1000×729, quality 90
- 원본은 이전 로컬 파일·Storage 경로 모두 유지. 파생 파일의 SHA-256·MIME·해상도 및 업로드 후 재다운로드 해시를 확인한다.

실제 편집 프롬프트:

```text
Use case: precise-object-edit. Edit target: the supplied existing mobile newsletter illustration. This is a minimal factual correction, NOT a new design. Change ONLY the two blue Latin letters 'QR' inside the cream rectangular sign on the left. Erase those two letters and leave that same cream sign completely blank. Keep the existing illustration otherwise unchanged: same composition and dimensions/aspect ratio, same Korean headline '함께여서 더 좋은 산책', same English headline 'HELLO, NEIGHBOURS', same waving person, same dog, same trees, same sun, same blue/cream/green palette, same simple flat illustration style. No new text, no new icons, no QR code, no new entry procedures, no new objects. Preserve the sign frame and all other elements. Produce one corrected derivative only.
```

생성 편집은 픽셀 단위로 나머지 영역이 동일함을 보장하지 않는다. 동일한 장면·정보 위계·스타일을 시각 비교했고, 기존 원본은 별도 보존했다.

## 관광지도 버튼

요약의 장소 카드 `지도·길찾기 열기`와 상세 6곳의 `길찾기`를 **`지도에서 장소 찾기`**로 바꾼다. 기존 Kakao `/link/search/` 목적지는 그대로다. 경로 계산·내비게이션 기능을 새로 구현하거나 검증했다고 안내하지 않는다. 주소·전화·좌표·관광지도 원본은 변경하지 않는다.

## 안전한 적용·검증

Staging DB ref `mvrkpmffuhcqwisqvpqi`, 정확한 프로젝트 UUID·slug·private 상태·기존 private 버킷을 확인한다. 변경 전 모든 기사·블록·음성·Composition·자산 행과 기존 파일 해시를 저장한 뒤 허용된 필드만 수정한다. `updated_at` 비교로 동시 변경이 발견되면 중단한다. 새 객체는 `upsert=false`로 저장하고, 재요청은 기존 객체 해시를 검증한다. Storage와 여러 DB 변경이 하나의 원자적 트랜잭션이라고 가정하지 않는다. 변경 전후 필드별 기록·진행 기록·재조회로 부분 완료를 확인한다. 임의 삭제·자동 롤백을 하지 않는다.

- 유지: 기사 7건 ID·정렬·제목·draft 상태, 표지 설정, Composition 7건, 기존 음성 5건, 01·02·06·07의 모든 데이터.
- 수정: 04·05 기사 body 2건, 03·04·05 블록 7건, 05 자산 참조 1건. 새 private WebP 객체 1개. 신규 기사·새 자산 DB 행 없음.
- 기존 이미지/음성 객체 20개를 변경 전후 재다운로드해 바이트 해시 비교. 05의 이전 PNG도 보존.
- 관련 렌더링 테스트: QR 절차 제거·공식 이용 조건·행사 원문 유지/시점 안내·지도 검색 버튼 의미 및 전화 링크 수 확인.
- 전체 격리 회귀: **633/633, skip 0**. TypeScript 통과. lint 오류 0, 기존 경고 3. Webpack build 통과. 원격 migration·운영 API·공개 reader 변경 없음.
- 원격 브라우저 검수·화면 캡처·배포 head는 이 후속 PR의 최종 QA 기록과 완료 보고에 별도로 남긴다. 로컬 성공을 원격 성공으로 대체하지 않는다.

Production DB·Storage·기사·발행 상태·배포·인증·환경변수는 변경하지 않는다. 기존 OPEN PR 및 stash 2개를 보존한다. C1 코드를 사용하지 않는다.

## 인수 잔여 조건

06 사진의 권리와 Canva 템플릿/요소 이용 조건은 별개다. 기존 파일은 보존하지만 허가를 받은 것으로 표시하지 않는다. 외부 공개·캡처 전달·재배포는 승인하지 않는다. 외부 제안 버전에는 권리자의 명시적 허가, 적법한 대체 사진/디자인, 또는 해당 콘텐츠 제외 중 하나가 필요하다.

기존 실제 기기 UAT 23개 항목은 유지한다. 지도 앱 전환·복귀, 전화 연결 확인 화면, 영상 재생·중단, 최대 글씨, 회전·스크롤, 표지·기사 이동은 실제 iPhone/Android에서 확인하기 전까지 **미실시**다. 브라우저 콘텐츠 폭 390/520 검수는 실기기 합격이 아니다. 현재 과거 자료 시연에 맞게 QR·행사 관련 확인 항목의 기대값만 정정하며 실기기 체크를 대신 채우지 않는다.
