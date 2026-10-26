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
test('video loads only on explicit click; inline detail retains article rendering and boundary navigation',()=>{
 const fs=require('node:fs'),path=require('node:path'),source=fs.readFileSync(path.join(__dirname,'../src/components/hwaseong-editorial-sample.tsx'),'utf8');
 assert.match(source,/useState\(false\)/);assert.match(source,/loaded \? <iframe/);assert.match(source,/youtube-nocookie\.com\/embed/);assert.match(source,/onClick=\{\(\) => setLoaded\(true\)\}/);assert.match(source,/플레이어 닫기 · 재생 중단/);assert.match(source,/key=\{sample.article.id\}/);
 const reader=fs.readFileSync(path.join(__dirname,'../src/components/hwaseong-proposal-reader.tsx'),'utf8');assert.match(reader,/← 목록/);assert.match(reader,/마지막 기사입니다/);assert.match(reader,/samplePresentationArticle\(selected\)/);
});
test('interview A/B displays one cover, avoids duplicated visible quote and preserves HTML detail',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const e={sourceUrl:'https://v.daum.net/v/20260608110932267',publishedDate:'2026-06-08',credit:'photo credit',person:'작가',role:'시각예술',quote:'확대 가능한 실제 인용문',note:'출처 안내',canvaCover:'/api/project-files/preview?bucket=design-production-assets&path=projects/test/canva.png',sections:[{title:'주제',text:'확대 가능한 본문'}]};
 const sample={kind:'interview',headline:'인터뷰 제목',summary:'요약',cover:'/photo.webp',sourceTitle:'원문',article:{id:'article'}};
 const render=(mode,detail=false)=>{const load=loader({'react':{...React,useState:()=>[mode,()=>{}]},'next/link':props=>React.createElement('a',props),'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null},'@/lib/hwaseong-proposal-sample':{editorialFeature:()=>e,samplePresentationArticle:s=>s.article}});return renderToStaticMarkup(React.createElement(load('src/components/hwaseong-editorial-sample.tsx').HwaseongEditorialSample,{sample,href:'/detail',detail}));};
 const a=render('html');assert.match(a,/src="\/photo.webp"/);assert(!a.includes('src="'+e.canvaCover));assert.match(a,/<blockquote/);assert.match(a,/인터뷰 표지 비교/);
 const b=render('canva');assert(!b.includes('src="/photo.webp"'));assert.match(b,/Canva 표지에서 상세기사 보기/);assert(!b.includes('<blockquote'));assert(!b.includes('data-public-text-scale-target="article-title"'));assert.equal((b.match(/<img /g)||[]).length,1);assert.match(b,/출처 표시만으로 외부 제안·재배포 권리가 확보되는 것은 아닙니다/);
 const detail=render('canva',true);assert.match(detail,/<blockquote/);assert.match(detail,/확대 가능한 실제 인용문/);assert.match(detail,/data-public-text-scale-target="article-body"/);assert(!detail.includes('인터뷰 표지 비교'));
});

function renderProposal(kind, detail=false) {
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const article={id:'sample',body:'보존 자료',blocks:[],audioFile:null};
 if(kind==='tourism')article.blocks.push({type:'paragraph',title:'관광 특집',body:'공식 관광자료',isVisible:true,metadata:{proposal_tourism_feature:1,source:'https://www.hscity.go.kr/www/intro/trstMap.jsp'}});
 const sample={article,kind,cover:'/image.webp',eyebrow:'시연',headline:'시연 제목',sourceTitle:'기존 10월호 작업본',color:'#123456',pale:'#ffffff',artDirectionVersion:3};
 const load=loader({'next/link':({children,...props})=>React.createElement('a',props,children),'next/navigation':{useSearchParams:()=>null,useRouter:()=>({push:()=>{}})},'@/components/public-text-size-toggle':{PublicTextSizeToggle:()=>null},'@/components/public-article-image-lightbox':{PublicArticleImageLightbox:()=>null},'@/components/public-mobile-article-reader':{ArticleCard:()=>null,PublicNewsletterCoverView:()=>null}});
 return renderToStaticMarkup(React.createElement(load('src/components/hwaseong-proposal-reader.tsx').HwaseongProposalReader,{slug:'hwaseong-2026-10-samples',samples:[sample],fonts:[],backgrounds:{},textDesigns:{},selectedId:article.id,detail,width:390}));
}
test('accessible fixture states registered dog, guardian age and free entry without a QR procedure',()=>{
 const html=renderProposal('accessible');assert(!/QR|QR코드/.test(html));assert.match(html,/동물등록을 마친 반려견과 만 13세 이상 보호자/);assert.match(html,/함께 무료로 이용/);assert.match(html,/guardian aged 13 or older/);assert.match(html,/Admission is free/);assert.match(html,/공식 안내에 맞게 정정/);
});
test('event presentation retains original subjects while separating archived introduction from current participation',()=>{
 const html=renderProposal('event');for(const name of ['루나빛축제','안곡서원 문화제','노작홍사용창작연극제'])assert(html.includes(name));assert.match(html,/2026년 10월호 작업본/);assert.match(html,/현재 신청·참여 안내가 아닙니다/);assert(!html.includes('참여 가능'));assert(!html.includes('정조대왕능행차'));
});
test('tourism search links use a place-search label without claiming route calculation',()=>{
 const html=renderProposal('tourism',true);assert.equal((html.match(/지도에서 장소 찾기/g)||[]).length,6);assert(!html.includes('길찾기'));assert.equal((html.match(/https:\/\/map.kakao.com\/link\/search\//g)||[]).length,6);assert.equal((html.match(/href="tel:/g)||[]).length,5);
});
test('editorial paragraphs reuse saved alignment and retain source text without duplicate decorative numbering',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const feature={sourceUrl:'https://www.youtube.com/watch?v=cLHilm6oBjI',publishedDate:'2026-10-15',credit:'공식 출처',person:'',role:'',quote:'',note:'기존 출처 고지',videoId:'cLHilm6oBjI',canvaCover:'',sections:[{title:'01 · 원래 소제목',text:'확인한 원문 그대로.\n문단과 음성 대본은 바꾸지 않습니다.'}]};
 const load=loader({'@/lib/hwaseong-proposal-sample':{editorialFeature:()=>feature}}),Component=load('src/components/hwaseong-editorial-sample.tsx').HwaseongEditorialSample;
 for(const alignment of ['left','center','right','justify']){
  const sample={kind:'video',headline:'기존 제목',sourceTitle:'기존 출처',article:{id:'video',bodyAlignment:alignment}},before=JSON.stringify({sample,feature});
  const html=renderToStaticMarkup(React.createElement(Component,{sample,href:'/detail',detail:true}));
  assert(html.includes(`data-text-alignment="${alignment}"`));assert(html.includes('확인한 원문 그대로.\n문단과 음성 대본은 바꾸지 않습니다.'));
  assert.equal((html.match(/01 · 원래 소제목/g)||[]).length,1);assert(!html.includes('aria-hidden="true"'));assert.equal(JSON.stringify({sample,feature}),before);
 }
});
test('only the fixed Staging sample replaces the audio example with its saved read-only transcript',async()=>{
 const React=require('react');let staging=true;
 const load=loader({'@/lib/staging-environment':{stagingEnvironmentConfigured:()=>staging},'@/lib/newsletter-repository':{getProjectAudioFiles:async()=>({files:[{id:'audio',sourceType:'uploaded',title:'등록된 요약 음성',transcriptText:'실제 저장 대본',articleId:null,previewHref:'/retained.m4a',duration:'19초'}],source:'supabase'}),getProjectContent:async()=>({articles:[]})},'@/lib/article-tts-audio':{getArticleTtsProjectStatus:async()=>({articles:[]})}});
 const page=load('src/app/projects/[projectId]/audio/page.tsx').default;
 function find(node){if(node?.type==='textarea')return node;for(const child of React.Children.toArray(node?.props?.children)){const f=find(child);if(f)return f;}}
 const sample=find(await page({params:Promise.resolve({projectId:'hwaseong-2026-10-samples'})}));assert.equal(sample.props.defaultValue,'실제 저장 대본');assert.equal(sample.props.readOnly,true);
 for(const [enabled,projectId] of [[false,'hwaseong-2026-10-samples'],[true,'other-project']]){staging=enabled;const other=find(await page({params:Promise.resolve({projectId})}));assert(other.props.defaultValue.startsWith('무안군의 주요 정책'));assert.equal(other.props.readOnly,false);}
});
