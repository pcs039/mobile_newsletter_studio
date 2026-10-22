/* eslint-disable @typescript-eslint/no-require-imports -- Actual isolated PostgreSQL + in-memory private object store. */
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID,createHash}=require('node:crypto');
const runtime=process.env.ARTICLE_PUBLICATION_SQL_RUNTIME;
const load=require('./canva-test-loader.cjs')();
const {IsolatedPublicationStore,IsolatedArticlePublicationWorker}=load('src/lib/article-publication-media.ts');
const {publicationCanonical,publicationHash,publicationRenderHash}=load('src/lib/article-publication-canonical.ts');
const {buildArticlePublicationSnapshot}=load('src/lib/article-publication-snapshot.ts');
test('A2 actual PostgreSQL: snapshot, private preservation, authorization, fault and concurrency contracts',{skip:!runtime,timeout:120000},async t=>{
 const h=await require('./article-publication-a2-postgres.cjs')(runtime),{db,second,observer}=h;
 const png=await require('next/dist/server/image-optimizer').getSharp(1,false)({create:{width:4,height:5,channels:3,background:'#335577'}}).png().toBuffer();
 const otherPng=await require('next/dist/server/image-optimizer').getSharp(1,false)({create:{width:4,height:5,channels:3,background:'#ff0000'}}).png().toBuffer();
 const digest=b=>createHash('sha256').update(b).digest('hex');
 const sql=async(q,args=[])=>(await db.query(q,args)).rows;
 async function sample({image=true}={}){
  const projectId=randomUUID(),articleId=randomUUID(),asset=randomUUID(),block=randomUUID(),store=new IsolatedPublicationStore();
  const c={projectId,articleId,actorId:'writer',actorName:'writer',actorRole:'user',assignee:'writer'};
  await sql("insert into newsletter_projects(id,title,slug,assignee_name,status) values($1,'격리 A2',$2,'writer','draft')",[projectId,projectId]);
  await sql("insert into newsletter_articles(id,project_id,title,body,summary,status,publication_kind,audio_source,public_info,sort_order) values($1,$2,'안내','본문','요약','draft','regular','none','{}',30)",[articleId,projectId]);
  await sql("insert into newsletter_content_blocks(id,project_id,article_id,block_type,body,metadata,sort_order,is_visible) values($1,$2,$3,'paragraph','본문','{}',10,true)",[block,projectId,articleId]);
  const path=`projects/${projectId}/original.png`;
  if(image){await sql("insert into newsletter_project_design_assets(id,project_id,asset_type,storage_bucket,storage_path,mime_type,is_active,approval_status) values($1,$2,'illustration','a2-isolated-source',$3,'image/png',true,'approved')",[asset,projectId,path]);
   await sql("insert into newsletter_content_blocks(project_id,article_id,block_type,body,asset_id,metadata,sort_order,is_visible) values($1,$2,'image',$4,$3,'{}',20,true)",[projectId,articleId,asset,path]);await sql("insert into newsletter_assets(id,project_id,file_path,mime_type,is_approved,storage_bucket) values($1,$2,$3,'image/png',true,'a2-isolated-source')",[asset,projectId,path]);store.setSource(path,png);}
  const worker=new IsolatedArticlePublicationWorker(db,store);
  return {c,store,worker,asset,path,block};
 }
 async function prepared(s,intent='publish'){
  const prep=await s.worker.prepare(s.c,randomUUID(),intent);const ready=await s.worker.preserve(s.c,prep);
  return {prep,revision:ready.revisionId};
 }
 async function publish(s){const r=await prepared(s);const key=randomUUID();await s.worker.transition(s.c,key,'publish',r.prep.version,r.prep.id);return {...r,key};}
 const files=async id=>sql('select * from newsletter_article_publication_media where preparation_id=$1 order by id',[id]);
 const eventCount=async c=>(await sql('select count(*)::int n from newsletter_article_publication_events where article_id=$1',[c.articleId]))[0].n;
 const waitLock=async pid=>{for(let n=0;n<300;n++){const r=(await observer.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];if(r?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}assert.fail('real PostgreSQL lock barrier missing');};
 try{
  await t.test('A2-01/06 coherent capture, canonical cross-runtime and immutable mixed content',async()=>{
   const s=await sample(),prep=await s.worker.prepare(s.c);
   assert.equal(publicationHash(prep.capture),prep.sourceHash);
   for(const value of [{z:0.5,a:'한글',emoji:'😀'},[1,-0,10.25,null,true],{'\uffff':1,'😀':2},'quote"\n']){
    const row=(await sql('select article_publication_canonical_a2($1) c,article_publication_hash_a2($1) h',[JSON.stringify(value)]))[0];assert.equal(row.c,publicationCanonical(value));assert.equal(row.h,publicationHash(value));}
   const ready=await s.worker.preserve(s.c,prep);const r=(await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[ready.revisionId]))[0].snapshot;
   assert.equal(r.article.blocks[1].type,'image');assert.equal(r.mediaManifest[0].sha256,digest(png));assert(!JSON.stringify(r).includes(s.path));
   assert.equal((await sql('select payload_hash from newsletter_article_publication_revisions where id=$1',[ready.revisionId]))[0].payload_hash,publicationRenderHash(r));
  });
  await t.test('A2-02 links/CTA and display fields remain explicit; invalid HTML is blocked',async()=>{
   const s=await sample({image:false});await sql("insert into newsletter_link_actions(project_id,article_id,label,action_type,target_value,display_style,sort_order,is_visible) values($1,$2,'신청','url','https://example.com/apply','button',10,true)",[s.c.projectId,s.c.articleId]);
   const r=await prepared(s);const snapshot=(await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[r.revision]))[0].snapshot;assert.equal(snapshot.article.links[0].label,'신청');
   const bad=await sample({image:false});await sql("update newsletter_articles set body='<script>x</script>' where id=$1",[bad.c.articleId]);
   await assert.rejects(bad.worker.preserve(bad.c,await bad.worker.prepare(bad.c)),/unsafe_text/);
  });
  await t.test('A2-03 ready Composition supported placement and draft rejection',async()=>{
   const s=await sample();await sql("update newsletter_project_design_assets set asset_type='background' where id=$1",[s.asset]);
   const comp=randomUUID();await sql("insert into newsletter_article_compositions(id,project_id,article_id,status,settings) values($1,$2,$3,'ready','{\"textDesign\":{\"subtitleEnabled\":true,\"subtitle\":\"소제목\"}}')",[comp,s.c.projectId,s.c.articleId]);
   await sql("insert into newsletter_article_composition_assets(composition_id,asset_id,slot,settings) values($1,$2,'hero_background','{\"opacity\":0.5}')",[comp,s.asset]);
   const r=await prepared(s);assert.equal((await files(r.prep.id)).length,2);
   await sql("update newsletter_article_compositions set status='draft' where id=$1",[comp]);await assert.rejects(s.worker.preserve(s.c,await s.worker.prepare(s.c)),/not_ready/);
  });
  await t.test('A2-04 private synthetic font faces are preserved with independent inherited roles',async()=>{
   const s=await sample({image:false}),family=randomUUID(),regular=randomUUID(),bold=randomUUID(),fixture=require('./article-publication-a2-fixtures.cjs');
   await sql("insert into font_families values($1,'FixtureFamily',true,true)",[family]);
   for(const [id,weight] of [[regular,'400'],[bold,'700']]){const path=`projects/${s.c.projectId}/${id}.ttf`;
    await sql("insert into font_assets(id,family_id,font_family,font_file_path,font_file_format,font_weight,font_style,is_active,webfont_allowed,storage_bucket) values($1,$2,'NanumGothic',$3,'ttf',$4,'normal',true,true,'a2-isolated-source')",[id,family,path,weight]);
    s.store.setSource(path,fixture.syntheticFont({weight:Number(weight),subfamily:weight==='700'?'Bold':'Regular'}));}
   await sql('update newsletter_projects set body_font_asset_id=$2 where id=$1',[s.c.projectId,regular]);await sql('update newsletter_articles set title_font_asset_id=$2 where id=$1',[s.c.articleId,bold]);
   const r=await publish(s),snapshot=(await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[r.revision]))[0].snapshot;
   assert.equal(snapshot.typography.title.resolvedId,bold);assert.equal(snapshot.typography.caption.resolvedId,regular);assert.equal(snapshot.typography.button.selectedId,null);
   const file=(await files(r.prep.id))[0];assert.equal((await s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id)).length,file.byte_size);
   await s.worker.rpc('confirm_article_source_cleanup_a2',[s.c,file.id]);await sql('delete from font_assets where id=$1',[file.source_descriptor.sourceId]);
   assert.equal((await s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id)).length,file.byte_size);
   await sql('update font_families set is_active=false where id=$1',[family]);await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),/denied/);
  });
  await t.test('A2 audit: SQL capture retains detected face metadata and standalone CSS identity',async()=>{
   const s=await sample({image:false}),id=randomUUID(),path=`projects/${s.c.projectId}/standalone.ttf`;
   await sql('alter table font_assets add column detected_weight text,add column detected_style text');
   await sql("insert into font_assets(id,font_family,font_file_path,font_file_format,font_weight,font_style,detected_weight,detected_style,is_active,webfont_allowed,storage_bucket) values($1,'Display name',$2,'ttf','400','normal','700','italic',true,true,'a2-isolated-source')",[id,path]);
   await sql('update newsletter_articles set title_font_asset_id=$2 where id=$1',[s.c.articleId,id]);
   s.store.setSource(path,require('./article-publication-a2-fixtures.cjs').syntheticFont({weight:700,italic:true}));
   const prep=await s.worker.prepare(s.c),captured=prep.capture.fonts[0];
   assert.equal(captured.detected_weight,'700');assert.equal(captured.css_family_name,`DD_Font_${id.replace(/-/g,'_')}`);
   const r=await s.worker.preserve(s.c,prep),snapshot=(await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[r.revisionId]))[0].snapshot;
   assert.equal(snapshot.typography.title.faces[0].weight,'700');assert.equal(snapshot.typography.title.faces[0].style,'italic');
  });
  await t.test('A2-09 uploaded and saved AI audio manifest preserves verified segment order',async()=>{
   const fixture=require('./article-publication-a2-fixtures.cjs'),{normalizeKoreanTtsText,ARTICLE_TTS_NORMALIZATION_VERSION}=load('src/lib/article-tts-audio.ts');
   for(const source of ['uploaded','ai_tts']){const s=await sample({image:false}),audio=randomUUID(),path=`projects/${s.c.projectId}/audio.wav`;
    const textHash=createHash('sha256').update(`${ARTICLE_TTS_NORMALIZATION_VERSION}\n${normalizeKoreanTtsText('본문')}`).digest('hex');
    await sql("insert into newsletter_audio_files(id,project_id,file_path,script_text,source_type,script_status,ai_tts_audio_paths,ai_tts_text_hash,ai_tts_voice,storage_bucket,mime_type) values($1,$2,$3,'음성 대본',$4,'approved',$5,$6,'marin','a2-isolated-source','audio/wav')",[audio,s.c.projectId,path,source,JSON.stringify([path]),textHash]);
    await sql(`update newsletter_articles set audio_source=$2,${source==='ai_tts'?'ai_audio_id':'audio_id'}=$3 where id=$1`,[s.c.articleId,source,audio]);s.store.setSource(path,fixture.wav());
    const r=await publish(s),file=(await files(r.prep.id))[0];assert.equal(file.role,'audio-0');assert.equal(file.facts.sampleRate,8000);
    assert.deepEqual(await s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),fixture.wav());
    const snap=(await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[r.revision]))[0].snapshot;assert.equal(snap.presentation.audioInfo.source,source);
   }
  });
  await t.test('A2-16 SQL stage rejects a selected ID paired with an unselected same-project path',async()=>{
   const s=await sample(),prep=await s.worker.prepare(s.c),built=buildArticlePublicationSnapshot(prep.capture,prep.id);
   built.requirements[0].path=`projects/${s.c.projectId}/not-selected.png`;
   await assert.rejects(s.worker.rpc('stage_article_publication_a2',[s.c,prep.id,built.candidate,built.requirements,built.sourceHash]),/source_invalid/);assert.equal((await files(prep.id)).length,0);
  });
  await t.test('A2-05/07 draft and child edits never mutate published snapshot; stale candidate denied',async()=>{
   const s=await sample(),r=await publish(s),before=(await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[r.revision]))[0].snapshot;
   const pending=await prepared(s,'replace');await sql("update newsletter_content_blocks set body='수정 초안' where id=$1",[s.block]);
   await assert.rejects(s.worker.transition(s.c,randomUUID(),'replace',1,pending.prep.id),/a2_source_stale/);
   assert.deepEqual((await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[r.revision]))[0].snapshot,before);
   const file=(await files(r.prep.id))[0];assert.deepEqual(await s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),png);
  });
  await t.test('A2-07 multi-table writer transaction capture is all-before or all-after',async()=>{
   const s=await sample({image:false});await second.query('begin');await second.query("update newsletter_articles set body='after' where id=$1",[s.c.articleId]);await second.query("update newsletter_content_blocks set body='after' where id=$1",[s.block]);
   const first=(await sql('select article_publication_capture_a2($1,$2) c',[s.c.projectId,s.c.articleId]))[0].c;assert.equal(first.article.body,'본문');assert.equal(first.blocks[0].body,'본문');await second.query('commit');
   const last=(await sql('select article_publication_capture_a2($1,$2) c',[s.c.projectId,s.c.articleId]))[0].c;assert.equal(last.article.body,'after');assert.equal(last.blocks[0].body,'after');
  });
  await t.test('A2-08 original changes during copy fail before verification/revision',async()=>{
   const s=await sample(),prep=await s.worker.prepare(s.c);
   await assert.rejects(s.worker.preserve(s.c,prep,{afterCopy:async()=>s.store.setSource(s.path,otherPng)}),/source_changed/);
   assert.equal((await files(prep.id))[0].status,'pending');assert.equal(await eventCount(s.c),0);
  });
  await t.test('A2-10/11 Storage success + DB failure retains one copy and same-key retries reuse',async()=>{
   const s=await sample(),key=randomUUID(),prep=await s.worker.prepare(s.c,key);
   await sql("create function a2_fixture_fail() returns trigger language plpgsql as $$begin raise exception 'a2_fixture_db_failure';end$$;create trigger a2_fixture_fail before insert on newsletter_article_publication_revisions for each row execute function a2_fixture_fail()");
   await assert.rejects(s.worker.preserve(s.c,prep),/fixture_db_failure/);assert.equal(s.store.count,1);assert.equal(await eventCount(s.c),0);
   await sql('drop trigger a2_fixture_fail on newsletter_article_publication_revisions;drop function a2_fixture_fail()');
   const same=await s.worker.prepare(s.c,key),ready=await s.worker.preserve(s.c,same);assert.equal(same.id,prep.id);assert.equal(s.store.count,1);
   const req=randomUUID(),r=await s.worker.transition(s.c,req,'publish',0,prep.id),retry=await s.worker.transition(s.c,req,'publish',0,prep.id);
   assert.equal(retry.duplicate,true);assert.equal(retry.executedAt,r.executedAt);assert.equal(await eventCount(s.c),1);assert(ready.revisionId);
  });
  await t.test('A2-11 lost copy response retains planned path and resumes without new object',async()=>{
   const s=await sample(),prep=await s.worker.prepare(s.c);let fail=true;
   await assert.rejects(s.worker.preserve(s.c,prep,{afterCopy:async()=>{if(fail){fail=false;throw Error('copy_response_lost');}}}),/response_lost/);
   await s.worker.preserve(s.c,prep);assert.equal(s.store.count,1);
  });
  await t.test('A2-12 pin first prevents concurrent GC using actual row lock barrier',async()=>{
   const s=await sample(),r=await prepared(s),file=(await files(r.prep.id))[0];
   await db.query('begin');await s.worker.transition(s.c,randomUUID(),'publish',0,r.prep.id);
   const competing=second.query('select article_publication_gc_a2($1,$2,false)',[file.id,randomUUID()]).then(value=>({value}),error=>({error}));
   try{await waitLock(second.processID);}finally{await db.query('commit');}
   assert.equal((await competing).error.code,'PT409');assert.equal((await files(r.prep.id))[0].status,'pinned');assert.equal(s.store.count,1);
  });
  await t.test('A2-12 GC first prevents later pin, including delete response retry',async()=>{
   const s=await sample(),r=await prepared(s),file=(await files(r.prep.id))[0],token=randomUUID();
   await sql("update newsletter_article_publication_preparations set expires_at=clock_timestamp()-interval '2 days' where id=$1",[r.prep.id]);
   await sql("update newsletter_article_publication_media set lease_until=null where id=$1",[file.id]);
   await second.query('begin');await second.query('select article_publication_gc_a2($1,$2,false)',[file.id,token]);
   // Renew the candidate only as an explicit isolated fault fixture: GC won first.
   await sql("update newsletter_article_publication_preparations set expires_at=clock_timestamp()+interval '1 minute' where id=$1",[r.prep.id]);
   const pin=s.worker.transition(s.c,randomUUID(),'publish',0,r.prep.id).then(value=>({value}),error=>({error}));
   try{await waitLock(db.processID);}finally{await second.query('commit');}
   assert.equal((await pin).error.code,'PT409');assert.equal(await eventCount(s.c),0);
   await sql("update newsletter_article_publication_preparations set expires_at=clock_timestamp()-interval '2 days' where id=$1",[r.prep.id]);
   await s.worker.gc(file.id,token);await s.worker.gc(file.id,token);assert.equal(s.store.count,0);
  });
  await t.test('A2-13 preparation-only delete retains orphan ledger; grace gates GC',async()=>{
   const s=await sample(),r=await prepared(s),file=(await files(r.prep.id))[0];
   await sql('select delete_newsletter_article_atomic($1,$2)',[s.c.projectId,s.c.articleId]);
   assert.equal((await sql('select preparation_id from newsletter_article_publication_media where id=$1',[file.id]))[0].preparation_id,null);
   await assert.rejects(s.worker.gc(file.id),/not_eligible/);
   // Fixture ages only the local row; no test clock in deployed code.
   await sql('alter table newsletter_article_publication_media disable trigger article_publication_media_guard_a2');
   try{await sql("update newsletter_article_publication_media set created_at=clock_timestamp()-interval '2 days',lease_until=null where id=$1",[file.id]);}finally{await sql('alter table newsletter_article_publication_media enable trigger article_publication_media_guard_a2');}
   await s.worker.gc(file.id);assert.equal(s.store.count,0);
  });
  await t.test('A2-14 original bytes modified/deleted after pin do not change preserved file',async()=>{
   const s=await sample(),r=await publish(s),file=(await files(r.prep.id))[0];s.store.setSource(s.path,otherPng);
   assert.deepEqual(await s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),png);
   await s.worker.rpc('confirm_article_source_cleanup_a2',[s.c,file.id]);s.store.deleteSource(s.path);await sql('delete from newsletter_assets where id=$1',[s.asset]);
   assert.deepEqual(await s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),png);
  });
  await t.test('A2-15 safety revocation and unexplained source disappearance remain fail-closed',async()=>{
   const s=await sample(),r=await publish(s),file=(await files(r.prep.id))[0];
   await sql('update newsletter_assets set is_approved=false where id=$1',[s.asset]);await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),/denied/);
   await sql('delete from newsletter_assets where id=$1',[s.asset]);await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),/denied/);assert.equal(s.store.count,1);
  });
  await t.test('A2-15 old cleanup confirmation cannot undo later revocation by deleting source',async()=>{
   const s=await sample(),r=await publish(s),file=(await files(r.prep.id))[0];
   await s.worker.rpc('confirm_article_source_cleanup_a2',[s.c,file.id]);
   await sql('update newsletter_assets set is_approved=false where id=$1',[s.asset]);await sql('delete from newsletter_assets where id=$1',[s.asset]);
   assert.equal((await sql('select origin_revoked from newsletter_article_publication_media where id=$1',[file.id]))[0].origin_revoked,true);
   await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),/denied/);
   await assert.rejects(sql('update newsletter_article_publication_media set origin_revoked=false where id=$1',[file.id]),/revocation_immutable/);
  });
  await t.test('A2-16 unknown/cross-project file and revision IDs are denied',async()=>{
   const s=await sample(),other=await sample(),r=await publish(s),file=(await files(r.prep.id))[0];
   for(const ids of [[other.c.projectId,s.c.articleId,r.revision,file.id],[s.c.projectId,other.c.articleId,r.revision,file.id],[s.c.projectId,s.c.articleId,randomUUID(),file.id],[s.c.projectId,s.c.articleId,r.revision,randomUUID()]])await assert.rejects(s.worker.read(...ids),/denied/);
  });
  await t.test('A2-17 withdraw/replace revoke new reads of old revision; old receipt shows current state',async()=>{
   const s=await sample(),r=await publish(s),file=(await files(r.prep.id))[0];
   await sql("update newsletter_articles set body='새 초안' where id=$1",[s.c.articleId]);const next=await prepared(s,'replace');await s.worker.transition(s.c,randomUUID(),'replace',1,next.prep.id);
   await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),/denied/);
   const fresh=(await files(next.prep.id))[0];await s.worker.transition(s.c,randomUUID(),'withdraw',2,null);
   await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,next.revision,fresh.id),/denied/);
   const old=await s.worker.transition(s.c,r.key,'publish',0,r.prep.id);assert.equal(old.status,'published');assert.equal(old.currentStatus,'withdrawn');assert.equal(s.store.count,2);
  });
  await t.test('A2-17 historical republish reuses pinned revision and files without copying',async()=>{
   const s=await sample(),r=await publish(s);await s.worker.transition(s.c,randomUUID(),'withdraw',1,null);
   const historical=await s.worker.prepare(s.c,randomUUID(),'republish',r.revision);await s.worker.preserve(s.c,historical);await s.worker.transition(s.c,randomUUID(),'republish',2,historical.id);assert.equal(s.store.count,1);
  });
  await t.test('A2-17 archived article/project blocks requests without changing independent history',async()=>{
   const s=await sample(),r=await publish(s),file=(await files(r.prep.id))[0];
   await sql("update newsletter_articles set status='archived' where id=$1",[s.c.articleId]);await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),/denied/);
   await sql("update newsletter_articles set status='draft' where id=$1",[s.c.articleId]);await sql("update newsletter_projects set status='archived' where id=$1",[s.c.projectId]);await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),/denied/);assert.equal(await eventCount(s.c),1);
  });
  await t.test('A2-05 same rendered bytes with different preparation file IDs are unchanged',async()=>{
   const s=await sample(),r=await publish(s),next=await prepared(s,'replace');
   assert.notEqual((await files(r.prep.id))[0].id,(await files(next.prep.id))[0].id);
   const result=await s.worker.transition(s.c,randomUUID(),'replace',1,next.prep.id);assert.equal(result.unchanged,true);assert.equal(result.currentVersion,1);assert.equal(await eventCount(s.c),1);
  });
  await t.test('A2-19 Storage-first source deletion cannot remove the separate pinned copy',async()=>{
   const s=await sample(),r=await publish(s),file=(await files(r.prep.id))[0];s.store.deleteSource(s.path);
   await assert.rejects(sql('select delete_newsletter_article_atomic($1,$2)',[s.c.projectId,s.c.articleId]),/history_protected/);
   assert.deepEqual(await s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),png);
   assert.throws(()=>s.store.finishGc(file.destination_path,Symbol('forged')),/permit/);
  });
  await t.test('A2-18/19 internal-only adapters and no public buckets/source paths in snapshots',async()=>{
   const s=await sample();await sql("update newsletter_assets set storage_bucket='brand-assets' where id=$1",[s.asset]);
   await assert.rejects(s.worker.preserve(s.c,await s.worker.prepare(s.c)),/private_source/);
   assert.throws(()=>s.store.source('https://external.invalid/private'));
   const fs=require('node:fs');for(const path of ['src/lib/article-publication-media.ts','src/lib/article-publication-snapshot.ts'])assert(!/\bfetch\s*\(|process\.env/.test(fs.readFileSync(path,'utf8')));
  });
  await t.test('A2-20 service-only RPC; no table writes or anonymous access',async()=>{
   const s=await sample();await sql('set role anon');try{await assert.rejects(s.worker.prepare(s.c),e=>e.code==='42501');}finally{await sql('reset role');}
   await sql('set role service_role');try{await assert.rejects(sql("update newsletter_article_publication_media set status='pinned'"),e=>e.code==='42501');const r=await publish(s);assert(r.revision);}finally{await sql('reset role');}
  });
  await t.test('A2-20 concurrent distinct publish requests serialize to one event',async()=>{
   const s=await sample(),r=await prepared(s),other=new IsolatedArticlePublicationWorker(second,s.store);
   await observer.query('begin');await observer.query('select id from newsletter_projects where id=$1 for update',[s.c.projectId]);
   const first=s.worker.transition(s.c,randomUUID(),'publish',0,r.prep.id).then(value=>({value}),error=>({error}));const next=other.transition(s.c,randomUUID(),'publish',0,r.prep.id).then(value=>({value}),error=>({error}));
   try{await waitLock(db.processID);await waitLock(second.processID);}finally{await observer.query('commit');}
   const results=await Promise.all([first,next]);assert.equal(results.filter(x=>x.value).length,1);assert.equal(results.find(x=>x.error).error.code,'PT409');assert.equal(await eventCount(s.c),1);
  });
  await t.test('A2-22 issue publication and old save/delete behavior unchanged',async()=>{
   const s=await sample(),r=await publish(s),file=(await files(r.prep.id))[0],before=(await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[r.revision]))[0].snapshot;
   const body={title:'수정',body:'새 본문',sort_order:999,interest_tags:[],public_info:{},status:'draft'};await sql('select save_newsletter_article_atomic($1,$2,$3,$4)',[s.c.projectId,s.c.articleId,JSON.stringify(body),'[]']);
   assert.equal((await sql('select sort_order from newsletter_articles where id=$1',[s.c.articleId]))[0].sort_order,30);assert.deepEqual((await sql('select snapshot from newsletter_article_publication_revisions where id=$1',[r.revision]))[0].snapshot,before);
   await assert.rejects(sql('select delete_newsletter_article_atomic($1,$2)',[s.c.projectId,s.c.articleId]),/history_protected/);
   const revision=(await sql('select project_publication_state($1) s',[s.c.projectId]))[0].s.revision;
   await sql("select transition_project_publication_atomic($1,'writer','writer','user','writer',$2,'publish','author_direct',$3,true,null)",[s.c.projectId,randomUUID(),revision]);
   await s.worker.transition(s.c,randomUUID(),'withdraw',1,null);assert.equal((await sql('select status from newsletter_projects where id=$1',[s.c.projectId]))[0].status,'published');
   await assert.rejects(s.worker.read(s.c.projectId,s.c.articleId,r.revision,file.id),/denied/);
  });
 }finally{await h.close();}
});
