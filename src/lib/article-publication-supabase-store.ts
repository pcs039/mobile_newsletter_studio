import "server-only";
import {createHash} from "node:crypto";
import {inspectPublicationBytes} from "@/lib/article-publication-media";
import {publicationHash, type PublicationJson} from "@/lib/article-publication-canonical";
import {publicationPreservationBucket as bucket, publicationPreservationPrefix as prefix, isPublicationStorageReference} from "@/lib/article-publication-storage-policy";

export type PreservationIdentity={projectId:string;articleId:string;preparationId:string;fileId:string};
export type PreservationSource=PreservationIdentity & {sourceId:string;bucket:string;path:string;mime:string};
export type PreservationDescriptor={sha256:string;bytes:number;mime:string;facts:Record<string,PublicationJson>};
export type PreservationReservation=PreservationIdentity & PreservationDescriptor & {path:string;lease:string};
export type RevisionFile={projectId:string;articleId:string;revisionId:string;fileId:string};

// Must be implemented with database ownership/role checks, not caller assertions.
// reserve commits a durable planned object BEFORE upload. exclusive rechecks and
// locks the ledger row through the callback, fencing pin/GC against in-flight IO.
// Storage is never described as part of a rollback-able DB transaction.
export interface PreservationLedger {
  // source also checks current actor/assignee, preparation freshness and source
  // approval/active policy against the captured allowlist; never arbitrary input.
  source(identity:PreservationIdentity):Promise<PreservationSource>;
  find(identity:PreservationIdentity):Promise<PreservationReservation|null>;
  reserve(source:PreservationSource,descriptor:PreservationDescriptor):Promise<PreservationReservation>;
  exclusive<T>(reservation:PreservationReservation,operation:()=>Promise<T>):Promise<T>;
  verified(reservation:PreservationReservation):Promise<void>;
  access(file:RevisionFile):Promise<PreservationReservation|null>;
  // Commit deleting before any Storage DELETE; a failed DB completion must not
  // roll back to a publishable state after the object has already been removed.
  gc(fileId:string,operation:(reservation:PreservationReservation)=>Promise<void>):Promise<void>;
}
export type PreservationTransport=(url:string,init:RequestInit)=>Promise<Response>;
type StorageOptions={projectRef:string;url:string;credentials:(purpose:"source"|"preserved-read"|"preserved-insert"|"preserved-delete")=>Promise<{apikey:string;bearer:string}>;transport:PreservationTransport;sourceBuckets:readonly string[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const maxBytes=16*1024*1024;
function identity(i:PreservationIdentity){for(const v of [i.projectId,i.articleId,i.preparationId,i.fileId])if(!uuid.test(v))throw Error("preservation_identity");}
function same(a:PreservationIdentity,b:PreservationIdentity){identity(a);identity(b);for(const k of ["projectId","articleId","preparationId","fileId"] as const)if(a[k]!==b[k])throw Error("preservation_ownership");}
function safePath(p:string){if(!p||p.length>1024||/[%\\?#:\u0000-\u0020]/.test(p)||p.split("/").some(v=>!v||v==="."||v===".."))throw Error("preservation_path");}
export function preservationPath(r:PreservationIdentity,d:PreservationDescriptor){identity(r);if(!/^[a-f0-9]{64}$/.test(d.sha256))throw Error("preservation_hash");return `${prefix}/projects/${r.projectId}/articles/${r.articleId}/preparations/${r.preparationId}/${r.fileId}/${d.sha256}`;}
async function describe(bytes:Buffer,mime:string):Promise<PreservationDescriptor>{return {sha256:createHash("sha256").update(bytes).digest("hex"),bytes:bytes.length,mime,facts:await inspectPublicationBytes(bytes,mime)};}
function checkDescriptor(d:PreservationDescriptor){if(!Number.isSafeInteger(d.bytes)||d.bytes<1||d.bytes>maxBytes||!d.mime||!d.facts||typeof d.facts!=="object")throw Error("preservation_descriptor");publicationHash(d);}
function reservation(r:PreservationReservation){identity(r);checkDescriptor(r);if(!uuid.test(r.lease)||r.path!==preservationPath(r,r))throw Error("preservation_reservation");}
async function verify(bytes:Buffer,r:PreservationDescriptor){if(publicationHash(await describe(bytes,r.mime))!==publicationHash({sha256:r.sha256,bytes:r.bytes,mime:r.mime,facts:r.facts}))throw Error("preservation_integrity");}

// Explicit configuration only; no environment fallback, SDK singleton, signed URL,
// bucket creation, public fetch, arbitrary URL input, or automatic network execution.
export class SupabasePublicationStore {
  readonly #options:StorageOptions;
  readonly #origin:string;
  constructor(options:StorageOptions){
    const u=new URL(options.url);
    if(!/^[a-z0-9]{20}$/.test(options.projectRef)||u.origin!==`https://${options.projectRef}.supabase.co`||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw Error("preservation_supabase_origin");
    if(!options.sourceBuckets.length||options.sourceBuckets.some(b=>! /^[a-z0-9-]+$/.test(b)||isPublicationStorageReference(b)))throw Error("preservation_source_bucket");
    this.#options={...options,sourceBuckets:[...options.sourceBuckets]};this.#origin=u.origin;
  }
  async #request(objectBucket:string,path:string,method:"GET"|"POST"|"DELETE",mime?:string,bytes?:Buffer){
    safePath(path);
    const purpose=objectBucket!==bucket?"source":method==="GET"?"preserved-read":method==="POST"?"preserved-insert":"preserved-delete";
    const credentials=await this.#options.credentials(purpose);
    if(!credentials.apikey||!credentials.bearer||/[\r\n]/.test(credentials.apikey+credentials.bearer))throw Error("preservation_credentials");
    const encoded=path.split("/").map(encodeURIComponent).join("/");
    const route=method==="GET"?`object/authenticated/${objectBucket}/${encoded}`:method==="POST"?`object/${objectBucket}/${encoded}`:`object/${objectBucket}`;
    const headers:Record<string,string>={apikey:credentials.apikey,Authorization:`Bearer ${credentials.bearer}`,"Cache-Control":"no-store"};
    if(method==="POST"){headers["Content-Type"]=mime!;headers["x-upsert"]="false";}
    if(method==="DELETE")headers["Content-Type"]="application/json";
    try{
      return await this.#options.transport(`${this.#origin}/storage/v1/${route}`,{method,headers,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000),...(method==="POST"?{body:new Uint8Array(bytes!)}:method==="DELETE"?{body:JSON.stringify({prefixes:[path]})}:{})});
    }catch{throw Error("preservation_storage_outcome_unknown");} // Never include credential/url/provider body.
  }
  async #download(objectBucket:string,path:string,mime:string,missing=false):Promise<Buffer|null>{
    const response=await this.#request(objectBucket,path,"GET");
    if(missing&&response.status===404){await response.body?.cancel();return null;}
    const contentType=response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    const declared=response.headers.get("content-length");
    if(response.status!==200||contentType!==mime||response.headers.has("content-range")||(response.headers.get("content-encoding")&&response.headers.get("content-encoding")!=="identity")||declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes)){
      await response.body?.cancel();throw Error("preservation_download_invalid");
    }
    const reader=response.body?.getReader();if(!reader)throw Error("preservation_download_empty");
    const chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>maxBytes)throw Error("preservation_byte_limit");chunks.push(next.value);}}catch{await reader.cancel().catch(()=>undefined);throw Error("preservation_download_incomplete");}
    if(!size||declared!==null&&Number(declared)!==size)throw Error("preservation_download_incomplete");
    return Buffer.concat(chunks);
  }
  async #privateBucket(){
    const credentials=await this.#options.credentials("preserved-read");
    let response:Response;
    try{response=await this.#options.transport(`${this.#origin}/storage/v1/bucket/${bucket}`,{method:"GET",headers:{apikey:credentials.apikey,Authorization:`Bearer ${credentials.bearer}`},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});}catch{throw Error("preservation_bucket_unverified");}
    if(response.status!==200)throw Error("preservation_bucket_unverified");
    const meta=await response.json().catch(()=>null);
    if(meta?.id!==bucket||meta?.public!==false)throw Error("preservation_bucket_not_private");
  }
  async preserve(i:PreservationIdentity,ledger:PreservationLedger){
    identity(i);const source=await ledger.source(i);same(i,source);safePath(source.path);
    if(!uuid.test(source.sourceId)||!this.#options.sourceBuckets.includes(source.bucket)||!source.path.startsWith(`projects/${i.projectId}/`)||isPublicationStorageReference(source.path))throw Error("preservation_source_denied");
    await this.#privateBucket();
    let r=await ledger.find(i);
    if(r){same(i,r);reservation(r);if(r.mime!==source.mime)throw Error("preservation_source_changed");}
    else{const bytes=(await this.#download(source.bucket,source.path,source.mime))!;r=await ledger.reserve(source,await describe(bytes,source.mime));same(i,r);reservation(r);}
    const ticket=r;
    return ledger.exclusive(ticket,async()=>{
      let stored=await this.#download(bucket,ticket.path,ticket.mime,true);let copied=false;
      if(!stored){
        const original=(await this.#download(source.bucket,source.path,source.mime))!;await verify(original,ticket);
        let response:Response|undefined;
        try{response=await this.#request(bucket,ticket.path,"POST",ticket.mime,original);}catch{/* Reconcile a lost upload response against the durable path. */}
        if(response){const status=response.status;await response.body?.cancel();if(![200,201,400,409].includes(status))throw Error("preservation_upload_failed");}
        stored=await this.#download(bucket,ticket.path,ticket.mime,true);
        if(!stored)throw Error("preservation_upload_unconfirmed");
        copied=true;
      }
      await verify(stored,ticket);
      if(copied)await verify((await this.#download(source.bucket,source.path,source.mime))!,ticket);
      await ledger.verified(ticket);
      return ticket;
    });
  }
  async read(file:RevisionFile,ledger:PreservationLedger){
    if(!uuid.test(file.revisionId))throw Error("preservation_identity");
    const ticket=await ledger.access(file);if(!ticket)throw Error("revision_file_denied");
    reservation(ticket);if(ticket.projectId!==file.projectId||ticket.articleId!==file.articleId||ticket.fileId!==file.fileId)throw Error("preservation_ownership");
    await this.#privateBucket();const bytes=(await this.#download(bucket,ticket.path,ticket.mime))!;await verify(bytes,ticket);
    // Recheck after network IO so a committed withdrawal cannot be bypassed by a slow download.
    const current=await ledger.access(file);if(!current||current.path!==ticket.path||current.sha256!==ticket.sha256)throw Error("revision_file_denied");
    return bytes;
  }
  async gc(fileId:string,ledger:PreservationLedger){
    if(!uuid.test(fileId))throw Error("preservation_identity");await this.#privateBucket();
    // The ledger callback must keep an exclusive deleting/fenced claim, reject
    // pinned/history members, and mark deleted only after this callback succeeds.
    return ledger.gc(fileId,async ticket=>{
      reservation(ticket);if(ticket.fileId!==fileId)throw Error("preservation_ownership");
      const response=await this.#request(bucket,ticket.path,"DELETE");const status=response.status;await response.body?.cancel();
      if(![200,204,404].includes(status))throw Error("preservation_delete_unconfirmed");
      if(await this.#download(bucket,ticket.path,ticket.mime,true))throw Error("preservation_delete_unconfirmed");
    });
  }
}
