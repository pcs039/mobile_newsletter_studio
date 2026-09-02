const requiredPublicEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

export type SupabaseConfigStatus = {
  isConfigured: boolean;
  missing: string[];
  url: string | null;
  anonKey: string | null;
  hasServiceRoleKey: boolean;
};

function getEnvValue(name: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = getEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const missing = requiredPublicEnv.filter((name) => !getEnvValue(name));

  return {
    isConfigured: missing.length === 0,
    missing,
    url,
    anonKey,
    hasServiceRoleKey: Boolean(getEnvValue("SUPABASE_SERVICE_ROLE_KEY")),
  };
}

export function getSupabaseRestEndpoint(path: string) {
  const config = getSupabaseConfigStatus();

  if (!config.url) {
    return null;
  }

  const baseUrl = config.url.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}
