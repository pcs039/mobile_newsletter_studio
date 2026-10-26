import "server-only";
import { getSupabaseRestEndpoint } from "@/lib/supabase-config";
import { deleteStorageObject } from "@/lib/newsletter-file-storage";

async function exists(
  query: string,
  headers: Record<string, string>,
  signal: AbortSignal,
) {
  const url = getSupabaseRestEndpoint(`/rest/v1/${query}`);
  if (!url) throw Error("cleanup_unconfirmed");
  const response = await fetch(url, { headers, cache: "no-store", signal });
  if (!response.ok) throw Error("cleanup_unconfirmed");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw Error("cleanup_unconfirmed");
  return rows.length > 0;
}
// Only candidates returned by a successful DB-first retirement in article_tts_complete.
// Missing tables/columns, denied reads or unknown reference domains retain the file.
export async function cleanupReplacedArticleTts(
  projectId: string,
  articleId: string,
  paths: string[],
  headers: Record<string, string>,
) {
  let removed = 0,
    retained = 0;
  const signal = AbortSignal.timeout(12000);
  const referenced = (query: string) => exists(query, headers, signal);
  for (const path of [...new Set(paths)].slice(0, 65)) {
    if (
      signal.aborted ||
      !new RegExp(
        `^ai-tts(?:-v2)?/${projectId}/${articleId}/[a-f0-9/-]+\\.mp3$`,
      ).test(path)
    ) {
      retained++;
      continue;
    }
    try {
      if (
        (await referenced(
          `newsletter_audio_files?select=id&file_path=eq.${encodeURIComponent(path)}&limit=1`,
        )) ||
        (await referenced(
          `newsletter_audio_files?select=id&ai_tts_audio_paths=cs.${encodeURIComponent(JSON.stringify([path]))}&limit=1`,
        )) ||
        (await referenced(
          `newsletter_pages?select=id&tts_audio_paths=cs.${encodeURIComponent(JSON.stringify([path]))}&limit=1`,
        ))
      ) {
        retained++;
        continue;
      }
      let used = false;
      for (const target of [path, encodeURIComponent(path)]) {
        for (const [table, column] of [
          ["newsletter_content_blocks", "body"],
          ["newsletter_articles", "body"],
          ["newsletter_link_actions", "target_value"],
          ["newsletter_link_areas", "target_value"],
        ]) {
          if (
            await referenced(
              `${table}?select=id&${column}=like.${encodeURIComponent("*" + target + "*")}&limit=1`,
            )
          ) {
            used = true;
            break;
          }
        }
        if (used) break;
      }
      if (used) {
        retained++;
        continue;
      }
      // Re-read metadata immediately before deletion, across ALL projects.
      if (
        (await referenced(
          `newsletter_audio_files?select=id&file_path=eq.${encodeURIComponent(path)}&limit=1`,
        )) ||
        (await referenced(
          `newsletter_audio_files?select=id&ai_tts_audio_paths=cs.${encodeURIComponent(JSON.stringify([path]))}&limit=1`,
        ))
      ) {
        retained++;
        continue;
      }
      const result = await deleteStorageObject(
        "audio-files",
        path,
        headers,
        signal,
      );
      if (result.ok) removed++;
      else retained++;
    } catch {
      retained++;
    }
  }
  return { removed, retained };
}
