import { NextResponse } from "next/server";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export const dynamic = "force-dynamic";

type PublicEbookOriginalPdfRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

type PublicEbookProjectPdfRow = {
  id: string;
  pdf_original_file_name: string | null;
  pdf_original_path: string | null;
  status: string;
};

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function getServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function isSafeStoragePath(path: string) {
  return path.length > 0 && !path.includes("..") && !path.startsWith("/") && !path.endsWith("/");
}

function makeSafeFileName(value: string | null | undefined, slug: string) {
  const fallback = `${slug}-original.pdf`;
  const normalized = value?.trim() || fallback;
  const fileName = normalized.toLowerCase().endsWith(".pdf") ? normalized : `${normalized}.pdf`;

  return fileName.replace(/[\\/:*?"<>|]/g, "-");
}

async function findPublishedProject(slug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,status,pdf_original_path,pdf_original_file_name&slug=eq.${encodeURIComponent(
      slug,
    )}&deleted_at=is.null&limit=1`,
  );

  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json().catch(() => [])) as PublicEbookProjectPdfRow[];
  const project = rows[0] ?? null;

  return project?.status === "published" ? project : null;
}

export async function GET(_request: Request, { params }: PublicEbookOriginalPdfRouteProps) {
  const { slug } = await params;
  const headers = getServiceHeaders();

  if (!headers) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 설정 후 PDF 원본을 다운로드할 수 있습니다." },
      { status: 503 },
    );
  }

  const project = await findPublishedProject(slug, headers);
  const pdfPath = project?.pdf_original_path?.trim() ?? "";

  if (!project || !isSafeStoragePath(pdfPath)) {
    return NextResponse.json({ ok: false, message: "공개된 PDF 원본을 찾지 못했습니다." }, { status: 404 });
  }

  const storageEndpoint = getSupabaseStorageEndpoint(`/object/pdf-originals/${encodeStoragePath(pdfPath)}`);

  if (!storageEndpoint) {
    return NextResponse.json({ ok: false, message: "Supabase Storage URL 설정을 확인하세요." }, { status: 503 });
  }

  const response = await fetch(storageEndpoint, {
    headers,
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { ok: false, message: "PDF 원본을 불러오지 못했습니다." },
      { status: response.status || 500 },
    );
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(makeSafeFileName(project.pdf_original_file_name, slug))}"`,
      "Content-Type": response.headers.get("Content-Type") ?? "application/pdf",
    },
  });
}
