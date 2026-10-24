import "server-only";
import { directUploadEnabled, DirectUploadError, publicUploadStatus, directUploadMaxBytes, directUploadTypes, directUploadMimes, directUploadUuid, type UploadActor, type UploadInput, type UploadSession } from "@/lib/design-asset-direct-upload-contract";
import { uploadTransport } from "@/lib/design-asset-direct-upload-storage";
import { verifyDirectUploadImage } from "@/lib/design-asset-direct-upload-verifier";

export function directUploadService(actor: UploadActor, projectId: string, signal: AbortSignal) {
  if (!directUploadEnabled()) throw new DirectUploadError(404,"disabled","rejected");
  const io=uploadTransport(signal);
  const context={p_project:projectId,p_actor:{id:actor.id,name:actor.name,role:actor.role}};
  async function status(sessionId?:string,requestKey?:string) {
    const s=await io.rpc<UploadSession|null>("get_design_asset_upload_status",{...context,p_id:sessionId??null,p_key:requestKey??null});
    if(!s)throw new DirectUploadError(404,"session_unconfirmed","pending");
    if(!directUploadUuid.test(s.id)||s.project_id!==projectId||s.actor_id!==actor.id||(sessionId&&s.id!==sessionId)||
       !Number.isSafeInteger(s.byte_size)||s.byte_size<1||s.byte_size>directUploadMaxBytes||!Number.isSafeInteger(s.generation)||s.generation<0||s.generation>3||
       !directUploadTypes.includes(s.asset_type as typeof directUploadTypes[number])||!directUploadMimes.includes(s.mime as typeof directUploadMimes[number])||
       !/^[a-f0-9]{64}$/.test(s.byte_hash)||s.policy_version!=="b2-raster-v1"||!Number.isFinite(Date.parse(s.intent_expires))||
       !directUploadUuid.test(s.request_key)||typeof s.asset_exists!=="boolean"||!["prepared","verifying","stored","registered","expired","cancelled","rejected"].includes(s.phase)||
       (s.phase==="registered")!==(s.receipt!==null)||
       (s.receipt!==null&&(s.receipt.assetId!==s.id||s.receipt.state!=="registered")))throw new DirectUploadError(502,"session_unconfirmed");
    return s;
  }
  async function prepare(input:UploadInput) {
    if(input.projectId.toLowerCase()!==projectId.toLowerCase())throw new DirectUploadError(403,"upload_forbidden","rejected");
    await io.checkBuckets();
    const id=await io.rpc<string>("prepare_design_asset_upload",{...context,p_key:input.requestKey,p_name:input.fileName,p_type:input.assetType,p_mime:input.mime,p_size:input.size,p_hash:input.sha256});
    const s=await status(id);
    if(s.phase!=="prepared" || Date.parse(s.intent_expires)<=Date.now())return publicUploadStatus(s);
    await io.rpc("reserve_design_asset_upload_capability",{p_id:id,p_actor:context.p_actor});
    const uploadUrl=await io.mint(s);
    return {...publicUploadStatus(s),uploadUrl,method:"PUT",mimeType:s.mime,upsert:false};
  }
  async function finalize(id:string) {
    let s=await status(id);
    if(s.receipt)return publicUploadStatus(s);
    if(["expired","cancelled","rejected"].includes(s.phase))throw new DirectUploadError(409,"session_unavailable","rejected");
    await io.checkBuckets();
    if(s.phase!=="stored" || !s.lease_until || Date.parse(s.lease_until)<=Date.now()) {
      const generation=await io.rpc<number>("claim_design_asset_upload",{p_id:id,p_actor:context.p_actor});
      s=await status(id);
      if(s.generation!==Number(generation)||s.phase!=="verifying")throw new DirectUploadError(409,"upload_conflict","pending");
      try {
        const bytes=await io.read(s,false);
        const dimensions=await verifyDirectUploadImage(bytes,s.mime,signal);
        await io.preserve(s,bytes);
        await io.rpc("mark_design_asset_upload_stored",{p_id:id,p_actor:context.p_actor,p_generation:s.generation,p_proof:{hash:s.byte_hash,mime:s.mime,size:s.byte_size,...dimensions,policy:s.policy_version,decoded:true}});
      }catch(e){
        if(e instanceof DirectUploadError && e.outcome==="rejected" && [400,413].includes(e.status)) {
          try { await io.rpc("reject_design_asset_upload",{p_id:id,p_actor:context.p_actor,p_generation:s.generation}); }
          catch { throw new DirectUploadError(502,"validation_result_unknown"); }
        }
        throw e;
      }
    }
    // A resumed stored result must still have the exact preserved bytes.
    await io.read(s,true);
    await io.rpc("finalize_design_asset_upload",{p_id:id,p_actor:context.p_actor,p_generation:s.generation});
    return publicUploadStatus(await status(id));
  }
  return {prepare,finalize,status:async(id?:string,key?:string)=>publicUploadStatus(await status(id,key))};
}
