/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node/TypeScript component test tooling. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const load = require('./canva-test-loader.cjs')();
const { recommendArticleDesignTemplates: recommend } = load('src/lib/article-design-template-recommendation.ts');
const base = { title: '청년 지원금 혜택', summary: '', body: '신청 대상 청년에게 보조금 100만원을 지원합니다.', blocks: [], articleType: 'general', publicInfo: {} };

// Execute the real TSX render and event handlers with local hook state. No DOM
// library/dependency, provider mock, DB or browser credentials are required.
function CardsMarker() { return null; }
function VisualMarker() { return null; }
function harness(file = 'src/components/design/article-template-recommendations.tsx') {
  const states = []; let cursor = 0;
  const react = { useEffect() {}, useMemo(calculate) { return calculate(); }, useRef(value) { return { current: value }; }, useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
  } };
  const compiledModule = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const localRequire = name => name === 'react' ? react : name === '@/components/design/institution-asset-match-controls' ? { InstitutionAssetMatchControls: VisualMarker } : name === '@/components/design/information-graphic-controls' ? { InformationGraphicControls: VisualMarker } : name === '@/components/design/visual-director-image-controls' ? { VisualDirectorImageControls: VisualMarker } : name === '@/components/design/article-visual-director-result' ? load('src/components/design/article-visual-director-result.tsx') : name === '@/components/design/canva-recommendation-execution-controls' ? { CanvaRecommendationExecutionControls: VisualMarker } : name === '@/components/design/article-template-recommendations' ? { ArticleTemplateRecommendations: CardsMarker } : name === '@/components/design/article-visual-asset-generator' ? { ArticleVisualAssetGenerator: VisualMarker } : name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts') : require(name);
  vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})', { filename: file })(localRequire, compiledModule, compiledModule.exports);
  return props => { cursor = 0; return Object.values(compiledModule.exports)[0](props); };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(t => find(t, predicate));
  return [...(predicate(tree) ? [tree] : []), ...find(tree.props?.children, predicate)];
}
function html(tree) { return renderToStaticMarkup(tree).replace(/<!--.*?-->/g, ''); }

test('Top 3 render exact rank/name/family/variant/score/reason and native non-submit selection buttons', () => {
  const recommendations = recommend(base);
  const tree = harness()({ recommendations });
  const markup = html(tree);
  assert.equal(find(tree, t => t.type === 'article').length, 3);
  for (const item of recommendations) {
    assert(markup.includes(item.displayName));
    assert(markup.includes(`${item.rank}위`));
    assert(markup.includes(`유형 ${item.variant}`));
    assert(markup.includes(`추천 점수: ${item.score}`));
    assert(markup.includes(item.reason));
  }
  for (const button of find(tree, t => t.type === 'button')) {
    assert.equal(button.props.type, 'button');
    assert.equal(button.props.children, '이 디자인 선택');
    assert.equal(button.props['aria-pressed'], false);
  }
});

test('select one, switch cards, and rerender: only one active selection; no provider request or input mutation', () => {
  const recommendations = recommend(base), before = JSON.stringify(recommendations);
  const render = harness(); let tree = render({ recommendations });
  find(tree, t => t.type === 'button')[0].props.onClick();
  tree = render({ recommendations });
  assert.deepEqual(find(tree, t => t.type === 'button').map(t => t.props['aria-pressed']), [true, false, false]);
  assert(html(tree).includes(`선택한 디자인: ${recommendations[0].displayName}`));
  find(tree, t => t.type === 'button')[2].props.onClick();
  tree = render({ recommendations });
  assert.deepEqual(find(tree, t => t.type === 'button').map(t => t.props['aria-pressed']), [false, false, true]);
  assert(html(tree).includes('선택만으로 적용되거나 저장되지 않습니다.'));
  assert.equal(JSON.stringify(recommendations), before);
  assert.equal(find(tree, t => t.type === 'a' || t.type === 'form').length, 0);
  const changed = render({ recommendations: recommend({ ...base, title: '캐릭터 대화 만화', body: '만화 캐릭터 대사 말풍선' }) });
  assert(find(changed, t => t.type === 'button').every(t => !t.props['aria-pressed']));
});

