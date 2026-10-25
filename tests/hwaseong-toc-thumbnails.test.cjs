/* eslint-disable @typescript-eslint/no-require-imports -- Read-only fixture rendering. */
const test = require('node:test'), assert = require('node:assert/strict');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const loader = require('./canva-test-loader.cjs');
const kinds = ['policy', 'tourism', 'event', 'cartoon', 'accessible', 'interview', 'video'];
const samples = kinds.map((kind, i) => ({ article: { id: `a${i + 1}`, blocks: [] }, kind,
  artDirectionVersion: 3, cover: `/original-${kind}.webp`, headline: `원래 제목 ${i + 1}`,
  summary: '원래 요약', eyebrow: `0${i + 1}`, pale: '#fff', color: '#123456' }));
const load = loader({ 'next/link': ({ children, ...p }) => React.createElement('a', p, children),
  'next/navigation': { useSearchParams:()=>null, useRouter: () => ({ push: () => {} }) },
  '@/components/public-mobile-article-reader': { ArticleCard: () => React.createElement('p', null, '본문 보존') },
  '@/components/public-text-size-toggle': { PublicTextSizeToggle: () => null } });
const Reader = load('src/components/hwaseong-proposal-reader.tsx').HwaseongProposalReader;
const render = p => renderToStaticMarkup(React.createElement(Reader, { slug: 'fixture', samples,
  fonts: [], backgrounds: {}, textDesigns: {}, detail: false, contents: true, width: 390, ...p }));

test('seven TOC frames share 16:9 without replacing assets, HTML labels or article links', () => {
  const before = JSON.stringify(samples), h = render();
  assert.equal((h.match(/data-sample-thumbnail=/g) || []).length, 7);
  assert.equal((h.match(/relative aspect-video overflow-hidden/g) || []).length, 7);
  assert.equal((h.match(/loading="lazy" decoding="async"/g) || []).length, 7);
  for (const [i, kind] of kinds.entries()) {
    assert(h.includes(`src="/original-${kind}.webp"`));
    assert(h.includes(`articleId=a${i + 1}`));
    assert(h.includes(`원래 제목 ${i + 1}`));
  }
  assert.equal(JSON.stringify(samples), before);
});
test('comic isolates one scene, accessible illustration keeps people/dog, portrait keeps face', () => {
  const h = render(), image = kind => h.split(`data-sample-thumbnail="${kind}"`)[1].split('</div>')[0];
  assert.match(image('cartoon'), /height:306%;object-position:center top/);
  assert.match(image('policy'), /height:160%;top:-40%;object-position:center center/);
  assert.match(image('accessible'), /object-position:center bottom;transform:scale\(1.05\);transform-origin:center bottom/);
  assert.match(image('interview'), /object-position:center top/);
  assert.match(image('event'), /object-position:center bottom/);
  assert.match(image('video'), /object-position:center center/);
  // Legacy comic assets are not assumed to have the v3 three-scene arrangement.
  const legacy = render({ samples: [{ ...samples[3], artDirectionVersion: 2 }] });
  assert(!legacy.includes('height:306%'));
});
test('TOC crops do not enter existing summary/detail rendering or replace summary originals', () => {
  const summary = render({ contents: false, selectedId: 'a1' });
  assert(!summary.includes('data-sample-thumbnail')); assert(!summary.includes('height:306%'));
  assert.match(summary, /src="\/original-policy.webp"/); assert.match(summary, /상세기사 보기/);
  const detail = render({ contents: false, selectedId: 'a1', detail: true });
  assert(!detail.includes('data-sample-thumbnail')); assert.match(detail, /본문 보존/);
});
