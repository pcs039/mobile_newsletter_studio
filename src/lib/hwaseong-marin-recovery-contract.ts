import { createHash } from "node:crypto";

export const marinParentId = "e2041281-42e2-5363-a329-43db98714355";
export const marinProjectId = "4cd5297e-a0fd-434c-84d4-fa4d3baf9389";
export const marinRequestHash = "e204128142e2c363432943db98714355fba056c9534e24df529f116522e2973d";
export const marinScriptHash = "d216ab7c167a569f6b78beec03d27ad6e9dc088a534334c6bb3d7c4d02ae4470";
export const marinAttemptKey = createHash("sha256").update(`hwaseong-marin-recovery-v1\n${marinParentId}\n${marinRequestHash}\nattempt:1`).digest("hex");
export const marinAudioId = `${marinAttemptKey.slice(0,8)}-${marinAttemptKey.slice(8,12)}-5${marinAttemptKey.slice(13,16)}-a${marinAttemptKey.slice(17,20)}-${marinAttemptKey.slice(20,32)}`;
export const marinPath = `projects/${marinProjectId}/sample-tts-recovery-v1/${marinAudioId}/000.mp3`;
export const marinOriginalPath = `projects/${marinProjectId}/sample-tts-v1/${marinParentId}/000.mp3`;
export const marinMaxBytes = 8 * 1024 * 1024;
export const bytesHash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export type MarinActor = { id: string; role: "admin" };
export type MarinReceipt = {
  parent_id: string; project_id: string; audio_id: string; request_key: string;
  phase: "reserved" | "unknown" | "output_verified" | "ready";
  path: string; byte_hash: string | null; byte_size: number | null; duration_seconds: number | null;
  provider_status: number | null; provider_request_id: string | null; last_error: string | null;
};
export type MarinParent = Record<string, unknown> & { script_text: string };

export function validateMarinParent(row: MarinParent) {
  if (row.id !== marinParentId || row.project_id !== marinProjectId || row.article_id !== null ||
      row.source_type !== "ai_tts" || row.transcript_type !== "custom_script" || row.script_status !== "pending" ||
      row.ai_tts_generated_at !== null || row.ai_tts_voice !== "marin" || row.ai_tts_model !== "gpt-4o-mini-tts" ||
      row.ai_tts_text_hash !== marinRequestHash || typeof row.script_text !== "string" || row.script_text.length !== 74 ||
      row.title !== "[시연 TTS v1] 음질 비교 marin" || row.pronunciation_note !== null || row.duration_seconds !== null ||
      row.created_at !== "2026-10-25T06:18:52.579765+00:00" || row.updated_at !== "2026-10-25T06:18:52.579765+00:00" ||
      bytesHash(Buffer.from(row.script_text)) !== marinScriptHash || row.file_path !== marinOriginalPath ||
      JSON.stringify(row.ai_tts_audio_paths) !== JSON.stringify([marinOriginalPath])) throw Error("parent_mismatch");
}

// Strict MPEG Layer III framing, not an acoustic-quality/complete decoder test.
// Storage integrity is additionally verified using SHA-256 over every byte.
export function inspectMarinMp3(data: Uint8Array) {
  if (data.length < 100 || data.length > marinMaxBytes) throw Error("invalid_mp3_size");
  let offset = 0, frames = 0, seconds = 0, sampleRate = 0, version = -1;
  if (Buffer.from(data.subarray(0,3)).toString() === "ID3") {
    if (data.length < 10 || ![3,4].includes(data[3]) || data[4] !== 0 || (data[5] & 0x1f)) throw Error("invalid_id3");
    if (data.subarray(6,10).some(n => n > 127)) throw Error("invalid_id3_size");
    offset = 10 + data[6]*2097152 + data[7]*16384 + data[8]*128 + data[9];
    if (offset >= data.length) throw Error("truncated_id3");
  }
  let end = data.length;
  if (end >= 128 && Buffer.from(data.subarray(end-128,end-125)).toString() === "TAG") end -= 128;
  while (offset < end) {
    if (offset + 4 > end) throw Error("truncated_mp3");
    const a=data[offset], b=data[offset+1], c=data[offset+2], d=data[offset+3];
    const v=(b>>3)&3, layer=(b>>1)&3, bi=c>>4, si=(c>>2)&3;
    if (a!==255 || (b&224)!==224 || v===1 || layer!==1 || bi===0 || bi===15 || si===3 || (d&3)===2) throw Error("invalid_mp3_frame");
    const rate=[44100,48000,32000][si]/(v===3?1:v===2?2:4);
    const bitrate=(v===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bi];
    const length=Math.floor((v===3?144000:72000)*bitrate/rate)+((c>>1)&1);
    if (length < 24 || offset+length > end || (frames && (version!==v || sampleRate!==rate))) throw Error("truncated_or_mixed_mp3");
    version=v; sampleRate=rate; seconds+=(v===3?1152:576)/rate; frames++; offset+=length;
  }
  if (frames < 2 || seconds < 0.04 || seconds > 120) throw Error("invalid_mp3_duration");
  return { hash: bytesHash(data), size: data.length, duration: Math.ceil(seconds) };
}

export function validMarinReceipt(r: MarinReceipt) {
  return r.parent_id===marinParentId && r.project_id===marinProjectId && r.audio_id===marinAudioId &&
    r.request_key===marinAttemptKey && r.path===marinPath;
}
