import { createHash } from "node:crypto";

export const ttsMaxBytes = 8 * 1024 * 1024;
export const ttsHash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
// MPEG Layer III framing and duration checks, not an acoustic quality assessment.
export function inspectArticleMp3(data: Uint8Array) {
  if (data.length < 100 || data.length > ttsMaxBytes)
    throw Error("invalid_mp3_size");
  let offset = 0,
    frames = 0,
    seconds = 0,
    sampleRate = 0,
    version = -1;
  if (Buffer.from(data.subarray(0, 3)).toString() === "ID3") {
    if (
      data.length < 10 ||
      ![3, 4].includes(data[3]) ||
      data[4] !== 0 ||
      data[5] & 0x1f ||
      data.subarray(6, 10).some((n) => n > 127)
    )
      throw Error("invalid_id3");
    offset = 10 + data[6] * 2097152 + data[7] * 16384 + data[8] * 128 + data[9];
    if (offset >= data.length) throw Error("truncated_id3");
  }
  let end = data.length;
  if (
    end >= 128 &&
    Buffer.from(data.subarray(end - 128, end - 125)).toString() === "TAG"
  )
    end -= 128;
  while (offset < end) {
    if (offset + 4 > end) throw Error("truncated_mp3");
    const a = data[offset],
      b = data[offset + 1],
      c = data[offset + 2],
      d = data[offset + 3],
      v = (b >> 3) & 3,
      bi = c >> 4,
      si = (c >> 2) & 3;
    if (
      a !== 255 ||
      (b & 224) !== 224 ||
      v === 1 ||
      ((b >> 1) & 3) !== 1 ||
      bi === 0 ||
      bi === 15 ||
      si === 3 ||
      (d & 3) === 2
    )
      throw Error("invalid_mp3_frame");
    const rate = [44100, 48000, 32000][si] / (v === 3 ? 1 : v === 2 ? 2 : 4);
    const bitrate = (
      v === 3
        ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
        : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
    )[bi];
    const length =
      Math.floor(((v === 3 ? 144000 : 72000) * bitrate) / rate) +
      ((c >> 1) & 1);
    if (
      length < 24 ||
      offset + length > end ||
      (frames && (version !== v || sampleRate !== rate))
    )
      throw Error("truncated_or_mixed_mp3");
    version = v;
    sampleRate = rate;
    seconds += (v === 3 ? 1152 : 576) / rate;
    frames++;
    offset += length;
  }
  if (frames < 2 || seconds < 0.04 || seconds > 1800)
    throw Error("invalid_mp3_duration");
  return {
    hash: ttsHash(data),
    size: data.length,
    duration: Math.ceil(seconds),
  };
}
export async function readTtsBytes(response: Response) {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0].trim() !==
      "audio/mpeg" ||
    !response.body
  )
    throw Error("audio_read_unconfirmed");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > ttsMaxBytes) throw Error("audio_size_limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
