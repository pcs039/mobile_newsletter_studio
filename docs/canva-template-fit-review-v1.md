# Canva 대표 템플릿 제작 전 검토 v1

기준 main: `0029fc9fff5f97223e7feccb18556ef032a8ba68`. 이번 변경은 기존 content-fit 관찰 근거의 표시와 읽기 전용 재점검만 보강한다. 기사·이미지 자동 수정, 신규 생성, 템플릿 변경, gate 해제, 원격 DB/Storage 변경은 하지 않는다.

## 근거와 대상 선정

| 대표 후보 | 확인된 Autofill 필드 | 이번 지원 범위 |
| --- | --- | --- |
| 행사 `event_festival_02` / `EAHXxCyfpSI` | TITLE, CTA, EVENT_PLACE, EVENT_DATE, EVENT_SUMMARY / MAIN_IMAGE | 기존 관찰 입력 4건에 근거한 글자 수·명시적 줄수 보고 |
| 정책 `policy_support_01` / `EAHXyJEkAsQ` | PRIMARY_VALUE, SUMMARY, TARGET, METHOD, PERIOD, CATEGORY, CTA, SUPPORT_CONTENT, NOTICE, TITLE / MAIN_IMAGE | 필드 계약만 확인. 글꼴·텍스트 상자 폭/높이·길이 관찰 근거가 없어 content-fit 미지원 유지 |
| 인터뷰 `interview_person_01` / `EAHXxtPWwK0` | TITLE, CATEGORY, SUMMARY, CTA, PERSON_NAME, POSITION, QUOTE / MAIN_IMAGE | 필드 계약만 확인. 제목·인물·인용문 영역의 실제 용량 근거가 없어 content-fit 미지원 유지 |

필드명 근거는 `src/lib/canva-template-registry.ts`, 원문 연결은 `canva-autofill-payload.ts`다. 필드 등록/데이터 완전성은 시각 품질 검증과 다르다. 정책·인터뷰 및 다른 행사 템플릿에 행사 02의 기준을 복사하지 않는다.

기존 `docs/canva-content-fit-v1.md` 및 `tests/fixtures/canva-content-fit-calibration.json`의 short/medium/long/boundary 결과만 사용한다. 원격 Canva API로 규격을 추가 조회하거나 제작하지 않았다.

| 행사 02 필드 | 관찰한 안전 글자 수 | 명시적 줄수 |
| --- | ---: | ---: |
| TITLE | 8 | 2 |
| EVENT_DATE | 11 | 2 |
| EVENT_PLACE | 9 | 2 |
| EVENT_SUMMARY | 21 | 1 |
| CTA | 24 | 1 |

이 수치는 범용 최대 용량이 아니다. Unicode code point 기준으로 공백·개행을 포함한다. 동일 글자 수라도 문자·글꼴·자동 줄바꿈에 따라 결과가 다르다. 기존 CRLF 정규화만 유지하며 자동 요약·절삭·수치 변경을 추가하지 않는다. 부제/본문 전용 영역 검증은 해당 프로필에 없고 요약만 검사한다.

## 이미지의 확인 사실과 미확인 범위

기존 `readCanvaBackground`는 같은 프로젝트의 승인·활성 GPT 배경 PNG를 검증하고 3:4 원본만 허용한다. 서버가 이미 읽고 검증한 파일의 실제 width/height만 진단에 포함한다. 새 파일 다운로드 경로나 이미지 분석 라이브러리를 추가하지 않는다.

3:4는 기존 **소스 입력 계약**이다. MAIN_IMAGE 슬롯의 실제 폭/높이, cover/contain, 크롭 앵커, 최소 해상도·Retina 요구치는 확인되지 않았다. 따라서 가로·세로·저해상도 이미지에 대해 슬롯 적합성 또는 잘림 없음으로 판정하지 않는다. 30×40도 3:4일 수 있으므로 비율 충족과 선명도 통과를 구분한다. 화면에는 항상 이미지 적합성 미확인을 표시하며 실제 Canva 결과의 피사체·가장자리·확대 선명도 확인을 안내한다.

## 화면과 재확인 계약

추천 템플릿 선택 후 기존 제작 영역에서 검토 기준을 표시한다. 일반 Preview/Production은 현 기사 입력을 검사한 것처럼 표시하지 않으며 기존 Staging gate를 유지한다. Staging의 기존 prepare 응답에 글자 수·줄수·판정·확인된 원본 크기만 추가한다. 원문·Canva 이미지 ID·Storage 경로·실행 payload는 진단 DTO에 넣지 않는다.

수정 후 기사 저장 → ‘저장된 기사 다시 점검’은 기존 prepare만 호출한다. 중복 클릭을 막고 생성 요청·결과 재생을 하지 않는다. 요청 실패 시 이전 confirmation과 성공 판정을 폐기하고 재점검을 허용한다. 생성 제출 후에는 재점검 버튼을 숨기며 기존 requestKey·결과 검토·PNG import·승인·적용 흐름을 유지한다. 기사 전환 시 기존 key/abort 계약을 재사용한다.

## 검증과 후속 조건

- 관찰 fixture, 긴/짧은 제목, 특수문자·명시적 줄바꿈·CRLF, 원문/payload 불변, 정책·인터뷰 미지원 검증
- 가로·세로·저해상도·잘못된 크기에서 허위 적합 판정 없음
- 재확인 prepare-only, 중복 클릭, 실패 후 기존 confirmation 무효화와 재시도, 기존 실행/검토/import 회귀
- 전체 테스트·TypeScript·lint·Webpack build·diff check 및 가능한 Preview 안내 QA

이번 작업은 실제 Canva 제작·이미지 잘림·출력 선명도 E2E가 아니다. 정책/인터뷰 지원 확대에는 실제 템플릿 관찰 자료, 이미지 검증에는 슬롯 geometry·채우기 방식·최소 해상도 근거가 먼저 필요하다. 이후 유료 제작/설정 변경이 필요하면 별도 승인을 받는다. 공통 Storage·이미지 전달·TTS 파일과 독립 발행 PR은 변경하지 않는다.
