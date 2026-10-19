/* eslint-disable @typescript-eslint/no-require-imports -- Route contract tests. */
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./canva-test-loader.cjs');
const cache = load()('src/lib/revocable-file-cache.ts');
function expectPolicy(response) {
 for (const [key, value] of Object.entries(cache.revocableFileHeaders)) assert.equal(response.headers.get(key), value);
 assert(!response.headers.get('cache-control').includes('stale-while-revalidate'));
 assert(!response.headers.get('cache-control').includes('immutable'));
}
test('revocable policy replaces browser and both CDN opt-ins without consuming the body', async () => {
 const response = new Response('same bytes', { headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'CDN-Cache-Control': 's-maxage=300', 'Vercel-CDN-Cache-Control': 's-maxage=600', 'Content-Type': 'image/png' } });
 assert.equal(cache.preventRevocableFileCaching(response), response);
 expectPolicy(response);
 assert.equal(await response.text(), 'same bytes');
 assert.equal(response.headers.get('content-type'), 'image/png');
});
const audioRoutes = [
 ['articles/[articleId]/audio', '@/lib/article-tts-audio', 'getPublicArticleAudioManifest', false],
 ['articles/[articleId]/audio/[segmentIndex]', '@/lib/article-tts-audio', 'downloadPublicArticleAudioSegment', true],
 ['ebook/pages/[pageId]/audio', '@/lib/ebook-tts-audio', 'getPublicEbookPageAudioManifest', false],
 ['ebook/pages/[pageId]/audio/[segmentIndex]', '@/lib/ebook-tts-audio', 'downloadPublicEbookPageAudioSegment', true],
];
for (const [path, module, method, segment] of audioRoutes) test(`${path}: publish -> cancel -> republish reauthorizes same URL, including failures`, async () => {
 let published = true, calls = 0;
 const route = load({ [module]: { [method]: async () => { calls++; return published ? (segment ? { ok: true, body: 'audio', contentLength: '5' } : { ok: true, manifest: { hasAudio: true } }) : { ok: false, httpStatus: 404, message: 'not public' }; } } })('src/app/api/public/newsletters/[slug]/' + path + '/route.ts');
 const request = new Request('https://app.invalid/same-url');
 for (const expected of [200, 404, 200]) {
  published = expected === 200;
  const r = await route.GET(request, { params: Promise.resolve({ slug: 'fixture', articleId: 'a', pageId: 'p', segmentIndex: '0' }) });
  assert.equal(r.status, expected); expectPolicy(r);
 }
 assert.equal(calls, 3);
});
const config = { getSupabaseRestEndpoint: p => 'https://db.invalid' + p, getSupabaseStorageEndpoint: p => 'https://storage.invalid' + p };
for (const path of ['ebook/pages/[pageId]', 'ebook/original-pdf']) test(`${path}: no stale positive/negative response bypasses published gate`, async () => {
 const old = global.fetch, oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture'; let published = true, storage = 0;
 global.fetch = async url => {
  if (url.startsWith('https://storage.invalid')) { storage++; return new Response('file'); }
  return Response.json(url.includes('newsletter_projects') ? [{ id: 'p', status: published ? 'published' : 'private', pdf_original_path: 'fixture.pdf' }] : [{ id: 'page', project_id: 'p', image_path: 'fixture.png' }]);
 };
 try {
  const route = load({ '@/lib/supabase-config': config })('src/app/api/public/newsletters/[slug]/' + path + '/route.ts');
  for (const expected of [200, 404, 200]) { published = expected === 200; const r = await route.GET(new Request('https://app.invalid/same-url'), { params: Promise.resolve({ slug: 'fixture', pageId: 'page' }) }); assert.equal(r.status, expected); expectPolicy(r); }
  assert.equal(storage, 2);
 } finally { global.fetch = old; if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey; }
});
test('public image, uploaded audio and design: reject private anonymously; shared fonts retain their separate cache contract', async () => {
 const old = global.fetch, oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY; process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
 let published = true, storage = 0, designCalls = 0;
 const route = load({ '@/lib/supabase-config': config,
  '@/lib/project-api-access': { requireProjectApiAccess: async () => ({ ok: false, response: Response.json({ ok: false }, { status: 401 }) }) },
  '@/lib/newsletter-repository': { getProjectWorkspace: async () => ({ ok: true, project: { id: 'p', statusCode: published ? 'published' : 'private' } }) },
  '@/lib/article-full-layout-server': { serveFullLayout: async () => { designCalls++; return new Response('design', { headers: { 'Cache-Control': 'public, max-age=300' } }); } },
  '@/lib/ai-image-article-server': {}, '@/lib/article-hero-background-file': {},
 })('src/app/api/public-files/preview/route.ts');
 global.fetch = async url => {
  if (url.startsWith('https://storage.invalid')) { storage++; return new Response('file'); }
  if (url.includes('cover_image_path=')) return Response.json([]);
  if (url.includes('newsletter_projects')) return Response.json([{ id: 'p', status: published ? 'published' : 'private' }]);
  return Response.json([{ project_id: 'p', id: 'font' }]);
 };
 try {
  for (const query of ['bucket=mobile-assets&path=fixture.png', 'bucket=audio-files&path=fixture.wav', 'bucket=brand-assets&path=fixture.png', 'project=fixture&articleId=a&fullLayoutBlock=b']) {
   for (const expected of [200, 404, 200]) { published = expected === 200; const r = await route.GET(new Request('https://app.invalid/api/public-files/preview?' + query)); assert.equal(r.status, expected); expectPolicy(r); }
  }
  assert.equal(storage, 6); assert.equal(designCalls, 2);
  const font = await route.GET(new Request('https://app.invalid/api/public-files/preview?bucket=fonts&path=fixture.woff2'));
  assert.equal(font.headers.get('cache-control'), 'public, max-age=300');
  // A font parameter cannot make a project design request cacheable.
  expectPolicy(await route.GET(new Request('https://app.invalid/api/public-files/preview?bucket=fonts&project=fixture&articleId=a&fullLayoutBlock=b')));
  expectPolicy(await route.GET(new Request('https://app.invalid/api/public-files/preview?bucket=invalid&path=../secret')));
 } finally { global.fetch = old; if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey; }
});
