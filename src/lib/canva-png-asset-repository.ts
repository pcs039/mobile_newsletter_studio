import "server-only";
import { CanvaConnectError } from "@/lib/canva-connect-contract";
import { validateDesignAssetMetadata } from "@/lib/design-asset-metadata";
import { insertProjectDesignAssetRecord, uploadProjectDesignAssetFile } from "@/lib/project-design-asset-write";
import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";
import type { CanvaImportAssetType } from "@/lib/canva-png-export";

type ImportAssetRow = { id: string; project_id: string; name: string; metadata: unknown };
function headers(contentType = "application/json") {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new CanvaConnectError(503, "디자인 자산 저장 설정을 확인해 주세요.");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": contentType };
}

export async function findCanvaPngAsset(projectId: string, assetId: string, designId: string) {
  const endpoint = getSupabaseRestEndpoint(`/rest/v1/newsletter_project_design_assets?${new URLSearchParams({
    select: "id,project_id,name,metadata", project_id: `eq.${projectId}`, id: `eq.${assetId}`, limit: "1",
  })}`);
  if (!endpoint) throw new CanvaConnectError(503, "디자인 자산 저장 설정을 확인해 주세요.");
  const r = await fetch(endpoint, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new CanvaConnectError(503, "디자인 자산의 metadata 저장 구조를 확인해 주세요.");
  const [row] = await r.json() as ImportAssetRow[];
  if (!row) return null;
  const metadata = validateDesignAssetMetadata(row.metadata);
  if (row.project_id !== projectId || !metadata.ok || metadata.metadata?.canvaExport?.designId !== designId || metadata.metadata.canvaExport.format !== "png") {
    throw new CanvaConnectError(409, "기존 가져오기 자산을 확인해 주세요.");
  }
  return { id: row.id, name: row.name };
}

export async function registerCanvaPngAsset(input: {
  projectId: string; assetId: string; designId: string; assetType: CanvaImportAssetType; name: string; file: File;
}) {
  const existing = await findCanvaPngAsset(input.projectId, input.assetId, input.designId);
  if (existing) return existing;
  const bucket = "design-production-assets";
  const bucketEndpoint = getSupabaseStorageEndpoint(`/bucket/${bucket}`);
  if (!bucketEndpoint) throw new CanvaConnectError(503, "기존 디자인 Storage를 확인해 주세요.");
  const bucketResponse = await fetch(bucketEndpoint, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(10000) });
  const bucketInfo = bucketResponse.ok ? await bucketResponse.json() : null;
  // Reuse the existing private bucket. Imports never create/change buckets or policies.
  if (!bucketInfo || bucketInfo.public !== false) throw new CanvaConnectError(503, "기존 비공개 디자인 Storage가 필요합니다.");
  const path = `projects/${input.projectId}/production/canva/canva-${input.assetId}.png`;
  const uploaded = await uploadProjectDesignAssetFile(bucket, path, input.file, headers("image/png"), AbortSignal.timeout(15000));
  // The deterministic path supports recovery after upload/insert interruption.
  // Only this server import can address this path; never overwrite an existing file.
  if (!uploaded.ok && ![400,409].includes(uploaded.status)) throw new CanvaConnectError(502, "PNG 파일을 디자인 Storage에 등록하지 못했습니다.");
  if (!uploaded.ok) {
    const error = await uploaded.json().catch(() => null);
    if (uploaded.status !== 409 && !["Duplicate", "409"].includes(String(error?.statusCode)) && error?.error !== "Duplicate") {
      throw new CanvaConnectError(502, "PNG 파일을 디자인 Storage에 등록하지 못했습니다.");
    }
  }
  const metadata = validateDesignAssetMetadata({ source: "canva", usageTags: [], reuseScope: "project", transparency: "unknown", canvaExport: { designId: input.designId, format: "png" } });
  if (!metadata.ok) throw new CanvaConnectError(400, metadata.message);
  const inserted = await insertProjectDesignAssetRecord({
    id: input.assetId, project_id: input.projectId, name: input.name, asset_type: input.assetType,
    metadata: metadata.metadata, parent_source_asset_id: null, language: "ko", variant: "primary",
    background_mode: "any", usage_role: "article", approval_status: "draft", is_primary: false,
    is_active: true, sort_order: 0, storage_bucket: bucket, storage_path: path,
    original_file_name: `canva-${input.designId}.png`, mime_type: "image/png", file_size_bytes: input.file.size,
    alt_text: null, usage_note: null,
  }, headers(), AbortSignal.timeout(10000));
  // Read back even after an ambiguous response: a competing request can only
  // insert the same project/design/format PK. Do not delete its stored file.
  const saved = await findCanvaPngAsset(input.projectId, input.assetId, input.designId);
  if (saved) return saved;
  if (!inserted.ok) throw new CanvaConnectError(502, "자산 기록을 저장하지 못했습니다. 진행 작업 확인으로 다시 시도할 수 있습니다.");
  throw new CanvaConnectError(502, "등록된 디자인 자산을 확인하지 못했습니다.");
}
