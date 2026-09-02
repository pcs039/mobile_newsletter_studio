import { getSupabaseConfigStatus, getSupabaseRestEndpoint } from "@/lib/supabase-config";

export type SupabaseHealthResult = {
  ok: boolean;
  status: "configured" | "not_configured" | "schema_missing" | "request_failed";
  message: string;
  checkedAt: string;
  missing: string[];
  httpStatus?: number;
};

export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  const config = getSupabaseConfigStatus();
  const checkedAt = new Date().toISOString();

  if (!config.isConfigured || !config.anonKey) {
    return {
      ok: false,
      status: "not_configured",
      message: "Supabase URL and anon key are not configured yet.",
      checkedAt,
      missing: config.missing,
    };
  }

  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_projects?select=id&limit=1");

  if (!endpoint) {
    return {
      ok: false,
      status: "not_configured",
      message: "Supabase URL is empty.",
      checkedAt,
      missing: ["NEXT_PUBLIC_SUPABASE_URL"],
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return {
        ok: true,
        status: "configured",
        message: "Supabase REST API and newsletter_projects table are reachable.",
        checkedAt,
        missing: [],
        httpStatus: response.status,
      };
    }

    return {
      ok: false,
      status: response.status === 404 ? "schema_missing" : "request_failed",
      message:
        response.status === 404
          ? "Supabase is reachable, but the newsletter_projects table is not available."
          : "Supabase returned an error while checking the connection.",
      checkedAt,
      missing: [],
      httpStatus: response.status,
    };
  } catch {
    return {
      ok: false,
      status: "request_failed",
      message: "Supabase request failed. Check project URL, keys, and network settings.",
      checkedAt,
      missing: [],
    };
  }
}
