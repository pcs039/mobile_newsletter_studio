import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
function signature(payload: string) {
  const secret=process.env.NEWSLETTER_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret) throw new CanvaConnectError(503,"서버 설정을 확인해 주세요.");
  return createHmac("sha256",secret).update(`canva-autofill:${payload}`).digest("base64url");
}
export function createCanvaConfirmation(binding: string) {
  const payload=Buffer.from(JSON.stringify({binding,exp:Date.now()+300000})).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function verifyCanvaConfirmation(value: unknown,binding: string) {
  if(typeof value!=="string" || value.length>2000) return false;
  const [payload,sig,...rest]=value.split(".");
  if(!payload || !sig || rest.length) return false;
  const expected=Buffer.from(signature(payload));const actual=Buffer.from(sig);
  if(expected.length!==actual.length || !timingSafeEqual(expected,actual)) return false;
  try {const data=JSON.parse(Buffer.from(payload,"base64url").toString());return data.binding===binding && typeof data.exp==="number" && data.exp>Date.now();} catch {return false;}
}
