/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict');
const load = require('./canva-test-loader.cjs')();
const {buildVisualAssetSpecifications} = load('src/lib/article-visual-asset-spec.ts');
const {fallbackDesignConcepts} = load('src/lib/article-design-concept.ts');
const concept = {name:'기사별 콘셉트',description:'모바일 안내',pattern:'event',visualTone:'clear',layoutDirection:'information',colorDirection:'brand',assetRole:'both',rationale:'정보를 명확히 전달'};
for (const pattern of ['event','policy','interview']) test(`${pattern}: independent reusable specifications, safe resolution/alpha/HTML constraints; no mutation`, () => {
  const input = {...concept, pattern}; const before = JSON.stringify(input);
  const plan = buildVisualAssetSpecifications(input, ['#092046','#184A88','invalid','#092046']);
  assert.deepEqual(plan.map(p=>p.assetRole), ['hero_background','pattern','hero_illustration','decoration']);
  for (const p of plan) {
    assert.equal(p.textInImage, false);
    assert.equal(p.colorDirection, 'brand');
    assert.deepEqual(p.brandConstraints.articleColors, ['#092046','#184A88']);
    assert.equal(p.brandConstraints.paletteReference,'existing-project-and-article');
    assert(p.brandConstraints.rules.some(r=>r.includes('HTML')));
    const [w,h] = p.aspectRatio.split(':').map(Number);
    assert.equal(p.targetSize.width / p.targetSize.height, w/h);
    assert.equal(p.targetSize.unit,'px');
    assert.equal(p.safeArea.unit,'percent');
    assert(p.safeArea.left+p.safeArea.right<100); assert(p.safeArea.top+p.safeArea.bottom<100);
    assert.equal(p.transparentBackground, ['hero_illustration','decoration'].includes(p.assetRole));
    assert.equal(p.canvaUsage, p.transparentBackground ? 'overlay':'background');
    assert(!JSON.stringify(p).includes('assetId'));
  }
  assert.equal(JSON.stringify(input),before);
});
test('fallback concepts require no calls; absent/invalid/manual/none plans are safe no-ops',()=> {
  const article = {title:'시민 행사',articleType:'event_festival'};
  const concepts = fallbackDesignConcepts(article);
  assert.equal(concepts.length,3);
  assert.deepEqual(concepts.map(c=>buildVisualAssetSpecifications(c).length),[0,2,2]);
  for (const input of [null,{...concept,pattern:'manual'},{...concept,assetRole:'none'},{...concept,colorDirection:'#ffffff'},{...concept,storagePath:'secret'}]) assert.deepEqual(buildVisualAssetSpecifications(input),[]);
  assert.equal(buildVisualAssetSpecifications(concepts[1])[0].brandConstraints.articleColors.length,0);
});
