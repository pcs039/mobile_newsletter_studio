# DataDiction Newsletter Studio Login Setup

관리 시스템 로그인은 Vercel 환경변수로 사용자 ID와 비밀번호를 등록해 사용합니다.
실제 비밀번호는 GitHub 코드에 넣지 마세요.

## Required Environment Variables

### NEWSLETTER_AUTH_SECRET

로그인 쿠키 서명용 긴 임의 문자열입니다.

예시:

```text
change-this-to-a-long-random-secret
```

### NEWSLETTER_AUTH_USERS

관리자 1명과 사용자 3명을 JSON 배열로 등록합니다.

예시:

```json
[
  {
    "id": "admin",
    "password": "change-admin-password",
    "name": "관리자",
    "role": "admin"
  },
  {
    "id": "user1",
    "password": "change-user1-password",
    "name": "진준범",
    "role": "user"
  },
  {
    "id": "user2",
    "password": "change-user2-password",
    "name": "작업자2",
    "role": "user"
  },
  {
    "id": "user3",
    "password": "change-user3-password",
    "name": "작업자3",
    "role": "user"
  }
]
```

## Permission Rule

- `admin`: 모든 프로젝트 접근
- `user`: 프로젝트의 작업자명과 로그인 사용자 `name`이 같은 프로젝트만 목록 접근
- 프로젝트 비밀번호가 설정된 경우, 일반 사용자는 프로젝트 작업 화면 진입 시 비밀번호를 한 번 더 입력

예를 들어 `name`이 `진준범`인 사용자는 프로젝트 기본 정보의 작업자명이 `진준범`인 프로젝트만 목록에서 볼 수 있습니다.

## Project Password Columns

프로젝트별 비밀번호 기능을 사용하려면 Supabase SQL Editor에서 `supabase_project_password_management.sql`을 한 번 실행해야 합니다.

프로젝트 비밀번호는 평문이 아니라 해시 값으로 저장됩니다.
