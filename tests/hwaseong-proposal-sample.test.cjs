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
test('tourism feature requires an attributed visible stored block; original article stays intact',()=>{
 const {tourismFeature}=loader()('src/lib/hwaseong-proposal-sample.ts');
 const a=fixture();a.body='보존할 도시 비전 원문';a.blocks[0].metadata.proposal_sample.kind='tourism';a.blocks.push({type:'paragraph',title:'관광 특집',body:'바다\n공식 장소 안내\n\n초록\n공식 공원 안내',isVisible:true,metadata:{proposal_tourism_feature:1,source:'https://www.hscity.go.kr/www/intro/trstMap.jsp'}});
 const sample=proposalSample(a,pid),before=JSON.stringify(a);assert.deepEqual(tourismFeature(sample),{title:'관광 특집',paragraphs:['바다\n공식 장소 안내','초록\n공식 공원 안내']});assert.equal(JSON.stringify(a),before);
 a.blocks[1].metadata.source='https://evil.invalid';assert.equal(tourismFeature(sample),null);a.blocks[1].metadata.source='https://www.hscity.go.kr/www/intro/trstMap.jsp';a.blocks[1].isVisible=false;assert.equal(tourismFeature(sample),null);sample.kind='cartoon';assert.equal(tourismFeature(sample),null);
});
test('outdated tourism/comic audio is hidden only in presentation, preserving stored article and other samples',()=>{
 const {samplePresentationArticle}=loader()('src/lib/hwaseong-proposal-sample.ts');
 for(const kind of ['tourism','cartoon','policy','event','accessible']){const a=fixture();a.audioSource='uploaded';a.audioFile={id:'retained-audio',previewHref:'/api/project-files/preview?bucket=audio-files&path=sample.m4a'};a.body='보존 원문';a.blocks[0].metadata.proposal_sample.kind=kind;const sample=proposalSample(a,pid),before=JSON.stringify(a),shown=samplePresentationArticle(sample);
  if(['tourism','cartoon'].includes(kind)){assert.equal(shown.audioSource,'none');assert.equal(shown.audioFile,null);assert.equal(shown.body,a.body);assert.equal(shown.blocks,a.blocks);}else assert.equal(shown,a);assert.equal(JSON.stringify(a),before);
 }
});
test('editorial sources, dates and video membership fail closed; no arbitrary embed or cross-project Canva image',()=>{
 const {editorialFeature}=loader()('src/lib/hwaseong-proposal-sample.ts');
 const a=fixture();const m=a.blocks[0].metadata;m.proposal_sample.kind='video';m.proposal_editorial={sourceUrl:'https://www.youtube.com/watch?v=cLHilm6oBjI',publishedDate:'2026-10-15',credit:'공식 썸네일',person:'',role:'',quote:'',note:'설명란 기반',videoId:'cLHilm6oBjI',canvaCover:'',sections:[{title:'장소',text:'공식 설명'}]};
 const sample=proposalSample(a,pid);assert(editorialFeature(sample));const before=JSON.stringify(a);
 for(const patch of [{sourceUrl:'https://evil.invalid'},{videoId:'made-up-id'},{publishedDate:'unknown'},{sections:[{title:'x',text:9}]}]){const saved={...m.proposal_editorial};Object.assign(m.proposal_editorial,patch);assert.equal(editorialFeature(sample),null);m.proposal_editorial=saved;}
 assert.equal(JSON.stringify(a),before);m.proposal_editorial.canvaCover='/api/project-files/preview?bucket=design-production-assets&path=projects/other/cover.png';assert.equal(editorialFeature(sample,pid).canvaCover,'');
 m.proposal_sample.kind='interview';m.proposal_editorial.sourceUrl='https://v.daum.net/v/20260608110932267';m.proposal_editorial.videoId='';assert(editorialFeature(proposalSample(a,pid)));
});
test('video loads only on explicit click; sample integration does not alter old article detail rendering',()=>{
 const fs=require('node:fs'),path=require('node:path'),source=fs.readFileSync(path.join(__dirname,'../src/components/hwaseong-editorial-sample.tsx'),'utf8');
 assert.match(source,/useState\(false\)/);assert.match(source,/loaded \? <iframe/);assert.match(source,/youtube-nocookie\.com\/embed/);assert.match(source,/onClick=\{\(\) => setLoaded\(true\)\}/);assert.match(source,/플레이어 닫기 · 재생 중단/);assert.match(source,/key=\{sample.article.id\}/);
 const reader=fs.readFileSync(path.join(__dirname,'../src/components/hwaseong-proposal-reader.tsx'),'utf8');assert.match(reader,/const prev = samples\[index - 1\], next = samples\[index \+ 1\]/);assert.match(reader,/첫 기사입니다/);assert.match(reader,/마지막 기사입니다/);assert.match(reader,/samplePresentationArticle\(selected\)/);
});
