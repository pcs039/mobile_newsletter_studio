import 'server-only';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
// Reuse the engine shipped by our pinned Next version, without its public optimizer
// endpoint/cache or unauthenticated source fetch. Keep this dependency isolated.
import { optimizeImage } from 'next/dist/server/image-optimizer';
import { imageDeliveryWidths, type ImageDeliveryKind } from '@/lib/image-delivery';
const cache = new Map<string, {bytes: Buffer; type: string}>();
let cacheBytes = 0;
let activeTransforms = 0;
const pending = new Map<string, Promise<{bytes: Buffer; type: string}>>();
const maxBytes = 10 * 1024 * 1024, maxCacheBytes = 24 * 1024 * 1024;
export async function deliverAuthorizedPng(upstream: Response, request: Request | undefined, kind: ImageDeliveryKind, headers: Record<string,string>) {
  const params = request && new URL(request.url).searchParams;
  const rawWidth = params?.get('deliveryWidth'), format = params?.get('deliveryFormat');
  if (!rawWidth && !format) return new NextResponse(upstream.body, {headers:{...headers,'Content-Type':'image/png'}});
  if (!rawWidth || !imageDeliveryWidths.some(w => String(w) === rawWidth) || !['webp','avif'].includes(format ?? ''))
    return NextResponse.json({ok:false}, {status:400,headers});
  // Existing caller has already validated session, ownership, approval and provenance.
  // Nothing in this cache can be reached before those checks, even on a cache hit.
  const reader=upstream.body?.getReader();
  if(!reader) throw new Error('Missing image');
  const chunks:Uint8Array[]=[]; let length=0;
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;
    if(length>maxBytes){await reader.cancel();throw new Error('Image too large');}chunks.push(part.value);}
  const original=Buffer.concat(chunks);
  if(original.length<24 || original.subarray(0,8).toString('hex')!=='89504e470d0a1a0a' || original.toString('ascii',12,16)!=='IHDR') throw new Error('Invalid PNG');
  const intrinsicWidth=original.readUInt32BE(16), height=original.readUInt32BE(20);
  if(!intrinsicWidth || !height || intrinsicWidth*height>40_000_000)throw new Error('Invalid dimensions');
  const width=Math.min(Number(rawWidth),intrinsicWidth), quality=kind==='canva'?90:85;
  const type=`image/${format}`;
  const key=createHash('sha256').update(original).update(`${width}:${quality}:${type}`).digest('hex');
  let result=cache.get(key);
  if(!result){
    let work=pending.get(key);
    if(!work && activeTransforms<4){
      activeTransforms++;
      work=(async()=>{
        try {
          const bytes=await optimizeImage({buffer:original,contentType:type,quality,width,limitInputPixels:40_000_000,timeoutInSeconds:7});
          return bytes.length<original.length?{bytes,type}:{bytes:original,type:'image/png'};
        } catch { return {bytes:original,type:'image/png'}; }
        finally { activeTransforms--; }
      })();
      pending.set(key,work);
    }
    if(work){
      try { result=await work; } finally { pending.delete(key); }
      // Another waiter may already have populated this entry.
      if(!cache.has(key)){
        while(cache.size && (cache.size>=24 || cacheBytes+result.bytes.length>maxCacheBytes)){
          const oldest=cache.keys().next().value!;cacheBytes-=cache.get(oldest)!.bytes.length;cache.delete(oldest);
        }
        cache.set(key,result);cacheBytes+=result.bytes.length;
      }
    } else { result={bytes:original,type:'image/png'}; }
  }
  return new NextResponse(new Uint8Array(result.bytes), {headers:{...headers,'Content-Type':result.type,'Content-Length':String(result.bytes.length),'Vary':'Accept','X-Image-Delivery-Width':String(result.type==='image/png'?intrinsicWidth:width)}});
}
