/* eslint-disable @typescript-eslint/no-require-imports -- No remote data or credentials. */
const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./canva-test-loader.cjs');
const {proposalSample,sampleHref,tourismPlaces}=loader()('src/lib/hwaseong-proposal-sample.ts');
const pid='11111111-1111-4111-8111-111111111111';
const fixture=()=>({id:'article',blocks:[{id:'cover',type:'image',body:'/api/project-files/preview?'+new URLSearchParams({bucket:'design-production-assets',path:`projects/${pid}/production/illustration/a.png`}),metadata:{proposal_sample:{version:1,kind:'policy',eyebrow:'01',headline:'요약',summary:'원문 보존',sourceTitle:'원문',color:'#123456',pale:'#ffffff'}}}]});
test('only scoped authenticated asset references and explicit sample metadata are accepted',()=>{
 const a=fixture();assert(proposalSample(a,pid));assert.equal(proposalSample(a,'other'),null);
 for(const body of ['https://evil.invalid/a.png','/api/project-files/preview?bucket=brand-assets&path=a','/api/public-files/preview?bucket=design-production-assets&path=a']){a.blocks[0].body=body;assert.equal(proposalSample(a,pid),null);}
});
test('unknown sample kind, malformed color and unsupported version fail closed',()=>{
 for(const patch of [{kind:'other'},{color:'url(evil)'},{version:2}]){const a=fixture();Object.assign(a.blocks[0].metadata.proposal_sample,patch);assert.equal(proposalSample(a,pid),null);}
});
test('all navigation preserves project, article and width, detail is explicit',()=>{
 for(const w of [390,520]){const u=new URL(sampleHref('hwaseong-2026-10-samples','article',true,w),'https://sample.invalid');assert.equal(u.pathname,'/projects/hwaseong-2026-10-samples/samples');assert.equal(u.searchParams.get('articleId'),'article');assert.equal(u.searchParams.get('width'),String(w));assert.equal(u.searchParams.get('view'),'detail');}
 assert(!sampleHref('project','article').includes('view=detail'));assert(!sampleHref('project').includes('articleId'));
});
test('official polygons stay within original image; phone links only when known',()=>{
 assert.equal(tourismPlaces.length,6);assert.equal(new Set(tourismPlaces.map(p=>p.id)).size,6);
 for(const p of tourismPlaces){for(const pair of p.points.split(' ')){const[x,y]=pair.split(',').map(Number);assert(x>=0&&x<=1024&&y>=0&&y<=700);}assert(p.address.startsWith('화성시 '));assert(!p.phone||/^[0-9-]+$/.test(p.phone));}
 assert.equal(tourismPlaces.find(p=>p.id==='15').phone,'');
});
test('Production route gate runs before project or data reads',async()=>{
 let reads=0;const load=loader({'next/navigation':{notFound:()=>{throw Error('404');}},'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>false},'@/lib/newsletter-repository':{getProjectWorkspace:()=>{reads++;throw Error('must not read');}}});
 const page=load('src/app/projects/[projectId]/samples/page.tsx').default;
 await assert.rejects(page({params:Promise.resolve({projectId:'hwaseong-2026-10-samples'}),searchParams:Promise.resolve({})}),/404/);assert.equal(reads,0);
});
test('Staging route does not expose another project',async()=>{
 let reads=0;const load=loader({'next/navigation':{notFound:()=>{throw Error('404');}},'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>true},'@/lib/newsletter-repository':{getProjectWorkspace:()=>{reads++;}}});
 await assert.rejects(load('src/app/projects/[projectId]/samples/page.tsx').default({params:Promise.resolve({projectId:'muan-26-09'}),searchParams:Promise.resolve({})}),/404/);assert.equal(reads,0);
});
