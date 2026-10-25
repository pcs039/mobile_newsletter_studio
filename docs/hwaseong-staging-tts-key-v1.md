# 화성시 Staging TTS 전용 키 분리

기준: PR #270 `8823d4a06bb260403a0ffe0c14a6f4cd0d1343c6` 기반 후속 stacked PR. Production 및 기존 PR에는 병합하지 않는다.

## 키 선택 계약

- 화성시 시연의 모델 접근 GET, 설정 존재 여부, 실제 speech 호출은 서버 전용 `sampleTtsApiKey()`가 선택한 `STAGING_OPENAI_API_KEY`만 사용한다.
- Staging 환경 식별자·Supabase ref·고정 도메인·프로젝트·관리자·same-origin 검사는 그대로 유지한다.
- 전용 키 누락/공백/인증 거절 시 `OPENAI_API_KEY`로 대체하지 않는다. 키 누락은 생성 claim 전에 거절하고, 인증 거절은 추가 provider 호출 없이 기존 결과 불명 보호를 유지한다.
- 공통 `requestOpenAiSpeech(input, voice, model)`의 기존 3개 인자 호출은 일반 `OPENAI_API_KEY`와 기존 모델/본문/오류 계약을 그대로 사용한다.
- Staging 전용 호출만 네 번째 서버 인자 `{ apiKey }`를 전달한다. 명시적 null/빈 키는 실패로 처리하며 기본 키를 읽지 않는다. 별도 키를 전달한 호출에서는 제공자 원문 오류를 반환하지 않아 키가 에러에 반사되는 경우도 차단한다.
- 키는 DB·클라이언트 props·응답·로그·문서에 기록하지 않는다. 환경변수 값 자체는 조회하거나 수정하지 않는다.

## 이번 작업의 원격 검증 제한

실제 음성 생성, speech API 호출, pending 요청 재시도, DB/Storage 쓰기, 파일 삭제/교체, migration 및 Production 배포는 하지 않는다. 고정 `staging` 브랜치의 Preview 재배포 후 관리자 전용 모델 접근 확인(GET `/v1/models/gpt-4o-mini-tts`)만 실행한다. 이 결과는 음성 생성·과금 한도·한국어 음질 검증을 뜻하지 않는다.

기존 pending 요청 `e2041281-42e2-5363-a329-43db98714355`는 읽기 전용 전후 비교 대상으로 유지한다. 인증 성공 후에도 자동 재개하지 않는다.

## 로컬 검증

- 모의 speech·Staging 요청 테스트 19/19: 일반 키 유지, 별도 키 전달, null/빈 키의 무대체, 인증 실패 후 무재시도, 키 오류 원문 차단, 모델 확인과 생성의 동일 키 사용.
- 전체 685/685, skip 0.
- TypeScript, lint(기존 경고 3개), Webpack build, diff check 통과.
- 테스트는 가상 키와 모의 네트워크만 사용하며 실제 speech API·원격 쓰기를 실행하지 않는다.

참고: [OpenAI 인증](https://developers.openai.com/api/reference/overview), [모델 조회](https://developers.openai.com/api/reference/resources/models/methods/retrieve).