test('list reconciliation retains a present ID and clears removed/empty/error IDs permanently', () => {
  const recommendations = recommend(base), render = harness();
  let tree = render({ recommendations });
  find(tree, t => t.type === 'button')[0].props.onClick();
  const revised = recommendations.map(item => ({ ...item, score: item.score + 1, reason: item.reason + ' 재계산' }));
  tree = render({ recommendations: revised });
  assert.equal(find(tree, t => t.type === 'button')[0].props['aria-pressed'], true);
  for (const empty of [[], null]) {
    tree = render({ recommendations: empty });
    assert(html(tree).includes('아직 선택한 디자인이 없습니다.'));
    tree = render({ recommendations });
    assert(find(tree, t => t.type === 'button').every(t => !t.props['aria-pressed']));
    find(tree, t => t.type === 'button')[0].props.onClick();
  }
  tree = render({ recommendations: recommend({ ...base, title: '캐릭터 대화 만화', body: '만화 캐릭터 대사 말풍선' }) });
  assert(find(tree, t => t.type === 'button').every(t => !t.props['aria-pressed']));
  tree = render({ recommendations });
  assert(find(tree, t => t.type === 'button').every(t => !t.props['aria-pressed']));
});

test('score zero fallback stays neutral with explicit confirmation-needed badges and no automatic selection', () => {
  const tree = harness()({ recommendations: recommend({ ...base, title: '', body: '' }) });
  assert.equal(find(tree, t => t.type === 'span' && t.props.children === '확인 필요').length, 3);
  assert(find(tree, t => t.type === 'article').every(t => !t.props.className.includes('bg-sky-50')));
  assert(html(tree).includes('근거가 부족'));
});

test('empty/unavailable recommendations are safe; editing remains available; busy disables selection', () => {
  for (const recommendations of [[], null]) {
    const tree = harness()({ recommendations });
    assert.equal(find(tree, t => t.type === 'button').length, 0);
    assert(html(tree).includes('기존 디자인 편집은 계속 사용할 수 있습니다.'));
  }
  const tree = harness()({ recommendations: recommend(base), disabled: true });
  assert(find(tree, t => t.type === 'button').every(t => t.props.disabled));
});

test('existing concept/draft container calculates cards without requests, catches failure and preserves actions', () => {
  const render = harness('src/components/design/article-design-draft-controls.tsx');
  const props = { projectSlug: 'test', articleId: 'article', article: base, disabled: false, composition: { settings: {}, assets: [], updatedAt: 'v' }, onApplied() { throw Error('unexpected write'); } };
  const originalFetch = global.fetch;
  global.fetch = () => { throw Error('unexpected provider request'); };
  try {
    const tree = render(props);
    assert.equal(find(tree, t => t.type === 'h3' && t.props.children === 'AI 디자인 추천').length, 1);
    const cards = find(tree, t => t.type === CardsMarker)[0];
    assert.deepEqual(cards.props.recommendations, recommend(base));
    assert(find(tree, t => t.type === 'button').some(t => t.props.children === '디자인 콘셉트 제안받기'));
    const failed = render({ ...props, article: { ...base, title: null } });
    assert.equal(find(failed, t => t.type === CardsMarker).length, 0);
    assert(html(failed).includes('자료 확인 필요'));
    assert(html(failed).includes('콘셉트와 제작 패턴을 직접 조정'));
    assert.equal(find(failed, t => t.type === 'button' && t.props.disabled === false).length, 1);
  } finally { global.fetch = originalFetch; }
});

test('execution child key changes on selected template or article content; stale results cannot migrate', () => {
  const render = harness(), recommendations = recommend(base), props = { recommendations, projectSlug: 'test', articleId: 'saved', articleVersion: 'v1' };
  let tree = render(props); find(tree, t => t.type === 'button')[0].props.onClick(); tree = render(props);
  const first = find(tree, t => t.type === VisualMarker)[0]; assert.equal(first.props.templateId, recommendations[0].templateId);
  find(tree, t => t.type === 'button')[1].props.onClick(); const second = find(render(props), t => t.type === VisualMarker)[0]; assert.notEqual(second.key, first.key);
  const updated = find(render({ ...props, articleVersion: 'v2' }), t => t.type === VisualMarker)[0]; assert.notEqual(updated.key, second.key);
  assert.equal(find(render({ ...props, recommendations: [] }), t => t.type === VisualMarker).length, 0);
});
