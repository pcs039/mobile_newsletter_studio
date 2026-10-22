/* eslint-disable @typescript-eslint/no-require-imports -- Local PostgreSQL connections; mock Storage only. */
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const runtime=process.env.ARTICLE_PUBLICATION_SQL_RUNTIME;
const load=require('./canva-test-loader.cjs')();
const {buildArticlePublicationSnapshot}=load('src/lib/article-publication-snapshot.ts');
const {IsolatedArticlePublicationWorker,IsolatedPublicationStore}=load('src/lib/article-publication-media.ts');
const {preservationPath}=load('src/lib/article-publication-supabase-store.ts');
test('C1 actual PostgreSQL ledger lock fences mock Supabase copy against concurrent GC',{skip:!runtime,timeout:60000},async()=>{
 const h=await require('./article-publication-a2-postgres.cjs')(runtime),{db,second,observer}=h;
 try{
  const f=await require('./article-publication-c1-fixture.cjs')(),c={projectId:f.i.projectId,articleId:f.i.articleId,actorId:'writer',actorName:'writer',actorRole:'user',assignee:'writer'};
  const worker=new IsolatedArticlePublicationWorker(db,new IsolatedPublicationStore());
  await db.query("insert into newsletter_projects(id,title,slug,assignee_name) values($1,'C1',$2,'writer')",[c.projectId,c.projectId]);
  await db.query("insert into newsletter_articles(id,project_id,title,body,status,audio_source,public_info) values($1,$2,'C1','body','draft','none','{}')",[c.articleId,c.projectId]);
  await db.query("insert into newsletter_assets(id,project_id,file_path,mime_type,is_approved,storage_bucket) values($1,$2,$3,'image/png',true,'a2-isolated-source')",[f.source.sourceId,c.projectId,f.source.path]);
  await db.query("insert into newsletter_content_blocks(id,project_id,article_id,block_type,body,asset_id,sort_order,is_visible,metadata) values($1,$2,$3,'image',$4,$5,10,true,'{}')",[randomUUID(),c.projectId,c.articleId,f.source.path,f.source.sourceId]);
  const prep=await worker.prepare(c),built=buildArticlePublicationSnapshot(prep.capture,prep.id);
  f.i.preparationId=prep.id;f.i.fileId=built.requirements[0].fileId;Object.assign(f.source,f.i);f.file.fileId=f.i.fileId;
  await worker.rpc('stage_article_publication_a2',[c,prep.id,built.candidate,built.requirements,built.sourceHash]);
  const lease=randomUUID();let ticket;
  const ledger={...f.ledger,
   async find(){return ticket||null;},
   async reserve(s,d){const r=await worker.rpc('reserve_article_media_a2',[c,prep.id,s.fileId,d.sha256,d.bytes,d.mime,d.facts,lease]);
    assert.equal(r.path,`projects/${c.projectId}/articles/${c.articleId}/preparations/${prep.id}/${s.fileId}/${d.sha256}`);
    ticket={...f.i,...d,lease,path:preservationPath(f.i,d)};return ticket;},
   async exclusive(r,operation){await db.query('begin');try{
    const row=(await db.query('select * from newsletter_article_publication_media where id=$1 for update',[r.fileId])).rows[0];
    if(!row||!['pending','verified'].includes(row.status)||row.lease_token!==r.lease)throw Error('lease_denied');
    const result=await operation();await db.query('commit');return result;
   }catch(e){await db.query('rollback');throw e;}},
   async verified(r){await worker.rpc('verify_article_media_a2',[c,prep.id,r.fileId,lease]);}
  };
  let entered,release;const copied=new Promise(r=>entered=r),continueCopy=new Promise(r=>release=r);
  f.state.afterUpload=async()=>{entered();await continueCopy;};
  const copy=f.store.preserve(f.i,ledger);await copied;
  const gc=second.query('select article_publication_gc_a2($1,$2,false)',[f.i.fileId,randomUUID()]).then(v=>({v}),e=>({e}));
  try{
   let waiting=false;for(let n=0;n<200;n++){
    if((await observer.query('select wait_event_type from pg_stat_activity where pid=$1',[second.processID])).rows[0]?.wait_event_type==='Lock'){waiting=true;break;}
    await new Promise(r=>setTimeout(r,10));
   }assert.equal(waiting,true,'GC must wait for the actual PostgreSQL row lock, not a JS mutex');
  }finally{release();}
  await copy;assert.equal((await gc).e.code,'PT409');assert.equal(f.state.posts,1);
  const ready=await worker.rpc('finalize_article_publication_a2',[c,prep.id]);
  await worker.transition(c,randomUUID(),'publish',0,prep.id);
  await assert.rejects(second.query('select article_publication_gc_a2($1,$2,false)',[f.i.fileId,randomUUID()]),e=>e.code==='PT409'&&/pinned/.test(e.message));
  const decision=await worker.rpc('article_publication_file_access_a2',[c.projectId,c.articleId,ready.revisionId,f.i.fileId]);assert.equal(decision.allowed,true);
  assert.deepEqual(f.objects.get(`${f.bucket}/${ticket.path}`),f.original);
 }finally{await h.close();}
});
