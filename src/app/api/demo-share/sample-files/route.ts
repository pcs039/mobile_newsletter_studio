import { getHwaseongDemoAccess, getHwaseongDemoData } from "@/lib/hwaseong-demo-render";
import { demoHeaders } from "@/lib/demo-share";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if ([...q.keys()].some(k => !["project","bucket","path","variant"].includes(k)) || ["project","bucket","path"].some(k => q.getAll(k).length !== 1) || q.getAll("variant").length > 1) return new Response(null,{status:404,headers:demoHeaders});
  const variant = q.get("variant");
  if (variant !== null && !["thumbnail","map"].includes(variant)) return new Response(null,{status:404,headers:demoHeaders});
  try {
    if (variant !== null) {
      // Authenticate and revalidate the current seven-article snapshot BEFORE
      // consulting the existing derived-byte cache. No public or signed URL.
      const access = await getHwaseongDemoAccess(q.get("project")!);
      const bucket=q.get("bucket")!,path=q.get("path")!;
      const sample = access.samples.find(s => {
        try {
          const u = new URL(s.cover,"https://demo.invalid");
          return u.pathname === "/api/project-files/preview" && u.searchParams.get("bucket") === bucket && u.searchParams.get("path") === path;
        } catch { return false; }
      });
      if (bucket !== "design-production-assets" || !sample || (variant === "map" && sample.kind !== "tourism")) return new Response(null,{status:404,headers:demoHeaders});
      const { prepareSampleMap, prepareSampleToc } = await import("@/lib/hwaseong-sample-toc-server");
      const image = variant === "map" ? await prepareSampleMap(access.project.id,access.project.slug,[sample]) : (await prepareSampleToc(access.project.id,access.project.slug,[sample]))[sample.article.id];
      if (!image?.startsWith("data:image/webp;base64,")) return new Response(null,{status:503,headers:demoHeaders});
      return new Response(Buffer.from(image.slice("data:image/webp;base64,".length),"base64"),{headers:{...demoHeaders,"Content-Type":"image/webp","Content-Disposition":"inline"}});
    }
    const { access, files, fontPaths } = await getHwaseongDemoData(q.get("project")!,false);
    const bucket=q.get("bucket")!,path=q.get("path")!;
    if (!files.has(`${bucket}:${path}`)) return new Response(null,{status:404,headers:demoHeaders});
    const key=process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const headers={apikey:key,Authorization:`Bearer ${key}`};
    if (bucket !== "fonts") {
      const table=bucket === "design-production-assets" ? "newsletter_project_design_assets" : bucket === "mobile-assets" ? "newsletter_assets" : "newsletter_pages";
      const column=bucket === "design-production-assets" ? "storage_path" : bucket === "mobile-assets" ? "file_path" : "image_path";
      const filter=new URLSearchParams({select:"id",project_id:`eq.${access.project.id}`,[column]:`eq.${path}`,limit:"1"});
      if(bucket === "design-production-assets"){filter.set("storage_bucket",`eq.${bucket}`);filter.set("is_active","eq.true");}
      const endpoint=getSupabaseRestEndpoint(`/rest/v1/${table}?${filter}`);
      if(!endpoint)return new Response(null,{status:503,headers:demoHeaders});
      const row=await fetch(endpoint,{headers,cache:"no-store"});
      if(!row.ok||!(await row.json()).length)return new Response(null,{status:404,headers:demoHeaders});
    } else if(!fontPaths.has(path)) return new Response(null,{status:404,headers:demoHeaders});
    const endpoint=getSupabaseStorageEndpoint(`/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
    if(!endpoint)return new Response(null,{status:503,headers:demoHeaders});
    const response=await fetch(endpoint,{headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.body)return new Response(null,{status:404,headers:demoHeaders});
    const type=response.headers.get("content-type")?.split(";")[0]??"";
    const fontType:Record<string,string>={woff2:"font/woff2",woff:"font/woff",ttf:"font/ttf",otf:"font/otf"};
    const contentType=bucket === "fonts" ? fontType[path.split(".").pop()!.toLowerCase()] : type;
    if(!contentType || (bucket !== "fonts" && !/^image\/(png|jpeg|webp|gif|avif|svg\+xml)$/.test(contentType)))return new Response(null,{status:415,headers:demoHeaders});
    return new Response(response.body,{headers:{...demoHeaders,"Content-Type":contentType,"Content-Disposition":"inline",...(contentType === "image/svg+xml" ? {"Content-Security-Policy":"sandbox; default-src 'none'; style-src 'unsafe-inline'"} : {})}});
  } catch { return new Response(null,{status:410,headers:demoHeaders}); }
}
