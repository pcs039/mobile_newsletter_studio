import { NextResponse } from "next/server";
import { searchPublishedEbookPages } from "@/lib/ebook-page-search";

export const dynamic = "force-dynamic";

type PublicEbookSearchRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, { params }: PublicEbookSearchRouteProps) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const result = await searchPublishedEbookPages(slug, searchParams.get("q") ?? "");

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    query: result.query,
    count: result.count,
    hasIndexedPages: result.hasIndexedPages,
    hasSearchText: result.hasSearchText,
    results: result.results,
  });
}

