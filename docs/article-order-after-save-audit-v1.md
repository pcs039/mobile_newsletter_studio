# 기사 수정 후 기본 순서 변경: 조사와 최소 보정

2026-10-19, main `0ec68061b16e28607b31094978495420d68ae817` 기준.

## 재현 범위와 분류

기존 Staging `canva-e2e-test` 4건을 재사용했다. Production은 무안군 기사 ID/sort_order/updated_at의 읽기 전용 조회만 수행했으며 저장/발행/취소/스키마 변경은 하지 않았다. Staging도 프로젝트 공개 상태를 바꾸지 않고 실제 공통 reader의 관리자 미리보기로 비교했다. 익명 발행 E2E로 보고하지 않는다.

A=`27fa46d7-cc52-450f-99a8-ba164dba8b19`, B=`06ca472a-7af2-4e4c-ab30-6bbbee6bf227`, C=`2179d3a1-26c5-4238-93c0-e42074bb8eb9`, D=`7ebdeffb-ccd0-454a-9771-22b102c11a81`.

| 단계 | B sort_order / updated_at (KST) | 관리자 | 공통 reader 기본 순서 |
| --- | --- | --- | --- |
| 기존 정상 순서 | 20 / 10월 15일 12:07:21.610178 | A B C D | A B C D |
| UI에서 B 본문만 수정·저장 | 20 / 10월 19일 21:21:07.229677 | A B C D | A B C D |
| 재현 준비: D만 40→20으로 임시 중복 (21:24:10.828710) | 20 / 위와 동일 | A D B C | A D B C |
| 다시 UI에서 B 본문만 수정·저장 | 20 / 21:24:44.079848 | **A B D C** | **A D B C** |

- **A (저장에 따른 sort_order 변경): 미재현.** 실제 v1.38 save RPC가 기존 `article.sort_order`를 유지한다. 정상화된 10/20/30/40에서는 본문 수정 후 이동하지 않았다.
- **B (표시 순서 변경): 동률 상태에서 관리자 3→2번째 이동 재현.** 변경된 것은 본문과 updated_at이며 B의 sort_order는 20 그대로다. reader는 이 저장에서 같은 이동이 재현되지는 않았지만 관리자와 다른 순서로 표시됐다. 공통 조회는 동률을 결정하지 않으므로 저장/실행계획 등에 대한 안정성이 없다. 모든 공개 목록 증상을 완전히 재현했다고 주장하지 않는다.
- **C (동적 정책): 이 재현의 원인 아님.** 네 기사는 모두 regular/normal/기관 중요도3이고 관심분야 미선택이다. 수시·긴급·유효기간·관심분야·기관 중요도 정책은 별도 회귀로 검증한다.
- 조사 시점 Production 무안군 기사 10건의 sort_order는 10~100으로 유일했다. 과거 상태/수동 순서 변경 이력은 이 snapshot으로 복원할 수 없다. 현재 Production 전체 현상이 동률 때문이라고 단정하지 않는다.

## 원인 코드

- `save_newsletter_article_atomic`: 기존 기사 UPDATE에서 `sort_order = article.sort_order`. 새 기사만 최대값+10 append. 수정 없음.
- `reorder_newsletter_articles_atomic`: legacy 동률의 반환 배열을 `sort_order, updated_at desc, id`로 정렬한다. 따라서 기사 저장 때마다 최신 기사가 같은 순서 그룹 위로 이동한다. snapshot 자체는 ID순 digest이며 정렬 배열과 분리되어 있다.
- `getProjectContent`: `order=sort_order.asc&order=updated_at.desc` 중복 query parameter. 실제 Staging에서는 관리자와 다른 동률 순서가 관찰됐으며, 하나의 명시적 복합 정렬로 정의해야 한다.
- `ProjectArticleList`: 최초 repository rows 뒤 order API 결과를 받아 교체한다. 두 결과의 동률 규칙이 다르면 표시도 달라진다.
- `getPublicOrderedArticles`: regular/관심 미선택에서는 입력의 기본 순서를 유지한다. shared repository의 모호한 동률을 그대로 받는다. 독립적인 수정시각 정렬을 추가하지 않는다.

## 최소 변경

`article-order.ts`에 `sortOrder → id` 기본 comparator와 단일 PostgREST order clause를 정의한다. ID는 변경되지 않으므로 이미지/디자인/음성/본문의 updated_at만 달라져도 위치가 바뀌지 않는다.

- 공통 repository: `order=sort_order.asc,id.asc` 하나로 조회하며 DTO도 같은 comparator로 정렬.
- 관리자 서버 adapter: 기존 RPC 응답의 표시 배열만 같은 comparator로 정렬. snapshot/duplicate/request key/입력 목록/updatedAt를 그대로 유지한다.
- 명시 reorder의 10/20/30 순서는 ID보다 우선하므로 드래그·위아래 조작의 결과를 바꾸지 않는다.
- DB 함수/migration/API/dependency/UI/공개 동적 정책 변경 없음. raw RPC의 기존 동률 표현은 서버 adapter에서만 정규화하며 RPC 권한은 service_role 전용 그대로다.

## 기존 순서 복구

유일한 sort_order가 저장된 기사는 데이터 복구가 필요 없다. legacy 중복/0인 기사는 원래 의도한 상대 순서를 알 수 없으므로 과거 updated_at로 추정 복구하지 않는다. 보정 후 동률은 ID순으로 한 번 달라질 수 있다. 원하는 순서는 관리자 목록에서 명시적으로 저장하여 고유 값으로 확정한다. 이 PR은 Production 데이터를 일괄 정규화하지 않는다.

Staging의 임시 중복 D=20은 검사 후 원래 40으로 돌린다. 기존 정보그래픽 QA 샘플 B의 본문은 이후 검증 재사용을 위해 원문으로 되돌린다. updated_at/일반 저장이 교체하는 block row ID는 과거 값으로 SQL 덮어쓰기하지 않는다. 새 fixture 생성/삭제나 자산/파일 삭제는 하지 않는다.

## 검증 계획과 경계

- 단위/통합: legacy 0·동률, 본문/이미지/디자인/음성의 수정시각 변화, repository query 중복 방지와 실제 mapper 정렬, admin RPC snapshot/명시 reorder receipt 보존, regular 기본 순서와 수시·긴급·관심분야 정책 회귀.
- 기존 실제 PGlite v1.38 저장/append/reorder/stale/ownership 회귀 포함 전체 테스트, TS/lint/Webpack build/diff check.
- 별도 PR Preview와 fixed Staging에서 동률 저장 후 관리자·공통 reader 기본 순서 일치, 정상 순서 복원 후 저장·새로고침 유지 확인. 실제 시각·head·최종 결과는 PR 검증 기록에 구분하여 보고.
- Production mutation/생성 API/발행 실행 없음. PR #226/#229와 stash2 원본 보존. 새 PR OPEN, merge 금지.
