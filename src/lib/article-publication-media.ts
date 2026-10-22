import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getSharp } from "next/dist/server/image-optimizer";
import { create as createFont } from "fontkit";
import { publicationHash, type PublicationJson } from "@/lib/article-publication-canonical";
import { buildArticlePublicationSnapshot, type PublicationCapture } from "@/lib/article-publication-snapshot";

type Context={projectId:string;articleId:string;actorId:string;actorName:string;actorRole:"admin"|"user";assignee:string};
type Prep={id:string;capture:PublicationCapture;sourceHash:string;version:number;revisionId:string|null;status:string};
const gcPermit=Symbol("isolated-publication-gc");
export interface PublicationDatabase {
  query(sql:string,values:unknown[]):Promise<{rows:Record<string,unknown>[]}>
}
export class IsolatedPublicationStore {
  readonly #source=new Map<string,Buffer>();
  readonly #preserved=new Map<string,Buffer>();
  #safe(path:string) {
    if(!/^projects\/[0-9a-f-]{36}\//i.test(path)||/[%\\?#:]/.test(path)||path.split("/").some(x=>!x||x==="."||x===".."))throw Error("mock_private_path");
  }
  setSource(path:string,bytes:Buffer){this.#safe(path);if(bytes.length>16777216)throw Error("media_byte_limit");this.#source.set(path,Buffer.from(bytes));}
  deleteSource(path:string){this.#safe(path);this.#source.delete(path);}
  source(path:string){this.#safe(path);const v=this.#source.get(path);if(!v)throw Error("source_missing");return Buffer.from(v);}
  preserved(path:string){this.#safe(path);const v=this.#preserved.get(path);if(!v)throw Error("preserved_missing");return Buffer.from(v);}
  preserve(path:string,bytes:Buffer){this.#safe(path);const old=this.#preserved.get(path);if(old&&!old.equals(bytes))throw Error("preserved_overwrite_forbidden");if(!old)this.#preserved.set(path,Buffer.from(bytes));return Boolean(old);}
  // Internal worker supplies a DB-authorized deletion decision; not a generic Storage API.
  finishGc(path:string,permit:symbol){if(permit!==gcPermit)throw Error("gc_permit_required");this.#safe(path);this.#preserved.delete(path);}
  get count(){return this.#preserved.size;}
}

const digest=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
export async function inspectPublicationBytes(bytes:Buffer,mime:string):Promise<Record<string,PublicationJson>>{
  if(!bytes.length||bytes.length>16*1024*1024)throw Error("media_byte_limit");
  if(mime.startsWith("image/")){
    const detected=bytes.subarray(0,8).toString("hex")==="89504e470d0a1a0a"?"image/png":
      bytes[0]===255&&bytes[1]===216?"image/jpeg":bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP"?"image/webp":"";
    if(detected!==mime)throw Error("media_mime_mismatch");
    const image=getSharp(1,false)(bytes,{limitInputPixels:8000000,failOn:"warning"});
    const metadata=await image.metadata();
    if(!metadata.width||!metadata.height||metadata.pages&&metadata.pages>1)throw Error("media_dimensions");
    await image.clone().raw().toBuffer(); // Decode, not just trust IHDR/content-type.
    return {width:metadata.width,height:metadata.height};
  }
  if(mime==="audio/wav"){
    if(bytes.length<44||bytes.toString("ascii",0,4)!=="RIFF"||bytes.toString("ascii",8,12)!=="WAVE"||bytes.readUInt32LE(4)+8!==bytes.length)throw Error("media_wav_invalid");
    let offset=12,rate=0,align=0,data=0;
    while(offset+8<=bytes.length){const name=bytes.toString("ascii",offset,offset+4),size=bytes.readUInt32LE(offset+4);offset+=8;
      if(offset+size>bytes.length)throw Error("media_wav_truncated");
      if(name==="fmt "){if(size<16||bytes.readUInt16LE(offset)!==1)throw Error("media_wav_codec");rate=bytes.readUInt32LE(offset+4);align=bytes.readUInt16LE(offset+12);
        const channels=bytes.readUInt16LE(offset+2),bits=bytes.readUInt16LE(offset+14);
        if(![1,2].includes(channels)||![8,16,24,32].includes(bits)||align!==channels*bits/8||bytes.readUInt32LE(offset+8)!==rate*align||rate<8000||rate>192000)throw Error("media_wav_format");}
      if(name==="data")data+=size;offset+=size+(size%2);
    }
    if(offset!==bytes.length||!rate||!align||!data||data%align)throw Error("media_wav_invalid");
    return {sampleRate:rate,durationMicros:Math.round(data/align/rate*1000000)};
  }
  if(mime==="audio/mpeg"){
    let offset=0,frames=0,duration=0;
    if(bytes.toString("ascii",0,3)==="ID3"){
      if(bytes.length<10||[...bytes.subarray(6,10)].some(v=>v>127)||(bytes[5]&0x10))throw Error("media_mp3_tag");
      offset=10+bytes[6]*2097152+bytes[7]*16384+bytes[8]*128+bytes[9];
    }
    while(offset<bytes.length){
      if(bytes.length-offset===128&&bytes.toString("ascii",offset,offset+3)==="TAG"){offset+=128;break;}
      if(offset+4>bytes.length||bytes[offset]!==255||(bytes[offset+1]&0xe0)!==0xe0)throw Error("media_mp3_frame");
      const version=(bytes[offset+1]>>3)&3,layer=(bytes[offset+1]>>1)&3,index=(bytes[offset+2]>>4)&15,sample=(bytes[offset+2]>>2)&3;
      if(version===1||layer!==1||index===0||index===15||sample===3)throw Error("media_mp3_codec");
      const rates=version===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
      const rate=[44100,48000,32000][sample]/(version===3?1:version===2?2:4);
      const size=Math.floor((version===3?144000:72000)*rates[index]/rate)+((bytes[offset+2]>>1)&1);
      if(size<4||offset+size>bytes.length||++frames>1000000)throw Error("media_mp3_truncated");
      duration+=(version===3?1152:576)/rate;offset+=size;
    }
    if(!frames||offset!==bytes.length)throw Error("media_mp3_invalid");
    return {frames,durationMicros:Math.round(duration*1000000)}; // Frame validation, not a playback claim.
  }
  if(mime.startsWith("font/")){
    const signatures:Record<string,string[]>={"font/ttf":["00010000","74727565"],"font/otf":["4f54544f"],"font/woff":["774f4646"],"font/woff2":["774f4632"]};
    if(!signatures[mime]?.includes(bytes.subarray(0,4).toString("hex")))throw Error("media_font_format");
    const font=createFont(bytes);if("fonts" in font||!font.familyName||!font.numGlyphs)throw Error("media_font_invalid");
    return {family:font.familyName,glyphs:font.numGlyphs};
  }
  throw Error("media_unsupported_mime");
}

// Deliberately has no Supabase client, fetch, secrets or environment fallback.
// Its SQL counterpart additionally refuses non-loopback/non-isolated databases.
export class IsolatedArticlePublicationWorker {
  readonly #leases=new Map<string,string>();
  constructor(readonly db:PublicationDatabase,readonly store:IsolatedPublicationStore){}
  async rpc<T>(name:string,args:unknown[]):Promise<T>{
    const allowed=["prepare_article_publication_a2","stage_article_publication_a2","reserve_article_media_a2","verify_article_media_a2","finalize_article_publication_a2","transition_article_publication_a2","article_publication_file_access_a2","article_publication_gc_a2","confirm_article_source_cleanup_a2"];
    if(!allowed.includes(name))throw Error("internal_rpc");
    const values=args.map(a=>a!==null&&typeof a==="object"?JSON.stringify(a):a);
    return (await this.db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) r`,values)).rows[0].r as T;
  }
  prepare(c:Context,key=randomUUID(),intent="publish",historical:string|null=null){return this.rpc<Prep>("prepare_article_publication_a2",[c,key,intent,historical]);}
  async preserve(c:Context,prep:Prep,faults:{afterCopy?:(fileId:string)=>Promise<void>}={}){
    if(prep.revisionId)return this.rpc<{revisionId:string}>("finalize_article_publication_a2",[c,prep.id]);
    const built=buildArticlePublicationSnapshot(prep.capture,prep.id);
    if(built.sourceHash!==prep.sourceHash)throw Error("capture_canonical_mismatch");
    await this.rpc("stage_article_publication_a2",[c,prep.id,built.candidate,built.requirements,built.sourceHash]);
    let totalBytes=0;
    for(const file of built.requirements){
      const bytes=this.store.source(file.path),facts=await inspectPublicationBytes(bytes,file.mime),sha=digest(bytes);
      totalBytes+=bytes.length;if(totalBytes>64*1024*1024)throw Error("preparation_byte_limit");
      const lease=this.#leases.get(file.fileId)??randomUUID();this.#leases.set(file.fileId,lease);
      const reserved=await this.rpc<{path:string}>("reserve_article_media_a2",[c,prep.id,file.fileId,sha,bytes.length,file.mime,facts,lease]);
      this.store.preserve(reserved.path,bytes);
      await faults.afterCopy?.(file.fileId);
      const preserved=this.store.preserved(reserved.path);
      if(digest(preserved)!==sha||preserved.length!==bytes.length||publicationHash(await inspectPublicationBytes(preserved,file.mime))!==publicationHash(facts))throw Error("preserved_integrity");
      if(digest(this.store.source(file.path))!==sha)throw Error("source_changed_during_copy");
      await this.rpc("verify_article_media_a2",[c,prep.id,file.fileId,lease]);
    }
    return this.rpc<{revisionId:string}>("finalize_article_publication_a2",[c,prep.id]);
  }
  transition(c:Context,key:string,action:string,version:number,preparation:string|null){return this.rpc<Record<string,PublicationJson>>("transition_article_publication_a2",[c,key,action,version,preparation]);}
  async read(project:string,article:string,revision:string,file:string){
    const decision=await this.rpc<{allowed:boolean;path:string;sha256:string;bytes:number;mime:string}>("article_publication_file_access_a2",[project,article,revision,file]);
    if(!decision.allowed)throw Error("revision_file_denied");
    const bytes=this.store.preserved(decision.path);if(bytes.length!==decision.bytes||digest(bytes)!==decision.sha256)throw Error("preserved_integrity");
    await inspectPublicationBytes(bytes,decision.mime);return bytes;
  }
  async gc(file:string,token=randomUUID()){
    const decision=await this.rpc<{path:string;status:string}>("article_publication_gc_a2",[file,token,false]);
    if(decision.status!=="deleted"){this.store.finishGc(decision.path,gcPermit);await this.rpc("article_publication_gc_a2",[file,token,true]);}
  }
}
