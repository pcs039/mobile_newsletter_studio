/* eslint-disable @typescript-eslint/no-require-imports -- Render the actual component with local hook state; no provider/data writes. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const load = require('./canva-test-loader.cjs')();
function Primary() { return null; }
function Secondary() { return null; }
const article = { title: '중앙도서관 이용 절차', body: '시설명: 중앙도서관\n실제 시설 외관 방문 사진과 이용 절차입니다.\n1. 신청\n2. 확인\n3. 이용', summary: '', articleType: 'general', publicInfo: {}, blocks: [], links: [] };
const props = { article, articleId: '22222222-2222-4222-8222-222222222222', projectSlug: 'local', disabled: false };
function harness() {
  const states = []; let cursor = 0;
  const react = { useMemo: f => f(), useCallback: f => f, useEffect() {}, useState(value) {
    const i = cursor++; if (!(i in states)) states[i] = typeof value === 'function' ? value() : value;
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
  } };
  const mod = { exports: {} }, source = ts.transpileModule(fs.readFileSync('src/components/design/hybrid-visual-controls.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const localRequire = n => n === 'react' ? react : n === '@/components/design/institution-asset-match-controls' ? { InstitutionAssetMatchControls: Primary } : n === '@/components/design/information-graphic-controls' ? { InformationGraphicControls: Secondary } : n === '@/components/design/visual-director-image-controls' ? { VisualDirectorImageControls: Secondary } : n.startsWith('@/') ? load('src/' + n.slice(2) + '.ts') : require(n);
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})')(localRequire, mod, mod.exports);
  return p => { cursor = 0; return mod.exports.HybridVisualControls(p); };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(x => find(x, predicate));
  return [...(predicate(tree) ? [tree] : []), ...find(tree.props?.children, predicate)];
}
const html = tree => renderToStaticMarkup(tree);
test('role and institutional-photo guidance explain explicit preparation without execution', () => {
  const markup = html(harness()(props));
  for (const copy of ['대표 시각 요소는 기사의 중심 시각 자료', '보조 시각 요소는 기사 이해를 돕는 추가 자료', '기관 사진을 우선', 'AI 이미지가 실제 대상 사진을 자동 대체하지 않습니다.', '준비 완료는 승인·기사 적용 완료가 아닙니다.']) assert(markup.includes(copy));
});
test('missing photo requests input; secondary failure preserves prepared primary', () => {
  const render = harness(); let tree = render(props);
  find(tree, x => x.type === Primary)[0].props.onStage({ status: 'needs_input' });
  tree = render(props); assert(html(tree).includes('기관 사진 입력·확인이 필요합니다.'));
  find(tree, x => x.type === Primary)[0].props.onStage({ status: 'completed', assetId: 'retained' });
  find(tree, x => x.type === Secondary)[0].props.onStage({ status: 'failed' });
  tree = render(props); assert(html(tree).includes('보조 시각 요소 준비만 실패했습니다.')); assert(html(tree).includes('준비된 대표 시각 요소는 그대로 유지됩니다.'));
});
test('ready for review remains distinct from approval/application', () => {
  const render = harness(); let tree = render(props);
  find(tree, x => x.type === Primary)[0].props.onStage({ status: 'completed' });
  find(tree, x => x.type === Secondary)[0].props.onStage({ status: 'completed' });
  tree = render(props); assert(html(tree).includes('아직 기사에 적용되지 않았습니다.'));
  assert(html(tree).includes('검토한 뒤 별도 적용하세요.'));
});
test('changed article reconfirm explains retained assets, button does not imply apply', () => {
  const render = harness(); let tree = render(props);
  find(tree, x => x.type === Primary)[0].props.onStage({ status: 'completed', assetId: 'retained' });
  tree = render({ ...props, article: { ...article, title: '중앙도서관 새 이용 절차' } });
  const markup = html(tree); assert(markup.includes('기사 내용 또는 추천 조건이 바뀌어')); assert(markup.includes('기존 생성 자산은 삭제하지 않고 이전 결과로 유지합니다.')); assert(markup.includes('retained'));
  const button = find(tree, x => x.type === 'button')[0]; assert.equal(button.props.children, '현재 내용으로 다시 확인');
  button.props.onClick(); assert(!html(render({ ...props, article: { ...article, title: '중앙도서관 새 이용 절차' } })).includes('이전 대표 시각 자산:'));
});
test('Canva candidate acknowledgment does not claim production or approval', () => {
  const a = { ...article, title: '시민문화축제 현장 안내', body: '행사명: 시민문화축제\n실제 행사 현장에서 축제가 열렸다. 시민 참여 일정과 장소를 안내합니다.', articleType: 'event_festival', publicInfo: { dateTime: '10월 25일', place: '시청광장' }, links: [{ label: '행사 안내', isVisible: true }] };
  const markup = html(harness()({ ...props, article: a }));
  assert(markup.includes('Canva 템플릿은 추천 후보입니다.')); assert(markup.includes('후보 확인만으로 제작·승인·기사 적용되지 않습니다.')); assert(markup.includes('Canva 후보 확인'));
});
