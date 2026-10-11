import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { inflateSync } from "node:zlib";
import { buildVisualAssetSpecifications } from "@/lib/article-visual-asset-spec";
import { conceptDirections, type ArticleDesignConcept } from "@/lib/article-design-concept";
import { validateCanvaPng } from "@/lib/canva-png-export";

export const generatedImageMaxBytes = 2_500_000;
export class ImageGenerationError extends Error { constructor(public status: number, message: string) { super(message); } }
export function imageGenerationEnabled() {
  try { return process.env.VERCEL_ENV !== "production" && new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname === "mvrkpmffuhcqwisqvpqi.supabase.co"; } catch { return false; }
}
export type GeneratableRole = "hero_background" | "hero_illustration";
export function buildImageGenerationRequest(concept: ArticleDesignConcept, role: GeneratableRole, palette: string[]) {
  const specification = buildVisualAssetSpecifications(concept, palette).find(s => s.assetRole === role);
  if (!specification) throw new ImageGenerationError(400, "선택한 콘셉트에 해당 이미지 계획이 없습니다.");
  const size = role === "hero_background" ? "1152x1536" : "1152x768";
  const family = {
    palette: specification.brandConstraints.articleColors,
    tone: concept.visualTone, colorDirection: concept.colorDirection,
    line: "consistent clean rounded vector-like edges", texture: "flat matte, minimal texture",
    dimensionality: "flat 2D, no painterly depth", shadow: "none",
  };
  // Only deterministic semantic descriptions, never arbitrary concept names/reasons or article text.
  const prompt = [
    "Generate one independent reusable visual asset for a Korean public newsletter. NOT a complete article/page.",
    `Style family (identical for this concept's background and illustration): ${JSON.stringify(family)}`,
    `Purpose: ${specification.purpose}. Visual style: ${specification.visualStyle}.`,
    `Color direction: ${conceptDirections.colorDirection[specification.colorDirection]}. Approved palette first; no invented logo or brand identity.`,
    `Composition: ${specification.compositionDirection}`,
    `Specification: ${JSON.stringify(specification)}`,
    `Output dimensions: ${size}; planned target ${specification.targetSize.width}x${specification.targetSize.height}; preserve ${specification.aspectRatio} ratio.`,
    specification.transparentBackground ? "Isolated illustration on truly transparent alpha PNG. No backdrop, scenery, checkerboard or shadows." : "Opaque pale background; only subtle motifs around edges. Central text safe area must remain empty and visually quiet.",
    "Absolutely NO letters, words, numbers, captions, typography, logos or watermarks anywhere. textInImage=false. All meaningful text remains separate HTML.",
    "Avoid advertising, photorealism, painting, ornate decoration and heavy shadows. Prioritize mobile 390px and enlarged HTML text readability.",
  ].join("\n");
  return { specification, family, payload: { model: "gpt-image-2.5-flare", prompt, n: 1, size, quality: "medium", output_format: "png", background: specification.transparentBackground ? "transparent" : "opaque" } };
}

export function validateGeneratedImage(base64: unknown, role: GeneratableRole) {
  if (typeof base64 !== "string" || base64.length > Math.ceil(generatedImageMaxBytes / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new ImageGenerationError(413, "PNG 결과가 허용 크기를 초과했거나 올바르지 않습니다.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64 || bytes.length > generatedImageMaxBytes) throw new ImageGenerationError(413, "PNG 결과를 확인하지 못했습니다.");
  let info;
  try { info = validateCanvaPng(bytes, "image/png"); } catch { throw new ImageGenerationError(502, "이미지 결과가 유효한 PNG가 아닙니다."); }
  const expected = role === "hero_background" ? [1152,1536] : [1152,768];
  if (info.width !== expected[0] || info.height !== expected[1]) throw new ImageGenerationError(502, "이미지 해상도가 계획과 다릅니다.");
  if (role === "hero_illustration" && !hasTransparentPixels(bytes, info.width, info.height)) throw new ImageGenerationError(502, "투명 배경이 확인되지 않았습니다. 결과를 등록하지 않고 다시 생성할 수 있습니다.");
  return { bytes, ...info };
}
// Check alpha without editing the image. GPT PNG is expected to use 8-bit RGBA.
function hasTransparentPixels(bytes: Buffer, width: number, height: number) {
  if (bytes[24] !== 8 || bytes[25] !== 6 || bytes[28] !== 0) return false;
  const chunks: Buffer[] = [];
  for (let at = 8; at + 12 <= bytes.length;) { const length=bytes.readUInt32BE(at); if (bytes.toString("ascii",at+4,at+8)==="IDAT") chunks.push(bytes.subarray(at+8,at+8+length)); at+=12+length; }
  let raw: Buffer;
  try { raw=inflateSync(Buffer.concat(chunks),{maxOutputLength:(width*4+1)*height}); } catch { return false; }
  if(raw.length!==(width*4+1)*height)return false;
  let previous=Buffer.alloc(width*4);
  for(let y=0;y<height;y++){
    const at=y*(width*4+1),filter=raw[at]; if(filter>4)return false;
    const row=Buffer.alloc(width*4);
    for(let x=0;x<row.length;x++){
      const a=x>=4?row[x-4]:0,b=previous[x],c=x>=4?previous[x-4]:0;
      const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
      row[x]=(raw[at+1+x]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c))&255;
    }
    if(row.some((v,i)=>i%4===3&&v<255))return true;
    previous=row;
  }
  return false;
}
export type GeneratedImageProof = { assetId:string; projectId:string; articleId:string; adminId:string; role:GeneratableRole; pattern:"event"|"policy"|"interview"; hash:string; expires:number; model:"gpt-image-2.5-flare" };
export function imageProofSecret() { const key=process.env.SUPABASE_SERVICE_ROLE_KEY; if(!key)throw new ImageGenerationError(503,"서버 저장 설정을 확인해 주세요."); return key; }
export function signImageProof(input: Omit<GeneratedImageProof,"assetId"|"expires"|"model">) {
  const proof:GeneratedImageProof={...input,assetId:randomUUID(),expires:Date.now()+15*60_000,model:"gpt-image-2.5-flare"};
  const body=Buffer.from(JSON.stringify(proof)).toString("base64url");
  return `${body}.${createHmac("sha256",imageProofSecret()).update(body).digest("base64url")}`;
}
export function readImageProof(value: unknown): GeneratedImageProof {
  if(typeof value!=="string"||value.length>2000)throw new ImageGenerationError(400,"생성 결과를 다시 확인해 주세요.");
  const [body,signature,...extra]=value.split(".");
  const expected=createHmac("sha256",imageProofSecret()).update(body||"").digest("base64url");
  if(extra.length||!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw new ImageGenerationError(403,"생성 결과 확인값이 올바르지 않습니다.");
  const proof=JSON.parse(Buffer.from(body,"base64url").toString()) as GeneratedImageProof;
  if(proof.expires<Date.now())throw new ImageGenerationError(410,"미리보기 유효시간이 지났습니다. 새로 생성해 주세요.");
  return proof;
}
export const imageHash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
