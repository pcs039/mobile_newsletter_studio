/* eslint-disable @typescript-eslint/no-require-imports -- Render guidance without network or data mutations. */
const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const load = require('./canva-test-loader.cjs')();
const { ArticleVisualDirectorResult } = load('src/components/design/article-visual-director-result.tsx');
const { DesignSaveSummary } = load('src/components/design/design-save-summary.tsx');
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

test('design guidance keeps hybrid recommendations and blocked-input reasons distinct from completion', () => {
  const html = render(ArticleVisualDirectorResult, { result: {
    primaryStrategy: 'hybrid', secondaryStrategy: 'html_first', reasons: ['실제 사진과 정보 조합'],
    needsRealPhoto: true, humanInputRequired: true, humanInputReason: '기관 사진 필요', adobeTasks: [],
  }, children: React.createElement('p', null, '기존 결과와 오류 유지') });
  for (const label of ['기관 사진 활용', '정보 중심 HTML 디자인', 'Canva 디자인', 'GPT 이미지 기반 배경',
    '추천 단계', '아직 생성하거나 기사에 적용한 결과가 아닙니다', '기관 사진 필요', '기존 결과와 오류 유지', '고정 Staging']) assert(html.includes(label), label);
  assert(!html.includes('<button')); // guidance has no generation/apply action
  assert(!html.includes('<details open'));
});

test('placement receipt reflects saved state, not unsaved local selection or public approval', () => {
  const saved = { status: 'draft', assets: [{ id: 'p', slot: 'hero_background', assetId: 'draft', isVisible: true }] };
  const state = { saved, composition: { assets: [{ assetId: 'local' }] }, textStatus: 'dirty', layoutStatus: 'error', error: '연결 확인 실패', canRetryLayout: true };
  const assets = [{ id: 'draft', name: '등록된 배경', approvalStatus: 'draft', isActive: true }, { id: 'local', name: '미저장 후보', approvalStatus: 'approved', isActive: true }];
  const html = render(DesignSaveSummary, { state, assets });
  for (const label of ['등록된 배경', '등록됨 · 승인 필요', '배치됨', '공개 완료가 아닙니다', '변경사항 있음', '저장 실패', '로컬 입력은 유지', '다시 저장', '구성 작성 중']) assert(html.includes(label), label);
  assert(!html.includes('미저장 후보'));
  assert(!html.includes('기본 표시 조건 충족'));
});

test('approved, hidden, inactive, unsupported and missing placements keep independent display conditions', () => {
  const assets = [{ id: 'a', name: '승인 자산', approvalStatus: 'approved', isActive: true }, { id: 'b', name: '중지 자산', approvalStatus: 'approved', isActive: false }];
  const saved = { status: 'ready', assets: [
    { id: '1', assetId: 'a', slot: 'hero_background', isVisible: true },
    { id: '2', assetId: 'b', slot: 'hero_illustration', isVisible: false },
    { id: '3', assetId: 'a', slot: 'title_icon', isVisible: true },
    { id: '4', assetId: 'missing', slot: 'footer_banner', isVisible: true },
  ] };
  const html = render(DesignSaveSummary, { assets, state: { saved, textStatus: 'saved', layoutStatus: 'saved' } });
  for (const label of ['등록됨 · 승인됨', '배치됨 · 숨김', '비활성', '미지원 슬롯', '자산 정보 확인 필요', '기본 표시 조건 충족 · 저장본 미리보기에서 확인']) assert(html.includes(label), label);
});
