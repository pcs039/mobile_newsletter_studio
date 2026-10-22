/* eslint-disable @typescript-eslint/no-require-imports -- Pure snapshot and local byte validation tests. */
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const load=require('./canva-test-loader.cjs')(),f=require('./article-publication-a2-fixtures.cjs');
const {publicationCanonical,publicationHash}=load('src/lib/article-publication-canonical.ts');
const {buildArticlePublicationSnapshot:build,validatePublicationCandidate,publicationActionTarget}=load('src/lib/article-publication-snapshot.ts');
const {inspectPublicationBytes,IsolatedPublicationStore}=load('src/lib/article-publication-media.ts');
test('A2-01/05 allowlist, deterministic candidate, hidden content and credentials excluded',()=>{
 const c=f.image(f.capture()),prep=randomUUID();c.project.password_hash='private-secret';c.article.internal_note='private-note';
 c.blocks.push({...c.blocks[0],id:randomUUID(),body:'hidden-secret',is_visible:false});
 const x=build(c,prep);assert.deepEqual(build(c,prep),x);assert.equal(x.requirements.length,1);
 assert(!JSON.stringify(x.candidate).includes('private-'));assert(!JSON.stringify(x.candidate).includes('hidden-secret'));
});
test('A2-02/18 unsafe HTML/CSS/URLs and unknown dependencies fail closed',()=>{
 assert.equal(publicationActionTarget('061-450-5114'),'tel:0614505114');assert.throws(()=>publicationActionTarget('mailto:test@example.com'));
 for(const body of ['<script>alert(1)</script>','<img src=x>','url(https://evil.invalid/x)']){const c=f.capture();c.article.body=body;assert.throws(()=>build(c,randomUUID()));}
 for(const target of ['javascript:alert(1)','data:image/png;base64,a','https://u:p@x.invalid/','https://x.invalid/?token=secret']){
  const c=f.capture();c.links=[{id:randomUUID(),project_id:f.p,article_id:f.a,action_type:'url',label:'확인',target_value:target,sort_order:1}];assert.throws(()=>build(c,randomUUID()));}
 for(const bucket of ['fonts','brand-assets','unknown']){const c=f.image(f.capture());c.photos[0].storage_bucket=bucket;assert.throws(()=>build(c,randomUUID()),/private_source/);}
});
test('A2-03 Composition supported slots, approved state and valid placement settings',()=>{
 const c=f.image(f.capture()),comp=randomUUID();c.blocks=c.blocks.slice(0,1);c.compositions=[{id:comp,project_id:f.p,article_id:f.a,status:'ready',settings:{textDesign:{subtitleEnabled:true,subtitle:'소제목'}}}];
 c.assets[0].asset_type='background';c.placements=[{id:randomUUID(),composition_id:comp,asset_id:f.asset,slot:'hero_background',settings:{opacity:0.5,rotation:12},sort_order:0}];
 assert.equal(build(c,randomUUID()).candidate.presentation.placements.length,1);
 c.placements.push({...c.placements[0],slot:'title_icon'});assert.equal(build(c,randomUUID()).warnings.length,1);
 c.assets[0].approval_status='draft';assert.throws(()=>build(c,randomUUID()),/policy/);
 c.assets[0].approval_status='approved';c.compositions[0].status='draft';assert.throws(()=>build(c,randomUUID()),/not_ready/);
});
test('A2-04 independent font IDs, inherited roles and actual face metadata retained',()=>{
 const c=f.capture(),regular=randomUUID(),bold=randomUUID(),family=randomUUID();c.project.body_font_asset_id=regular;c.article.title_font_asset_id=bold;
 c.fonts=[regular,bold].map((id,i)=>({id,family_id:family,font_family:'Fixture',font_file_format:'ttf',font_weight:i?'700':'400',font_style:'normal',is_active:true,webfont_allowed:true,storage_bucket:'a2-isolated-source',font_file_path:`projects/${f.p}/${id}.ttf`,mime_type:'font/ttf'}));
 const t=build(c,randomUUID()).candidate.typography;assert.equal(t.title.resolvedId,bold);assert.equal(t.body.resolvedId,regular);assert.equal(t.caption.selectedId,null);assert.equal(t.caption.resolvedId,regular);assert.equal(t.button.faces.length,2);
 assert.deepEqual(t.title.faces.map(x=>x.weight),c.fonts.sort((a,b)=>a.id.localeCompare(b.id,'en')).map(f=>f.font_weight));
});
test('A2-06 bounded canonical JSON, Unicode ordering and number normalization',()=>{
 assert.equal(publicationCanonical({z:1,a:0.5}),'{"a":0.5,"z":1}');assert.equal(publicationCanonical(-0),'0');
 for(const v of [NaN,Infinity,1e13,0.1234567,undefined,'\ud800'])assert.throws(()=>publicationCanonical(v));
 assert.equal(publicationHash({a:1,b:2}),publicationHash({b:2,a:1}));
});
test('A2 audit: metadata-less image presentation matches the reader fallback',()=>{
 const c=f.image(f.capture());assert.equal(build(c,randomUUID()).candidate.article.contentPresentation,'mixed');
 c.blocks[0].metadata.presentation_mode='text';assert.equal(build(c,randomUUID()).candidate.article.contentPresentation,'text');
});
test('A2 audit: standalone CSS identity and detected face metadata match existing font CSS',()=>{
 const c=f.capture(),id=randomUUID();c.article.title_font_asset_id=id;
 c.fonts=[{id,font_family:'Display name',font_weight:'400',font_style:'normal',detected_weight:'700',detected_style:'italic',font_file_format:'ttf',is_active:true,webfont_allowed:true,storage_bucket:'a2-isolated-source',font_file_path:`projects/${f.p}/font.ttf`,mime_type:'font/ttf'}];
 const title=build(c,randomUUID()).candidate.typography.title;
 assert.equal(title.family,`DD_Font_${id.replace(/-/g,'_')}`);assert.equal(title.faces[0].weight,'700');assert.equal(title.faces[0].style,'italic');
 assert.equal(title.selectedId,id);assert.equal(title.resolvedId,id);
});
test('A2-16 cross-project article, child and asset references rejected',()=>{
 for(const section of ['article','blocks','photos']){const c=f.image(f.capture());(Array.isArray(c[section])?c[section][0]:c[section]).project_id=randomUUID();assert.throws(()=>build(c,randomUUID()),/ownership/);}
});
test('A2-09 byte inspection decodes image, rejects truncation and verifies WAV structure',async()=>{
 const sharp=require('next/dist/server/image-optimizer').getSharp(1,false),png=await sharp({create:{width:2,height:3,channels:3,background:'#335577'}}).png().toBuffer();
 assert.deepEqual(await inspectPublicationBytes(png,'image/png'),{width:2,height:3});
 await assert.rejects(inspectPublicationBytes(png.subarray(0,32),'image/png'));await assert.rejects(inspectPublicationBytes(png,'image/jpeg'));
 assert.equal((await inspectPublicationBytes(f.wav(),'audio/wav')).sampleRate,8000);await assert.rejects(inspectPublicationBytes(f.wav().subarray(0,44),'audio/wav'));
 const frame=Buffer.alloc(417);frame.set([255,251,144,0]);assert.equal((await inspectPublicationBytes(Buffer.concat([frame,frame]),'audio/mpeg')).frames,2);
 await assert.rejects(inspectPublicationBytes(frame.subarray(0,200),'audio/mpeg'));
});
test('A2-10 local private store cannot overwrite or alias mutable buffers',()=>{
 const s=new IsolatedPublicationStore(),path=`projects/${f.p}/file/hash`,b=Buffer.from('original');s.preserve(path,b);b[0]=0;
 const read=s.preserved(path);assert.equal(read.toString(),'original');read[0]=0;assert.equal(s.preserved(path).toString(),'original');
 assert.throws(()=>s.preserve(path,Buffer.from('different')),/overwrite/);assert.throws(()=>s.source('https://external.invalid/file'));
});
test('A2-21 unknown renderer/schema is not accepted as a publication candidate',()=>{
 const c=build(f.capture(),randomUUID()).candidate;assert.doesNotThrow(()=>validatePublicationCandidate(c));c.rendererVersion='future';assert.throws(()=>validatePublicationCandidate(c),/version/);
});
