/* eslint-disable @typescript-eslint/no-require-imports -- Isolated real PostgreSQL contract tests, no remote credentials. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const runtime=process.env.FULL_DESIGN_B1_SQL_RUNTIME;
const sql=fs.readFileSync('tests/fixtures/full-design-copy-b1/contract.sql','utf8');
const actor={id:'qa-user',name:'QA 작업자',role:'user'};
const rpc='select b1_isolated.copy_contract($1,$2,$3,$4,$5,$6,$7,$8) result';
const copyColumns=['title_font_asset_id','body_font_asset_id','caption_font_asset_id','button_font_asset_id','text_alignment','title_alignment','summary_alignment','body_alignment','updated_at'];
const withoutDesign=a=>Object.fromEntries(Object.entries(a).filter(([k])=>!copyColumns.includes(k)));
test('B1 is a fixture, never a runtime migration or public route',()=>{
 assert(sql.includes("current_database() !~ '^mns_b1_"));assert(sql.includes("current_setting('newsletter.b1_isolated',true)"));
 assert(!sql.includes('create or replace function public.'));assert(!sql.includes('create function public.'));
 assert(!fs.readdirSync('supabase').some(n=>n.includes('full_design_copy_b1')));
});
test('B1 isolated PostgreSQL integration', {skip:!runtime,timeout:120000},async t=>{
 const env=await require('./fixtures/full-design-copy-b1/postgres.cjs')(runtime),{db,second,observer}=env;
 try {
  await db.query(sql);
  const reset=async()=>{
   await db.query('rollback');await second.query('rollback');
   await db.query('truncate newsletter_projects,font_assets,font_families cascade;truncate b1_isolated.receipts');
   const p=randomUUID(),q=randomUUID(),s=randomUUID(),d=randomUUID(),u=randomUUID(),f=randomUUID(),f2=randomUUID(),fm=randomUUID(),asset=randomUUID(),top=randomUUID(),sc=randomUUID(),dc=randomUUID();
   await db.query("insert into font_families values($1,true,true)",[fm]);
   await db.query("insert into font_assets values($1,$3,'fonts/regular.woff2','woff2',true,true),($2,$3,'fonts/bold.otf','otf',true,true)",[f,f2,fm]);
   await db.query("insert into newsletter_projects(id,assignee_name,title_font_asset_id,body_font_asset_id) values($1,'QA 작업자',$3,$4),($2,'다른 작업자',null,null)",[p,q,f,f2]);
   await db.query(`insert into newsletter_articles(id,project_id,title,summary,body,status,sort_order,title_font_asset_id,body_font_asset_id,caption_font_asset_id,button_font_asset_id,text_alignment,title_alignment,summary_alignment,body_alignment)
    values($1,$4,'원본 제목','원본 요약','원본 본문','draft',10,$5,null,$6,null,'left','center','right','left'),
     ($2,$4,'대상 제목','대상 요약','대상 본문','draft',20,null,$6,null,$5,'right','left','left','right'),($3,$7,'다른 기사',null,null,'draft',10,null,null,null,null,null,null,null,null)`,[s,d,u,p,f,f2,q]);
   await db.query("insert into newsletter_link_actions(project_id,article_id,label,action_type,target_value) values($1,$2,'행동 버튼','url','https://example.test/action')",[p,d]);
   await db.query("insert into newsletter_content_blocks(project_id,article_id,block_type,body,sort_order) values($1,$2,'paragraph','보존할 문단',0)",[p,d]);
   await db.query("insert into newsletter_project_design_assets values($1,$3,'background','design-production-assets','projects/background.png','image/png',true,'draft'),($2,$3,'illustration','design-production-assets','projects/top.webp','image/webp',true,'approved')",[asset,top,p]);
   const src={textDesign:{captionStyled:true,bodyEmphasis:'info',labelEnabled:true,label:'원본 라벨',subtitleEnabled:true,subtitle:'원본 소제목',numberEnabled:true,number:'12',numberShape:'circle'},productionPattern:'event',sourceOnly:'not copied'};
   const dst={textDesign:{label:'대상 라벨',subtitle:'대상 소제목',number:'8',bodyEmphasis:'quote'},productionPattern:'manual',targetOnly:'preserved'};
   await db.query("insert into newsletter_article_compositions(id,project_id,article_id,status,settings) values($1,$3,$4,'ready',$6),($2,$3,$5,'ready',$7)",[sc,dc,p,s,d,src,dst]);
   await db.query("insert into newsletter_article_composition_assets(composition_id,asset_id,slot,settings) values($1,$3,'hero_background','{\"opacity\":0.7,\"titleColor\":\"#123456\"}'),($1,$4,'hero_illustration','{\"scale\":1.2}'),($2,$3,'hero_background','{}')",[sc,dc,asset,top]);
   const call=async(action='prepare',options={})=>{
    const r=await(options.client||db).query(rpc,[action,options.p||p,options.s||s,options.d||d,options.actor||actor,options.key||null,options.sr??null,options.tr??null]);return r.rows[0].result;
   };
   const prepare=()=>call();
   const execute=(plan,key=randomUUID(),options={})=>call('execute',{key,sr:plan.sourceRevision,tr:plan.targetRevision,...options});
   return {p,q,s,d,u,f,f2,fm,asset,top,sc,dc,call,prepare,execute};
  };
  const row=async(id)=> (await db.query('select to_jsonb(a) v from newsletter_articles a where id=$1',[id])).rows[0]?.v;
  const digest=async()=> (await db.query(`select jsonb_build_object('a',(select jsonb_agg(to_jsonb(a) order by id) from newsletter_articles a),
   'c',(select jsonb_agg(to_jsonb(c) order by id) from newsletter_article_compositions c),
   'x',(select jsonb_agg(to_jsonb(x) order by id) from newsletter_article_composition_assets x),
   'b',(select jsonb_agg(to_jsonb(b) order by id) from newsletter_content_blocks b),'l',(select jsonb_agg(to_jsonb(l) order by id) from newsletter_link_actions l)) v`)).rows[0].v;
  await t.test('prepare is read-only and execute preserves content, raw font nulls, labels, blocks/links and source',async()=>{
   const h=await reset(),before=await digest(),a=await row(h.d),plan=await h.prepare();assert.equal(plan.plan.placementCount,2);assert.deepEqual(await digest(),before);
   const r=await h.execute(plan);assert.equal(r.outcome,'success');assert(!r.replayed);
   const b=await row(h.d);assert.deepEqual(withoutDesign(b),withoutDesign(a));assert.equal(b.body_font_asset_id,null);assert.equal(b.title_font_asset_id,h.f);assert.equal(b.caption_font_asset_id,h.f2);assert.equal(b.button_font_asset_id,null);
   const after=await digest();assert.deepEqual(after.b,before.b);assert.deepEqual(after.l,before.l);assert.deepEqual(after.a.find(x=>x.id===h.s),before.a.find(x=>x.id===h.s));
   const comp=after.c.find(x=>x.article_id===h.d);assert.equal(comp.status,'draft');assert.equal(comp.settings.targetOnly,'preserved');assert(!comp.settings.sourceOnly);assert.equal(comp.settings.textDesign.label,'대상 라벨');assert.equal(comp.settings.textDesign.subtitle,'대상 소제목');assert.equal(comp.settings.textDesign.number,'8');assert.equal(comp.settings.textDesign.bodyEmphasis,'info');assert.equal(comp.settings.productionPattern,'event');
   assert.equal(after.x.filter(x=>x.composition_id===h.dc).length,2);
  });
  await t.test('no target composition and empty target strings normalize enabled without copying content',async()=>{
   const h=await reset();await db.query('delete from newsletter_article_compositions where id=$1',[h.dc]);const p=await h.prepare();
   for(const k of ['labelEnabled','subtitleEnabled','numberEnabled'])assert.equal(p.plan.textDesign[k],false);
   await h.execute(p);const c=(await db.query('select settings from newsletter_article_compositions where article_id=$1',[h.d])).rows[0].settings;
   assert.equal(c.textDesign.label,undefined);
  });
  await t.test('all public/ambiguous states and historical published_at fail closed',async()=>{
   for(const status of ['published','private','in_review','archived']){const h=await reset();await db.query('update newsletter_projects set status=$1 where id=$2',[status,h.p]);await assert.rejects(h.prepare(),e=>e.code==='PT409');}
   for(const field of ['published_at','deleted_at','archived_at']){const h=await reset();await db.query(`update newsletter_projects set ${field}=now() where id=$1`,[h.p]);await assert.rejects(h.prepare(),e=>e.code==='PT409');}
  });
  await t.test('ownership, same-article and trusted actor authorization',async()=>{
   const h=await reset();await assert.rejects(h.call('prepare',{d:h.u}),e=>e.code==='PT409');await assert.rejects(h.call('prepare',{d:h.s}),e=>e.code==='PT409');
   for(const user of [{id:'other',name:'other',role:'user'},{id:'x',name:'x',role:'owner'},{}])await assert.rejects(h.call('prepare',{actor:user}),e=>e.code==='42501');
   assert.equal((await h.call('prepare',{actor:{id:'admin',name:'관리자',role:'admin'}})).outcome,'prepared');
  });
  await t.test('zero placements fail closed; Draft and Approved accepted, invalid references rejected',async()=>{
   let h=await reset();await db.query('delete from newsletter_article_composition_assets where composition_id=$1',[h.sc]);await assert.rejects(h.prepare(),e=>e.message==='source_empty');
   for(const patch of ["is_active=false","approval_status='archived'","project_id='{q}'","storage_bucket='brand-assets'","storage_path='../escape.png'","mime_type='application/pdf'","asset_type='logo'"]){
    h=await reset();const mutation=db.query(`update newsletter_project_design_assets set ${patch.replace('{q}',h.q)} where id=$1`,[h.asset]);
    if(patch.startsWith('project_id')||patch.startsWith('asset_type'))await assert.rejects(mutation,e=>e.code==='23514');
    else {await mutation;await assert.rejects(h.prepare(),e=>e.code==='PT409');}
   }
  });
  await t.test('font and family inactive/webfont invalid prevent mutation',async()=>{
   for(const table of ['font_assets','font_families'])for(const col of ['is_active','webfont_allowed']){
    const h=await reset();await db.query(`update ${table} set ${col}=false where id=$1`,[table==='font_assets'?h.f:h.fm]);await assert.rejects(h.prepare(),e=>e.code==='PT409');
   }
  });
  await t.test('text and placement allowlists reject injected or out-of-range values',async()=>{
   for(const settings of [{fontSize:99},{captionStyled:'yes'},{label:'x'.repeat(81)},{label:'😀'.repeat(41)},{number:'a'},{bodyEmphasis:'html'}]){const h=await reset();await db.query("update newsletter_article_compositions set settings=jsonb_build_object('textDesign',$1::jsonb) where id=$2",[settings,h.sc]);await assert.rejects(h.prepare(),e=>e.code==='22023');}
   for(const settings of [{url:'https://example.test'},{opacity:2},{scale:0},{surfaceColor:'red'},{offsetX:'3'}]){const h=await reset();await db.query("update newsletter_article_composition_assets set settings=$1 where composition_id=$2 and slot='hero_background'",[settings,h.sc]);await assert.rejects(h.prepare(),e=>e.code==='22023');}
  });
  await t.test('stale source, target, placement, asset, family, project defaults detected',async()=>{
   const mutations=[h=>['update newsletter_articles set body=\'새 본문\' where id=$1',[h.s]],h=>['update newsletter_articles set summary=\'새 요약\' where id=$1',[h.d]],h=>["update newsletter_article_composition_assets set settings='{\"rotation\":20}' where composition_id=$1",[h.sc]],h=>["update newsletter_project_design_assets set approval_status='approved' where id=$1",[h.asset]],h=>["update font_families set webfont_allowed=false where id=$1",[h.fm]],h=>['update newsletter_projects set title_font_asset_id=null where id=$1',[h.p]]];
   for(const mutation of mutations){const h=await reset(),p=await h.prepare();const [q,args]=mutation(h);await db.query(q,args);const before=await digest();await assert.rejects(h.execute(p),e=>e.code==='PT409');assert.deepEqual(await digest(),before);assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'0');}
  });
  await t.test('durable duplicate and response-loss recovery; payload mismatch and unrelated actor denied',async()=>{
   const h=await reset(),p=await h.prepare(),key=randomUUID(),first=await h.execute(p,key),after=await digest();
   await db.query("update newsletter_articles set body='나중 편집' where id=$1",[h.s]);
   const repeat=await h.execute(p,key);assert(repeat.replayed);assert.deepEqual(repeat.result,first.result);
   const recovered=await h.call('result',{key,sr:p.sourceRevision,tr:p.targetRevision});assert.deepEqual(recovered.result,first.result);
   assert.deepEqual((await digest()).x,after.x);assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'1');
   await assert.rejects(h.execute(p,key,{tr:'different'}),e=>e.message==='request_key_conflict');
   await assert.rejects(h.call('result',{key,sr:p.sourceRevision,tr:p.targetRevision,actor:{id:'bad',name:'bad',role:'user'}}),e=>e.code==='42501');
   assert.equal((await h.call('result',{key:randomUUID()})).outcome,'unknown');
  });
  await t.test('failure at receipt INSERT rolls article, composition and placements back together',async()=>{
   const h=await reset(),p=await h.prepare(),before=await digest(),key=randomUUID();
   await db.query("create function b1_isolated.fail_receipt() returns trigger language plpgsql as $$begin raise exception 'fixture_commit_failure';end$$;create trigger fail_receipt before insert on b1_isolated.receipts for each row execute function b1_isolated.fail_receipt()");
   try{await assert.rejects(h.execute(p,key),/fixture_commit_failure/);assert.deepEqual(await digest(),before);}finally{await db.query('drop trigger fail_receipt on b1_isolated.receipts;drop function b1_isolated.fail_receipt()');}
   await h.execute(p,key);assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'1');
  });
  // Observe PostgreSQL lock waits; no mock Promise delays substituted for DB concurrency.
  const blocked=async(client,promise)=>{
   let done=false;const observed=promise.finally(()=>done=true);let waiting=false;
   for(let i=0;i<100;i++){const r=await observer.query("select wait_event_type from pg_stat_activity where pid=$1",[client.processID]);if(r.rows[0]?.wait_event_type==='Lock'){waiting=true;break;}if(done)break;await new Promise(r=>setTimeout(r,10));}
   assert(waiting,'second PostgreSQL connection must actually wait on a lock');return {observed};
  };
  await t.test('same request concurrently executes once and result waits for committed receipt',async()=>{
   const h=await reset(),p=await h.prepare(),key=randomUUID();await db.query('begin');const first=await h.execute(p,key);
   const pending=h.call('result',{client:second,key,sr:p.sourceRevision,tr:p.targetRevision});const {observed}=await blocked(second,pending);await db.query('commit');assert.deepEqual((await observed).result,first.result);
   const r=await h.execute(p,key,{client:second});assert(r.replayed);assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'1');
  });
  await t.test('two new request keys with the same snapshot: exactly one succeeds',async()=>{
   const h=await reset(),p=await h.prepare();await db.query('begin');await h.execute(p);
   const pending=h.execute(p,randomUUID(),{client:second});const rejected=assert.rejects(pending,e=>e.code==='PT409');await blocked(second,pending.catch(()=>null));await db.query('commit');await rejected;
   assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'1');
  });
  await t.test('direct source placement writer wins first: B1 rechecks and rejects stale',async()=>{
   const h=await reset(),p=await h.prepare();await second.query('begin');await second.query("update newsletter_article_composition_assets set settings='{\"rotation\":10}' where composition_id=$1",[h.sc]);
   const pending=h.execute(p),rejected=assert.rejects(pending,e=>e.code==='PT409');await blocked(db,pending.catch(()=>null));await second.query('commit');await rejected;
  });
  await t.test('legacy article save serializes project-first and preserves changed content',async()=>{
   const h=await reset(),p=await h.prepare();await second.query('begin');await second.query('select save_newsletter_article_atomic($1,$2,$3,$4)',[h.p,h.d,{title:'편집 저장',body:'새 본문',status:'draft'},JSON.stringify([])]);
   const pending=h.execute(p),rejected=assert.rejects(pending,e=>e.code==='PT409');await blocked(db,pending.catch(()=>null));await second.query('commit');await rejected;assert.equal((await row(h.d)).body,'새 본문');assert.equal((await row(h.d)).sort_order,20);
  });
  await t.test('legacy delete wins: stale copy cannot recreate or write an orphan',async()=>{
   const h=await reset(),p=await h.prepare();await second.query('begin');await second.query('select delete_newsletter_article_atomic($1,$2)',[h.p,h.d]);
   const pending=h.execute(p),rejected=assert.rejects(pending,e=>e.code==='PT409');await blocked(db,pending.catch(()=>null));await second.query('commit');await rejected;assert.equal(await row(h.d),undefined);
  });
  await t.test('legacy A placement copy stays independent, including opposite direction',async()=>{
   const h=await reset(),before=await row(h.d);await db.query('select copy_newsletter_article_composition_atomic($1,$2,$3)',[h.p,h.s,h.d]);assert.deepEqual(await row(h.d),before);
   assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'0');
   const p=await h.prepare();await db.query('begin');await h.execute(p);
   const pending=second.query('select copy_newsletter_article_composition_atomic($1,$2,$3)',[h.p,h.d,h.s]);await blocked(second,pending);await db.query('commit');await pending;
  });
  await t.test('service role only RPC, helper and direct table privileges closed; guard on every call',async()=>{
   const h=await reset();await db.query('set role service_role');try{
    assert.equal((await h.prepare()).outcome,'prepared');await assert.rejects(db.query('select * from b1_isolated.receipts'),e=>e.code==='42501');
    await assert.rejects(db.query('select b1_isolated.fingerprint($1,$2)',[h.p,h.s]),e=>e.code==='42501');
   }finally{await db.query('reset role');}
   for(const role of ['anon','authenticated']){await db.query('set role '+role);try{await assert.rejects(h.prepare(),e=>e.code==='42501');}finally{await db.query('reset role');}}
   await db.query("set newsletter.b1_isolated='off'");try{await assert.rejects(h.prepare(),e=>e.code==='42501');}finally{await db.query("set newsletter.b1_isolated='on'");}
   await db.query("set request.jwt.claim.role='anon'");try{await assert.rejects(h.prepare(),e=>e.code==='42501');}finally{await db.query("set request.jwt.claim.role='service_role'");}
  });
  await t.test('legacy copy creating a composition cannot form article/project lock inversion with B1',async()=>{
   const h=await reset();await db.query('delete from newsletter_article_compositions where id=$1',[h.dc]);const p=await h.prepare();
   await db.query('begin');await db.query('select 1 from newsletter_projects where id=$1 for update',[h.p]);
   await second.query('begin');await second.query('select 1 from newsletter_articles where id=any($1::uuid[]) order by id for update',[[h.s,h.d]]);
   const legacy=second.query('select copy_newsletter_article_composition_atomic($1,$2,$3)',[h.p,h.s,h.d]);await blocked(second,legacy);
   await assert.rejects(h.execute(p),e=>e.code==='PT409'&&e.message==='design_copy_busy');await db.query('rollback');await legacy;await second.query('commit');
   assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'0');await h.execute(await h.prepare());
  });
  await t.test('publication history and future independent-publication schema require explicit integration',async()=>{
   const h=await reset();await db.query('create table newsletter_project_publication_events(project_id uuid)');
   try {assert.equal((await h.prepare()).outcome,'prepared');await db.query('insert into newsletter_project_publication_events values($1)',[h.p]);await assert.rejects(h.prepare(),e=>e.message==='publication_history_not_supported');}
   finally {await db.query('drop table newsletter_project_publication_events');}
   await db.query('create table newsletter_article_publications(article_id uuid)');
   try {await assert.rejects(h.prepare(),e=>e.message==='independent_publication_integration_required');}finally{await db.query('drop table newsletter_article_publications');}
  });
  await t.test('fingerprints do not depend on connection timezone',async()=>{
   const h=await reset(),p=await h.prepare();await second.query("set timezone='Asia/Seoul'");
   try {const next=await h.call('prepare',{client:second});assert.equal(next.sourceRevision,p.sourceRevision);assert.equal(next.targetRevision,p.targetRevision);}finally{await second.query("set timezone='UTC'");}
  });
  await t.test('existing font/family ON DELETE SET NULL invalidates prepare without new FK delete restrictions',async()=>{
   for(const table of ['font_assets','font_families']){
    const h=await reset(),p=await h.prepare();await db.query(`delete from ${table} where id=$1`,[table==='font_assets'?h.f:h.fm]);
    await assert.rejects(h.execute(p),e=>e.code==='PT409');
    if(table==='font_assets')assert.equal((await row(h.s)).title_font_asset_id,null);
   }
  });
  await t.test('block/link edits invalidate prepared revision without copying their contents',async()=>{
   for(const table of ['newsletter_content_blocks','newsletter_link_actions']){
    const h=await reset(),p=await h.prepare();await db.query(`update ${table} set ${table==='newsletter_content_blocks'?"body='수정 문단'":"label='수정 버튼'"} where article_id=$1`,[h.d]);await assert.rejects(h.execute(p),e=>e.message==='design_copy_stale');
   }
  });
  await t.test('two concurrent execute calls with one key insert exactly one receipt',async()=>{
   const h=await reset(),p=await h.prepare(),key=randomUUID();await db.query('begin');const first=await h.execute(p,key);
   const pending=h.execute(p,key,{client:second});await blocked(second,pending);await db.query('commit');assert.deepEqual((await pending).result,first.result);assert((await h.execute(p,key)).replayed);
   assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'1');
  });
  await t.test('project becomes published between prepare and execute: no design write',async()=>{
   const h=await reset(),p=await h.prepare();await second.query('begin');await second.query("update newsletter_projects set status='published',published_at=now() where id=$1",[h.p]);
   const pending=h.execute(p),rejected=assert.rejects(pending,e=>e.message==='unpublished_draft_project_required');await blocked(db,pending.catch(()=>null));await second.query('commit');await rejected;
   assert.equal((await db.query('select count(*) from b1_isolated.receipts')).rows[0].count,'0');
  });
  await t.test('installation guard rejects ordinary database name before DDL',async()=>{
   await assert.rejects(env.root.query(sql),e=>e.code==='42501');await env.root.query('rollback');assert.equal((await env.root.query("select to_regnamespace('b1_isolated') v")).rows[0].v,null);
  });
 }finally{await env.close();}
});
