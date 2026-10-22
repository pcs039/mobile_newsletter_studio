/* eslint-disable @typescript-eslint/no-require-imports -- Mock transport; fake credentials only. */
const {randomUUID}=require('node:crypto'),sharp=require('sharp');
const load=require('./canva-test-loader.cjs')();
const {SupabasePublicationStore,preservationPath}=load('src/lib/article-publication-supabase-store.ts');
const {publicationPreservationBucket:bucket}=load('src/lib/article-publication-storage-policy.ts');
module.exports=async function fixture(){
 const i={projectId:randomUUID(),articleId:randomUUID(),preparationId:randomUUID(),fileId:randomUUID()};
 const source={...i,sourceId:randomUUID(),bucket:'mobile-assets',path:`projects/${i.projectId}/source.png`,mime:'image/png'};
 const original=await sharp({create:{width:4,height:5,channels:3,background:'#335577'}}).png().toBuffer();
 const state={reservation:null,pinned:false,denied:false,deleted:false,private:true,failVerified:false,afterUpload:null,afterDownload:null,posts:0,gets:0,deletes:0,calls:[],override:null};
 const objects=new Map([[`${source.bucket}/${source.path}`,original]]);
 let queue=Promise.resolve();
 async function lock(operation){const prior=queue;let done;queue=new Promise(r=>done=r);await prior;try{return await operation();}finally{done();}}
 const ledger={
  async source(){if(state.denied||state.deleted)throw Error('source_denied');return {...source};},
  async find(){return state.reservation;},
  async reserve(s,d){return lock(async()=>{
   const next={...i,...d,path:preservationPath(i,d),lease:randomUUID()};
   if(state.reservation){if(state.reservation.sha256!==d.sha256)throw Error('reservation_conflict');return state.reservation;}
   state.reservation=next;return next;
  });},
  async exclusive(r,operation){return lock(async()=>{if(state.deleted||r.lease!==state.reservation?.lease)throw Error('lease_denied');return operation();});},
  async verified(){if(state.failVerified){state.failVerified=false;throw Error('db_commit_failure');}},
  async access(file){return state.pinned&&!state.denied&&!state.deleted&&file.fileId===i.fileId&&file.projectId===i.projectId&&file.articleId===i.articleId?state.reservation:null;},
  async gc(fileId,operation){return lock(async()=>{if(state.pinned)throw Error('gc_pinned');if(state.deleted)return;if(fileId!==i.fileId)throw Error('not_found');await operation(state.reservation);state.deleted=true;});}
 };
 const transport=async(url,init)=>{
  const parsed=new URL(url),p=parsed.pathname.replace('/storage/v1/','');state.calls.push({path:p,method:init.method,headers:init.headers,redirect:init.redirect,cache:init.cache});
  if(state.override){const value=await state.override(p,init);if(value)return value;}
  if(p===`bucket/${bucket}`)return Response.json({id:bucket,public:!state.private});
  if(init.method==='DELETE'){state.deletes++;const path=JSON.parse(init.body).prefixes[0];objects.delete(`${bucket}/${path}`);return Response.json([]);}
  const key=p.replace(/^object\/(authenticated\/)?/,'');
  if(init.method==='POST'){
   state.posts++;if(objects.has(key))return Response.json({error:'duplicate'},{status:400});
   objects.set(key,Buffer.from(init.body));await state.afterUpload?.(key);return Response.json({Key:key});
  }
  state.gets++;const bytes=objects.get(key);
  if(!bytes)return Response.json({error:'not found'},{status:404});
  await state.afterDownload?.(key);return new Response(bytes,{headers:{'content-type':'image/png','content-length':String(bytes.length)}});
 };
 const options={projectRef:'aaaaaaaaaaaaaaaaaaaa',url:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',credentials:async()=>({apikey:'fake-test-key',bearer:'fake-test-bearer'}),transport,sourceBuckets:['mobile-assets']};
 const store=new SupabasePublicationStore(options);
 return {i,source,original,state,objects,ledger,store,options,bucket,file:{projectId:i.projectId,articleId:i.articleId,revisionId:randomUUID(),fileId:i.fileId}};
};
