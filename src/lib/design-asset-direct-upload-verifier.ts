import "server-only";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { DirectUploadError, directUploadMaxBytes } from "@/lib/design-asset-direct-upload-contract";

// Literal server code, never shell text supplied by a caller. No credentials in env.
const worker = `const sharp=require(process.argv[1]);sharp.concurrency(1);sharp.cache(false);
let chunks=[],size=0;process.stdin.on('data',b=>{size+=b.length;if(size>10485760)process.exit(2);chunks.push(b)});
process.stdin.on('end',async()=>{try{const b=Buffer.concat(chunks),mime=process.argv[2];
let format=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':b[0]===255&&b[1]===216&&b[2]===255?'jpeg':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'webp':null;
if(!format||mime!==({png:'image/png',jpeg:'image/jpeg',webp:'image/webp'})[format])throw Error();
if(format==='png'){for(let at=8;at+12<=b.length;){const n=b.readUInt32BE(at);if(at+n+12>b.length)throw Error();if(b.toString('ascii',at+4,at+8)==='acTL')throw Error();at+=n+12}}
if(format==='webp'&&b.toString('ascii',12,16)==='VP8X'&&(b[20]&2))throw Error();
const o={failOn:'warning',limitInputPixels:16000000,sequentialRead:true};const m=await sharp(b,o).metadata();
if(m.format!==format||!m.width||!m.height||m.width>8192||m.height>8192||(m.pages||1)!==1||m.depth!=='uchar'||(m.channels||5)>4)throw Error();
await sharp(b,o).stats();process.stdout.write(JSON.stringify({width:m.width,height:m.height}));
}catch{process.exit(2)}});`;
let busy = false;
export async function verifyDirectUploadImage(bytes: Uint8Array, mime: string, signal: AbortSignal): Promise<{width: number; height: number}> {
  if (!sharp.versions.sharp || signal.aborted) throw new DirectUploadError(503, "verifier_unavailable");
  if (busy) throw new DirectUploadError(409, "verifier_busy", "pending");
  if (!bytes.length || bytes.length > directUploadMaxBytes) throw new DirectUploadError(413, "invalid_uploaded_file", "rejected");
  busy = true;
  try {
    const sharpPath = createRequire(import.meta.url).resolve("sharp");
    return await new Promise((resolve,reject) => {
      const child = spawn(process.execPath,["-e",worker,sharpPath,mime], { stdio: ["pipe","pipe","ignore"], env: { NODE_ENV: "production" }, windowsHide: true });
      let output = "", interrupted = false;
      const stop = () => { interrupted = true; child.kill("SIGKILL"); };
      const timer = setTimeout(stop,8000); signal.addEventListener("abort",stop,{once:true});
      if(signal.aborted)stop();
      child.stdout.on("data",chunk=>{ output+=chunk.toString(); if(output.length>1024)stop(); });
      child.stdin.on("error",()=>undefined); child.stdin.end(bytes);
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort",stop); };
      child.on("error",()=>{ cleanup(); reject(new DirectUploadError(503,"verifier_unavailable")); });
      child.on("close",(code,terminationSignal)=>{
        cleanup();
        if (interrupted) return reject(new DirectUploadError(504,"verifier_timeout"));
        if (terminationSignal || (code !== 0 && code !== 2)) return reject(new DirectUploadError(503,"verifier_unavailable"));
        if (code === 2) return reject(new DirectUploadError(400,"invalid_uploaded_file","rejected"));
        try { const data=JSON.parse(output); if(!Number.isInteger(data.width)||!Number.isInteger(data.height)||data.width<1||data.height<1||data.width>8192||data.height>8192||data.width*data.height>16000000)throw Error(); resolve(data); }
        catch { reject(new DirectUploadError(503,"verifier_unavailable")); }
      });
    });
  } finally { busy = false; }
}
