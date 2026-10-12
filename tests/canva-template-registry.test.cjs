/* eslint-disable @typescript-eslint/no-require-imports -- Existing isolated TypeScript test loader. */
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./canva-test-loader.cjs')();
const verifiedDatasets = require('./fixtures/canva-template-datasets.json');
const { canvaTemplateRegistry: registry, canvaTemplateFamilies: families, getCanonicalCanvaTemplate: get, listCanonicalCanvaTemplates: list } = load('src/lib/canva-template-registry.ts');

const expected = {
  policy_support: ['EAHXyJEkAsQ','EAHXyEzk03Q','EAHXyFYYiJg','EAHXyK57FWY'],
  event_festival: ['EAHXxK9PTF8','EAHXxCyfpSI','EAHXxG6zLMQ','EAHXxfeoCwc'],
  recruitment_contest: ['EAHXxRUqOHo','EAHXxp1_n_U','EAHXxle-Lzc','EAHXxoxe9Jc'],
  interview_person: ['EAHXxtPWwK0','EAHXxi1onEI','EAHXxuOmqEY','EAHXxql07IU'],
  culture_tourism: ['EAHXx2-zSJU','EAHXx8cBHkw','EAHXx7BgMYc','EAHXx3ZJGCI'],
  statistics_performance: ['EAHXyMUji0I','EAHXyJwJhts','EAHXyGzU3uo','EAHXyDK6GeM'],
  cardnews: ['EAHXyDB1evg','EAHXyPsE0cs','EAHXyMJaJlE','EAHXyHRzfJY'],
  cartoon: ['EAHXyeGz-7E','EAHXyVzY6Rc','EAHXySFO9ww','EAHXybJlwRs'],
};

test('canonical registry contains exactly the supplied 32 Brand Template IDs and four ordered variants per family', () => {
  assert.equal(registry.length, 32);
  assert.equal(new Set(registry.map(t => t.id)).size, 32);
  assert.equal(new Set(registry.map(t => t.canvaBrandTemplateId)).size, 32);
  assert.deepEqual(Object.keys(families), Object.keys(expected));
  for (const [family, ids] of Object.entries(expected)) {
    const templates = list(family);
    assert.deepEqual(templates.map(t => t.canvaBrandTemplateId), ids);
    templates.forEach((t, index) => {
      const variant = String(index + 1).padStart(2, '0');
      assert.equal(t.id, `${family}_${variant}`);
      assert.equal(t.variant, variant);
      assert.equal(t.priority, index + 1);
      assert.equal(t.displayName, `${families[family]} ${variant}`);
      assert.equal(t.templateType, 'brand_template');
      assert(t.recommendedFor.length > 0);
    });
  }
});

test('canonical lookup cannot invent IDs and family lookup stays exact', () => {
  for (const t of registry) {
    assert.equal(get(t.id), t);
  }
  for (const id of ['event_festival_05', 'EAHXxK9PTF8', '__proto__', '', 'event_festival_01 ']) assert.equal(get(id), undefined);
  assert.deepEqual(list('unknown'), []);
});

test('exactly 30 verified datasets match supplied text/image fields; only two need republishing', () => {
  const verified = registry.filter(t => t.datasetStatus === 'verified');
  const pending = registry.filter(t => t.datasetStatus === 'needs_republish');
  assert.equal(verified.length, 30);
  assert.equal(pending.length, 2);
  assert.deepEqual(pending.map(t => [t.id, t.canvaBrandTemplateId]), [
    ['culture_tourism_01', 'EAHXx2-zSJU'], ['cardnews_02', 'EAHXyPsE0cs'],
  ]);
  assert.deepEqual(verified.map(t => t.canvaBrandTemplateId).sort(), Object.keys(verifiedDatasets).sort());
  for (const t of verified) {
    assert.notEqual(t.requiredFields, null);
    assert.notEqual(t.imageFields, null);
    assert.deepEqual(t.requiredFields, verifiedDatasets[t.canvaBrandTemplateId].requiredFields);
    assert.deepEqual(t.imageFields, verifiedDatasets[t.canvaBrandTemplateId].imageFields);
    const fields = [...t.requiredFields, ...t.imageFields];
    assert.equal(new Set(fields).size, fields.length);
  }
  for (const t of pending) {
    assert.equal(t.requiredFields, null);
    assert.equal(t.imageFields, null);
  }
  assert.deepEqual(get('statistics_performance_02').imageFields, []);
  assert(!get('statistics_performance_04').requiredFields.includes('KPI_3_UNIT'));
  assert(get('statistics_performance_01').requiredFields.includes('KPI_3_UNIT'));
});

test('registry and nested recommendations cannot be mutated by consumers', () => {
  assert(Object.isFrozen(registry));
  for (const t of registry) {
    assert(Object.isFrozen(t));
    assert(Object.isFrozen(t.recommendedFor));
    if (t.datasetStatus === "verified") {
      assert(Object.isFrozen(t.requiredFields));
      assert(Object.isFrozen(t.imageFields));
    }
  }
  assert.throws(() => registry.push(registry[0]), TypeError);
  assert.throws(() => registry[0].recommendedFor.push('changed'), TypeError);
  const filtered = list('policy_support');
  filtered.pop();
  assert.equal(list('policy_support').length, 4);
});
