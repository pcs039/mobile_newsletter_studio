# 공식 발행 취소와 공개 파일 캐시

2026-10-19, PR #230 후속 보정. Production 미적용.

## 원인과 조사 범위

서버의 프로젝트 조회는 `cache: no-store`이고 published 조건을 검사한다. 하지만 그 서버 검사 이전에 브라우저/CDN이 응답을 재사용할 수 있었다. 실제 fixed Staging 격리 프로젝트를 발행하여 같은 URL을 warm한 뒤 atomic unpublish를 수행했다. 이후 쿠키 없는 Node HTTP 요청에서 다음을 관찰했다(임의 cache-busting query 없음).

| 경로 | 이전 정책 | 취소 후 관찰 |
| --- | --- | --- |
| 공개 이미지 / 업로드 음성 | public, max-age=300 | 200, HIT, Age 209 / 206 |
| 기사 음성 manifest | max-age=60, stale-while-revalidate=300 | 200, STALE, Age 201 |
| 기사 음성 조각 | max-age=31536000, immutable | 200, HIT, Age 198 |
| e-book 페이지 이미지 | max-age=3600, stale-while-revalidate=86400 | 200, HIT, Age 196 |
| e-book 음성 manifest / 조각 | 60+stale / 1년 immutable | 200, STALE / HIT |
| e-book 원본 PDF | public, max-age=300 | 200, HIT, Age 190 |
| Canva/GPT/Composition 디자인 mapper | private, no-store | 기존 검사 유지, CDN 헤더 명시 보강 |

Vercel은 stale 지시어를 CDN에서 소비해 브라우저 헤더에서 제거하기도 한다. 따라서 외부 헤더에 stale 지시어가 없어도 실제 `X-Vercel-Cache: STALE`을 함께 확인한다. `Age`, `X-Vercel-Cache`, 동일 URL 및 별도 쿠키 없는 요청을 기록해 서버 세션과 구분했다. 기존 브라우저의 캐시된 이미지 재표시도 확인했다.

## 최소 보정

`revocable-file-cache.ts`의 응답 마무리 helper를 공개 파일 handler 7개에서 사용한다. 기존 인증/ownership/승인/활성/발행 조건, Storage fetch, status/content type/body, 음성 재생 구조는 변경하지 않는다.

- `Cache-Control: private, no-store, max-age=0`
- `CDN-Cache-Control: no-store`
- `Vercel-CDN-Cache-Control: no-store`

성공뿐 아니라 권한 오류/404/503에도 적용하여 오래된 200 및 비공개 404가 재발행을 방해하지 않도록 한다. Vercel 전용 헤더는 CDN이 소비하므로 외부 응답에 그대로 보이지 않을 수 있다. 공용 폰트는 프로젝트 발행 파일과 구분하여 기존 정책을 유지한다. 폰트 query를 추가해 디자인 응답의 no-store를 우회할 수 없다. 관리자 preview/기관 검수/시연 파일은 기존 접근 검사를 유지한다.

현재 이미 private no-store인 Canva/GPT 원본과 AVIF/WebP 응답도 public file wrapper를 거친다. 변환의 크기/품질/메모리 재사용 로직은 바꾸지 않는다. 기사/발행 상태 변경은 기존 RPC만 사용한다. migration/API/dependency 추가 없음.

## 배포와 기존 캐시의 한계

새 헤더는 **서버로 도착하는 새 요청**에 적용된다. 배포 전 브라우저가 저장한 fresh 응답이나 이미 다운로드한 bytes는 서버에서 소급 회수할 수 없다. 특히 이전 immutable 음성은 그 TTL을 새 헤더만으로 단축할 수 없다. 뒤로가기 메모리 화면 역시 새 외부 요청과 다르다. 새 배포의 CDN 응답을 검증하되 브라우저 캐시 삭제나 임의 URL query로 통과시켰다고 보고하지 않는다.

Vercel CDN cache는 deployment별이며 새 배포에서 no-store를 확인한다. 추후 Production rollout에서도 기존 캐시 잔존 기간과 이미 전달된 bytes의 회수 불가를 별도 안내해야 한다. 모든 이전 클라이언트의 즉시 삭제를 요구한다면 헤더 보정만으로 충족할 수 없으며 별도 전달 계약 검토가 필요하다.

## 성능 영향

취소 가능한 URL은 발행 중에도 CDN/browser positive cache를 쓰지 않는다. 반복 요청마다 현재 권한 조회와 파일 전송이 필요하므로 지연, function 호출, Storage egress가 증가한다. 원본 파일/해시/provenance/Storage path와 이미지 반응형 변환 정책은 보존한다. 불변 파일의 내부 바이트 캐시를 추후 검토하더라도 권한 확인은 그 앞에서 매 요청 수행해야 한다.

공용 앱 JS/CSS 및 폰트 정책은 그대로다. 공개 콘텐츠의 기관 승인 방식과 작성자 직접 방식에 동일한 파일 접근 정책을 적용하고 시연/검수의 private no-store 계약은 변경하지 않는다.

## 검증과 안전 경계

- 새 회귀 8개: 7 handler의 publish→private→publish 동일 URL, 실패 응답, body/type 보존, 디자인 gate, 폰트 예외 및 query 우회 차단.
- 전체 424/424, TypeScript/lint/Webpack build/diff check 확인. 기존 warning 3개 외 신규 warning 없음.
- fixed Staging의 새 격리 프로젝트에서 이미지, 합성 Canva provenance 디자인, 합성 기사/e-book 음성, e-book 페이지/PDF를 검증한다. 외부 생성 API를 사용하지 않는다. 실제 관찰 상태/헤더와 E2E 정리 digest는 PR 검증 기록에 남긴다.
- Production/무안군 데이터 변경·migration·발행 없음. PR #226/#229와 stash 2개 보존. PR #230은 OPEN, Production rollout은 별도 승인.

공식 참고: [Vercel cache-control](https://vercel.com/docs/caching/cache-control-headers), [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache).
