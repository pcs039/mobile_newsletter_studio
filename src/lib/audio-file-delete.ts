import "server-only";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

type AudioRow = { id: string; project_id: string; article_id: string | null; file_path: string; ai_tts_audio_paths: string[]; updated_at: string };
export type AudioDeleteResult = ({ok:true;outcome:"deleted"} | {ok:false;outcome:"rejected"|"unknown"|"cleanup_required"}) & {
  message: string;
  httpStatus?: number;
};
const safePath = (path: string) => !!path && !path.startsWith("/") && !path.includes("..");

// GET errors are never evidence that a reference or an object is absent.
async function rows<T>(query: string, headers: Record<string, string>): Promise<T[]> {
  const url = getSupabaseRestEndpoint(`/rest/v1/${query}`);
  if (!url) throw Error("Database unavailable");
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error("Reference lookup unconfirmed");
  const result: unknown = await response.json();
  if (!Array.isArray(result)) throw Error("Reference lookup unconfirmed");
  return result as T[];
}

async function pathReferenced(path: string, headers: Record<string, string>) {
  // Check all projects, including JSON segment manifests. Do not concatenate a path into PostgREST OR syntax.
  const file = await rows(`newsletter_audio_files?select=id&file_path=eq.${encodeURIComponent(path)}&limit=1`, headers);
  const segment = await rows(`newsletter_audio_files?select=id&ai_tts_audio_paths=cs.${encodeURIComponent(JSON.stringify([path]))}&limit=1`, headers);
  return file.length > 0 || segment.length > 0;
}

// Used by ordinary TTS rollback/old-segment cleanup too. Failure means retain bytes for review.
export async function cleanupUnreferencedAudioPaths(paths: string[], headers: Record<string, string>) {
  let retained = false;
  for (const file of [...new Set(paths)]) {
    if (!safePath(file)) throw Error("Unsafe audio path");
    if (await pathReferenced(file, headers)) { retained = true; continue; }
    const storage = getSupabaseStorageEndpoint("/object/audio-files");
    if (!storage) throw Error("Storage unavailable");
    const removal = await fetch(storage, { method: "DELETE", headers, body: JSON.stringify({ prefixes: [file] }), cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!removal.ok) {
      const error = await removal.json().catch(() => null);
      if (!([400,404].includes(removal.status) && String(error?.statusCode) === "404" && error?.message === "Object not found")) throw Error("Storage deletion unconfirmed");
    }
  }
  return {retained};
}

export async function deleteAudioFileRecord(projectId: string, recordId: string, path: string, headers: Record<string, string>): Promise<AudioDeleteResult> {
  let deleted = false;
  try {
    if (![projectId, recordId].every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return { ok: false, outcome: "rejected", httpStatus: 400, message: "프로젝트와 음성 ID를 확인해 주세요." };
    }
    const filter = `id=eq.${encodeURIComponent(recordId)}&project_id=eq.${encodeURIComponent(projectId)}&file_path=eq.${encodeURIComponent(path)}`;
    const found = await rows<AudioRow>(`newsletter_audio_files?select=id,project_id,article_id,file_path,ai_tts_audio_paths,updated_at&${filter}&limit=1`, headers);
    const row = found[0];
    if (found.length !== 1 || row.id !== recordId || row.project_id !== projectId || row.file_path !== path) {
      return { ok: false, outcome: "rejected", httpStatus: 404, message: "음성 기록과 경로가 일치하지 않습니다. 파일은 삭제하지 않았습니다." };
    }
    const referenced = await rows(`newsletter_articles?select=id&or=(audio_id.eq.${encodeURIComponent(recordId)},ai_audio_id.eq.${encodeURIComponent(recordId)})&limit=1`, headers);
    if (row.article_id !== null || referenced.length) {
      return { ok: false, outcome: "rejected", httpStatus: 409, message: "기사에서 사용 중인 음성입니다. 기사에서 음성을 교체하거나 연결을 해제한 뒤 삭제해 주세요." };
    }
    if (!row.updated_at || !Array.isArray(row.ai_tts_audio_paths) || row.ai_tts_audio_paths.some(p => typeof p !== "string" || !safePath(p)) || !safePath(path)) {
      return { ok: false, outcome: "rejected", httpStatus: 409, message: "음성 파일 정보 확인이 필요합니다. 파일은 삭제하지 않았습니다." };
    }
    const paths = [...new Set([path, ...row.ai_tts_audio_paths])];
    const url = getSupabaseRestEndpoint(`/rest/v1/newsletter_audio_files?${filter}&article_id=is.null&updated_at=eq.${encodeURIComponent(row.updated_at)}`);
    if (!url) throw Error("Database unavailable");
    const response = await fetch(url, {
      method: "DELETE", headers: { ...headers, Prefer: "return=representation" }, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      // Only an explicit FK rejection proves that deletion did not commit. Proxy/5xx errors may follow commit.
      const error = await response.json().catch(() => null);
      if (response.status === 409 && error?.code === "23503") return { ok: false, outcome: "rejected", httpStatus: 409, message: "다른 DB 기록에서 참조하는 음성입니다. 파일은 삭제하지 않았습니다." };
      throw Error("Database deletion unconfirmed");
    }
    const receipt: unknown = await response.json();
    if (!Array.isArray(receipt) || receipt.length !== 1 || receipt[0]?.id !== recordId || receipt[0]?.project_id !== projectId || receipt[0]?.file_path !== path) {
      throw Error("Database deletion unconfirmed");
    }
    deleted = true;
    const {retained} = await cleanupUnreferencedAudioPaths(paths, headers);
    return { ok: true, outcome: "deleted", message: retained ? "음성 기록을 삭제했습니다. 다른 음성에서 참조하는 파일은 유지했습니다." : "음성 기록과 파일을 삭제했습니다." };
  } catch {
    return deleted
      ? { ok: false, outcome: "cleanup_required", httpStatus: 409, message: "음성 DB 기록은 삭제됐지만 파일 정리는 확인이 필요합니다. 다시 삭제하지 말고 관리자에게 잔여 파일 확인을 요청해 주세요." }
      : { ok: false, outcome: "unknown", httpStatus: 409, message: "음성 삭제 결과를 확인할 수 없습니다. 파일 삭제는 실행하지 않았습니다. 목록과 DB 상태를 확인한 뒤 처리해 주세요." };
  }
}
