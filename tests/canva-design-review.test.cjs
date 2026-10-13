/* eslint-disable @typescript-eslint/no-require-imports -- Isolated TS test harness. */
const test = require('node:test'), assert = require('node:assert/strict');
const load = require('./canva-test-loader.cjs')();
const { receiveCanvaDesign, reviewCanvaDesign, restoreCanvaReview } = load('src/lib/canva-design-review.ts');
const first = () => receiveCanvaDesign(null, 'D1', 'https://www.canva.com/design/D1/edit', '2026-10-13');
test('explicit local review transitions: generated is not approved', () => {
  assert.equal(first().status, 'created');
  assert.equal(reviewCanvaDesign(first(), 'open').status, 'reviewing');
  assert.equal(reviewCanvaDesign(first(), 'approve').status, 'approved');
  assert.equal(reviewCanvaDesign(first(), 'revise').status, 'needs_revision');
  assert.equal(reviewCanvaDesign(reviewCanvaDesign(first(), 'approve'), 'cancel').status, 'created');
});
test('same duplicate retains approval; new design resets it without mutating prior record', () => {
  const approved = reviewCanvaDesign(first(), 'approve');
  assert.equal(receiveCanvaDesign(approved, 'D1', approved.editUrl, 'later').status, 'approved');
  assert.equal(receiveCanvaDesign(approved, 'D2', approved.editUrl, 'later').status, 'created');
  assert.equal(approved.status, 'approved'); assert.equal(approved.designId, 'D1');
});
test('session restores only identical article/version/template context and valid review shape', () => {
  const stored = { context: 'article/version/template', review: first() };
  assert.deepEqual(restoreCanvaReview(stored, stored.context), first());
  assert.equal(restoreCanvaReview(stored, 'different'), null);
  assert.equal(restoreCanvaReview({ ...stored, review: { status: 'approved' } }, stored.context), null);
  assert.equal(restoreCanvaReview(null, stored.context), null);
});
