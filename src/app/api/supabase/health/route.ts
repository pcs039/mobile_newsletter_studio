import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedJsonResponse } from "@/lib/app-auth";
import { checkSupabaseHealth } from "@/lib/supabase-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireApiUser();

  if (!user) {
    return unauthorizedJsonResponse();
  }

  const result = await checkSupabaseHealth();

  return NextResponse.json(result);
}
