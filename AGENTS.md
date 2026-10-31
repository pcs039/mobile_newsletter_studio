<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 데이터딕션 자율 개발 및 승인 정책

승인된 제품 목표와 작업 범위 안에서 코드 분석·수정·구현, 로컬/격리 DB 테스트, 빌드·lint·회귀 검증, 작업 브랜치 커밋·push 및 PR 생성·갱신을 자율 수행한다. 실패는 같은 범위에서 원인을 수정하고 재검증하며, 단계 완료 기준을 생략하거나 불필요한 기능으로 확장하지 않는다.

- 별도 Staging 테스트 프로젝트의 자료 생성·수정·검증은 가능하다. 복구 가능한 비파괴적 Staging 함수·코드 적용도 가능하되 실제 DB 신원, 정확한 변경 범위, 기존 데이터 영향과 복귀 방법을 먼저 확인한다.
- Production DB·Storage·배포 변경, main 병합, 기존 화성시 시연 7건의 기사·음성·디자인·공유 링크 변경, 운영 데이터 삭제·파괴적 migration, 실제 외부 공개 발행 및 고객 메시지·메일 발송은 사전 승인이 필요하다.
- 승인된 비용 한도를 넘는 유료 서비스, 보안 권한 확대·비밀키 노출 위험·복구가 어려운 변경은 사전 승인이 필요하다. 비용 한도가 정해지지 않은 신규 유료 호출이나 안전성 근거가 부족한 작업을 자동 승인하지 않는다.
- 기존 PR·브랜치·stash와 정상 자산을 보존한다. 결과 불명인 유료 요청을 자동 반복하지 않는다. 환경 불일치나 데이터 손상 위험을 발견하면 해당 쓰기를 멈추고 보고한다.
- 단계 완료 시 기능, 검증, 코드·DB·배포 범위, 남은 위험과 다음 단계 가능 여부를 보고한다. P2-A 적용 검증 후 별도 Staging 프로젝트의 P2-B를 수행하고, 완료 기준 충족 후 기존 AI 기능 통합 P3에 착수한다. R1-B나 범용 템플릿 등 무관한 개발을 재개하지 않는다.
- 공개 저장소에는 코드와 합성 테스트 결과만 기록한다. 키·쿠키·원문·실환경 점검 상세와 적용/복귀 대상 정보는 로그·PR에 게시하지 않으며 Git 제외 로컬 보고서에 보관한다.

이 문서는 제품 작업의 승인 범위를 기록한다. 실제 실행 권한·보안 경계는 Codex 설정과 접근 제어가 강제하며, 도구의 승인 거절을 우회하지 않는다.
