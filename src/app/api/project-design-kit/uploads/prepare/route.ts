import { handleDirectUpload } from "@/lib/design-asset-direct-upload-route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request:Request){return handleDirectUpload(request,"prepare");}
