/* eslint-disable @typescript-eslint/no-require-imports -- Existing Node/TSX component test harness. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const load = require('./canva-test-loader.cjs')();
const ready = { ok: true, supported: true, connected: true, isReady: true, visualReady: true, stagingAllowed: true, missingFields: [], visualIssues: [], confirmation: 'signed' };
const props = { projectSlug: 'test', articleId: 'article', templateId: 'event_festival_02', disabled: false };
function harness(responses) {
  const states = [], effects = []; let cursor = 0, mounted = false;
  const react = { useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in states)) states[index] = { current: initial }; return states[index]; }, useEffect(action) { if (!mounted) effects.push(action); } };
  const compiledModule = { exports: {} }, calls = [];
  const timer = (fn, ms) => ms === 3000 ? setTimeout(fn, 0) : setTimeout(fn, ms);
  const fetch = async (url, options) => { const input = JSON.parse(options.body); calls.push(input); const value = await responses(input, calls.length); return { ok: true, json: async () => value }; };
  const source = ts.transpileModule(fs.readFileSync('src/components/design/canva-recommendation-execution-controls.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const req = name => name === 'react' ? react : name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts') : require(name);
  vm.runInThisContext('(function(require,module,exports,fetch,setTimeout,clearTimeout){' + source + '\n})')(req, compiledModule, compiledModule.exports, fetch, timer, clearTimeout);
  return { calls, render(p = props) { cursor = 0; const result = compiledModule.exports.CanvaRecommendationExecutionControls(p); mounted = true; return result; }, mount() { return effects.map(effect => effect()); } };
}
function find(tree, predicate) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(t => find(t, predicate)); return [...(predicate(tree) ? [tree] : []), ...find(tree.props?.children, predicate)]; }
const markup = tree => renderToStaticMarkup(tree);
const button = tree => find(tree, t => t.type === 'button' && t.props.children === '이 디자인으로 Canva 제작')[0];
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('supported ready selection enables only after read-only preparation; explicit single click and synchronous double click create once', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const h = harness(input => input.action === 'prepare' ? ready : pending);
  assert(button(h.render()).props.disabled); h.mount(); await settle();
  let tree = h.render(); assert(!button(tree).props.disabled); assert.deepEqual(h.calls.map(c => c.action), ['prepare']);
  button(tree).props.onClick(); button(tree).props.onClick(); await settle();
  assert.deepEqual(h.calls.map(c => c.action), ['prepare', 'execute']); assert(button(h.render()).props.disabled);
  release({ ok: true, status: 'created', editUrl: 'https://www.canva.com/design/D/edit' }); await settle();
  tree = h.render(); assert(markup(tree).includes('Canva 디자인 생성 완료')); assert(markup(tree).includes('Canva에서 열기'));
  button(tree).props.onClick(); await settle(); assert.equal(h.calls.length, 2);
});
test('visual unsafe / missing / disconnected / Preview preparation keeps execution disabled and shows localized issues', async () => {
  for (const value of [{ ...ready, visualReady: false, visualIssues: [{ field: 'TITLE', fitStatus: 'overflow' }] }, { ...ready, isReady: false, missingFields: ['MAIN_IMAGE'] },
    { ...ready, connected: false }, { ...ready, stagingAllowed: false }]) {
    const h = harness(() => value); h.render(); h.mount(); await settle(); const tree = h.render();
    assert(button(tree).props.disabled); button(tree).props.onClick(); await settle(); assert.equal(h.calls.length, 1);
    if (!value.visualReady) assert(markup(tree).includes('제목'));
    if (!value.connected) assert(markup(tree).includes('Canva 연결 확인'));
    if (!value.stagingAllowed) assert(markup(tree).includes('고정 Staging'));
  }
});
test('unsupported recommendation remains selectable but production is disabled without even preparing', () => {
  const h = harness(() => { throw Error('unexpected request'); });
  const tree = h.render({ ...props, templateId: 'policy_support_02' }); h.mount();
  assert(button(tree).props.disabled); assert(markup(tree).includes('이 템플릿은 Canva 제작 검증 준비 중입니다.')); assert.equal(h.calls.length, 0);
});
test('duplicate success has reuse message instead of new design copy', async () => {
  const h = harness(input => input.action === 'prepare' ? ready : { ok: true, status: 'created', duplicate: true, editUrl: 'https://www.canva.com/design/D/edit' });
  h.render(); h.mount(); await settle(); button(h.render()).props.onClick(); await settle();
  assert(markup(h.render()).includes('기존 Canva 디자인을 재사용했습니다.')); assert(!markup(h.render()).includes('Canva 디자인 생성 완료'));
});
test('in_progress uses poll with identical key/confirmation, never a second execute', async () => {
  const h = harness(input => input.action === 'prepare' ? ready : input.action === 'execute' ? { ok: true, status: 'in_progress', jobId: 'J' } : { ok: true, status: 'created', duplicate: true });
  h.render(); h.mount(); await settle(); button(h.render()).props.onClick(); await settle();
  assert.deepEqual(h.calls.map(c => c.action), ['prepare', 'execute', 'poll']);
  assert(markup(h.render()).includes('Canva 디자인 생성 완료')); assert(!markup(h.render()).includes('기존 Canva 디자인을 재사용했습니다.'));
  assert.equal(h.calls[1].requestKey, h.calls[2].requestKey); assert.equal(h.calls[1].confirmation, h.calls[2].confirmation);
});
test('execution auth / dataset / unsafe errors are localized; arbitrary provider error copy is never displayed', async () => {
  for (const status of ['auth_required', 'dataset_mismatch', 'visual_not_ready', 'canva_error']) {
    const h = harness(input => input.action === 'prepare' ? ready : { ok: false, status, error: 'PRIVATE ARTICLE token', visualIssues: [{ field: 'EVENT_DATE', fitStatus: 'overflow' }] });
    h.render(); h.mount(); await settle(); button(h.render()).props.onClick(); await settle(); const text = markup(h.render());
    assert(!text.includes('PRIVATE')); if (status === 'auth_required') assert(text.includes('다시 연결')); if (status === 'dataset_mismatch') assert(text.includes('템플릿 정보를 다시 확인'));
    assert(button(h.render()).props.disabled);
  }
});
test('unmount cancels local observation and cannot replay creation; fresh instance has no old success state', async () => {
  const h = harness(input => input.action === 'prepare' ? ready : { ok: true, status: 'created' });
  h.render(); const [cleanup] = h.mount(); await settle(); button(h.render()).props.onClick(); await settle(); cleanup();
  const fresh = harness(() => ready); const tree = fresh.render({ ...props, articleId: 'other' });
  assert(!markup(tree).includes('생성 완료')); assert(button(tree).props.disabled);
});

test('Strict Mode effect cleanup cannot overwrite a newer successful preparation with a stale abort error', async () => {
  const h = harness(() => ready); h.render(); const [cleanup] = h.mount(); cleanup(); h.mount(); await settle();
  const tree = h.render(); assert(!button(tree).props.disabled); assert(!markup(tree).includes('제작 준비를 확인하지 못했습니다.'));
});

test('reusing an already pending job retains reuse provenance through success polling', async () => {
  const h = harness(input => input.action === 'prepare' ? ready : input.action === 'execute' ? { ok: true, status: 'in_progress', duplicate: true } : { ok: true, status: 'created', duplicate: true });
  h.render(); h.mount(); await settle(); button(h.render()).props.onClick(); await settle();
  assert(markup(h.render()).includes('기존 Canva 디자인을 재사용했습니다.')); assert.equal(h.calls.filter(c => c.action === 'execute').length, 1);
});

test('bounded new-job polling resumes as status-only and still displays new completion, not reuse', async () => {
  let polls = 0;
  const h = harness(input => input.action === 'prepare' ? ready : input.action === 'execute' ? { ok: true, status: 'in_progress' } : ++polls <= 6 ? { ok: true, status: 'in_progress', duplicate: true } : { ok: true, status: 'created', duplicate: true });
  h.render(); h.mount(); await settle(); button(h.render()).props.onClick(); await settle();
  const statusButton = find(h.render(), t => t.type === 'button' && t.props.children === '제작 상태 확인')[0]; assert(statusButton); statusButton.props.onClick(); await settle();
  assert(markup(h.render()).includes('Canva 디자인 생성 완료')); assert.equal(h.calls.filter(c => c.action === 'execute').length, 1);
});
