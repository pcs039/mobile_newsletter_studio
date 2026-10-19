# 폰트 다중 파일 등록 v1

## 흐름과 재사용

로컬 ZIP 해제 → 파일/폴더 선택 → 파일별 분류 확인 → 명시적 등록 → 기존 공통 폰트 라이브러리.

- 기존 ZIP·단일 파일 등록과 활성화 계약은 유지한다.
- `font_families` / `font_assets`와 기존 `font-css`의 패밀리 선택·굵기별 @font-face를 재사용한다. 새 테이블·migration은 없다.
- 기사 작성 페이지의 기존 폰트 조회 결과와 프로젝트 기본 글꼴 prop 누락을 연결한다. 기사 저장/발행/renderer 계약을 바꾸지 않는다.
- fontkit 2.0.4의 메타데이터 판독만 사용한다. 별도 ZIP·중첩 ZIP·폰트 변환·범용 분류 엔진은 만들지 않는다. [공식 문서](https://github.com/foliojs/fontkit)

## 선택·분류

- TTF/OTF/WOFF/WOFF2, 파일당 16MiB, 선택당 최대 500개. 순차 분석·등록하여 모든 압축 해제 결과를 메모리에 보관하지 않는다.
- `webkitdirectory`가 있는 브라우저는 하위 폴더를 포함한다. 지원하지 않으면 다중 파일 선택을 사용한다.
- 경로 구분자와 NFC를 정규화한다. ZIP/TTC/문서/숨김·OS 메타파일은 제외한다.
- 파일명·확인된 Naver 약어와 내부 family/subfamily/OS2를 대조한다. 충돌 시 확인이 필요하다. 실제 나눔고딕·명조 Bold 파일명 700 / 내부 600도 자동으로 확정하지 않는다.
- fvar/가변 축이 있으면 정적 400으로 등록하지 않고 제외한다.
- 동일 패밀리/굵기/스타일/릴리스의 파일은 대체 형식 후보로 표시한다. WOFF2 → WOFF → TTF → OTF 순으로 하나를 기본 선택한다. converter build 문자열은 릴리스 번호와 분리한다. 서로 다른 버전은 묶지 않는다. 후보 판정은 바이너리 동일성이나 모든 글리프의 동등성을 보증하지 않는다.
- 사용 조건은 기존 웹폰트/상업 사용/활성화 입력을 재사용한다. 라이선스 자동 판정·승인 시스템은 없다.

## 직접 업로드와 보안

`POST /api/font-batch`의 prepare/complete가 기존 관리자 인증과 same-origin 검사를 사용한다.

1. 서버가 경로를 정하고 `upsert:false` signed upload를 발급한다. 서비스 키는 브라우저에 전달하지 않는다.
2. 기존 비공개 `design-intake-assets`의 `font-batch-v1/<user-derived-id>/<hash>.<ext>` 경로에 octet-stream으로 직접 업로드한다.
3. 사용자·해시·파일 크기·분류·사용 조건·30분 만료를 HMAC 등록 토큰으로 묶는다. Storage 자체 signed URL의 수명과 등록 토큰의 수명은 별개다.
4. 서버가 제한된 크기로 실제 바이트를 읽고 SHA-256, 시그니처/확장자, 컨테이너 크기, 내부 메타데이터, 가변 여부와 확인 필요 여부를 재검증한다.
5. 검증 후에만 공개 `fonts/batch-v1/<hash>.<ext>`로 저장하고 기존 테이블에 등록한다. 파일 자체는 Next 요청 본문을 통과하지 않는다.
6. 성공 후 해당 사용자의 임시 파일만 삭제한다. 삭제 응답 실패가 성공한 폰트 등록을 되돌리지는 않는다. 실패한 임시 파일은 비공개로 남을 수 있으며 신규 자동 정리 작업은 추가하지 않았다.

Staging 실제 조회에서 기존 intake는 private/50MiB/octet-stream 허용, fonts는 public/80MiB/font MIME 허용이다. **버킷·정책 변경은 없다.** 구성 누락/불일치 시 실패하며 버킷을 자동 생성·수정하지 않는다. 16MiB는 애플리케이션 prepare/finalize 양쪽에서 검증하며, Storage 자체 제한은 기존 버킷 제한이다.

## 중복·부분 실패

- 해시 기반 immutable 경로와 결정적 font asset ID, 패밀리/릴리스 기반 family ID 및 기존 PK 충돌 처리로 동일 파일·동시 finalize가 새 파일/row를 만들지 않는다.
- 이미 등록된 바이너리는 현재 저장된 결과를 재사용한다. 재등록으로 기존 분류나 사용 조건을 덮어쓰지 않는다.
- Storage/두 테이블 전체를 하나의 원격 트랜잭션으로 묶지는 않는다. 중간 실패 시 안정적인 동일 경로/ID로 재시도하여 복구한다.
- UI는 성공 파일을 제외하고 실패 파일만 재시도한다. finalize 응답 유실이면 기존 등록 토큰으로 결과 확인을 먼저 한다. 자동 재시도는 없다.
- 기존 ZIP/단일 업로드 경로로 이미 등록된 파일에는 콘텐츠 해시 인덱스가 없으므로, 해당 legacy 파일과의 전역 해시 중복 제거는 이 v1에서 보증하지 않는다.

## 실제 Staging QA

- 로컬 앱은 `.env.staging.local`의 Supabase ref `mvrkpmffuhcqwisqvpqi`만 사용했다. Production 쓰기는 없다.
- 실제 Naver 나눔고딕/명조 Regular/Bold 4건 → 패밀리 2개 등록. TTF/OTF 대체 형식 기본 선택 및 가변 제외 확인.
- Naver 공식 WOFF/WOFF2의 실제 메타데이터 분석도 통과했다. 이 두 파일은 추가 업로드하지 않았다.
- 실제 폴더 선택으로 한글 경로의 TTF/OTF 하위 폴더를 탐색했다. Windows 경로·NFC 및 미지원 브라우저 fallback은 자동화 테스트로 검증했다. 실제 Windows OS 실행 검증은 하지 않았다.
- 실제 HTTP: 미인증 401, 일반 작업자 403, 교차 Origin 403.
- 기존 샘플 기사 `27fa46d7-cc52-450f-99a8-ba164dba8b19`의 제목=나눔고딕, 본문=나눔명조를 기존 편집 UI로 저장했다. 다른 기사 및 원문 값은 변경하지 않았다.
- 관리자 저장본 iframe의 CSS font family와 최대 글자 확대를 확인했다. 제목의 기존 900 굵기는 등록된 700 face와 브라우저의 기존 굵기 선택 계약을 따른다. 새 굵기 선택 UI는 추가하지 않았다.
- 기존 직접 발행 API로 테스트 프로젝트만 공개하여 fixed Staging의 쿠키 없는 reader 200, 고딕/명조 폰트 파일 200(4,691,820 / 3,839,464 bytes), CSS 패밀리 일치를 확인했다.
- 공개 QA 후 발행 취소하여 private로 돌렸다. 발행/취소 이력은 남는다. 등록 폰트 4건과 샘플 기사의 폰트 선택은 후속 QA용으로 보존한다.
- 390/768/1440px overflow 0, 공개 reader console error 0. 기존 ZIP 화면은 유지한다.
- 부분 실패·응답 유실·동시 등록·재시도는 자동화 테스트로 검증한다. 원격 DB 장애를 인위적으로 발생시키지는 않았다.
- 최종 Staging 조회: font assets 4 / families 2 / fonts 파일 4 / 성공 후 잔여 임시 파일 0 / 프로젝트 private. 동일 파일을 재등록해도 개수가 늘지 않았다.
- 신규 21개 및 격리 PGlite SQL 회귀를 포함한 전체 463/463 통과. TypeScript/lint/Webpack build/diff check 통과. 기존 lint warning 3개, 신규 0개.
