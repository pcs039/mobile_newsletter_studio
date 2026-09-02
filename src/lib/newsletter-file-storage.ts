import { getSupabaseRestEndpoint, getSupabaseStorageEndpoint } from "@/lib/supabase-config";

export type ProjectFileUploadKind = "pdf_original" | "page_image" | "asset_image" | "audio_mp3";

type NewsletterProjectReference = {
  id: string;
  slug: string;
  title: string;
  page_count: number;
};

export type ProjectFileUploadResult =
  | {
      ok: true;
      message: string;
      bucket: string;
      path: string;
      fileName: string;
      mimeType: string;
      size: number;
    }
  | {
      ok: false;
      status: "not_configured" | "invalid_file" | "project_not_found" | "request_failed";
      message: string;
      httpStatus?: number;
    };

const uploadSettings: Record<
  ProjectFileUploadKind,
  {
    bucket: string;
    maxSizeBytes: number;
    allowed: Array<string>;
    defaultMimeType: string;
    fallbackExtension: string;
  }
> = {
  pdf_original: {
    bucket: "pdf-originals",
    maxSizeBytes: 60 * 1024 * 1024,
    allowed: ["application/pdf"],
    defaultMimeType: "application/pdf",
    fallbackExtension: "pdf",
  },
  page_image: {
    bucket: "page-images",
    maxSizeBytes: 25 * 1024 * 1024,
    allowed: ["image/"],
    defaultMimeType: "image/png",
    fallbackExtension: "png",
  },
  asset_image: {
    bucket: "mobile-assets",
    maxSizeBytes: 25 * 1024 * 1024,
    allowed: ["image/"],
    defaultMimeType: "image/png",
    fallbackExtension: "png",
  },
  audio_mp3: {
    bucket: "audio-files",
    maxSizeBytes: 40 * 1024 * 1024,
    allowed: ["audio/mpeg", "audio/mp3", "audio/x-mpeg", "audio/"],
    defaultMimeType: "audio/mpeg",
    fallbackExtension: "mp3",
  },
};

function getServiceHeaders(contentType = "application/json") {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!key) {
    return null;
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": contentType,
  };
}

function isAllowedFile(kind: ProjectFileUploadKind, file: File) {
  const settings = uploadSettings[kind];
  const mimeType = file.type || settings.defaultMimeType;

  return settings.allowed.some((allowedType) =>
    allowedType.endsWith("/") ? mimeType.startsWith(allowedType) : mimeType === allowedType,
  );
}

function getExtension(fileName: string, fallbackExtension: string) {
  const extension = fileName.split(".").pop()?.trim().toLowerCase();

  if (!extension || extension === fileName) {
    return fallbackExtension;
  }

  return extension.replace(/[^a-z0-9]/g, "") || fallbackExtension;
}

function makeStoragePath(projectSlug: string, file: File, fallbackExtension: string) {
  const extension = getExtension(file.name, fallbackExtension);
  const token =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${projectSlug}/${Date.now()}-${token}.${extension}`;
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function ensureBucket(bucket: string, headers: Record<string, string>) {
  const bucketEndpoint = getSupabaseStorageEndpoint(`/bucket/${encodeURIComponent(bucket)}`);

  if (!bucketEndpoint) {
    return false;
  }

  const existingBucket = await fetch(bucketEndpoint, {
    headers,
    cache: "no-store",
  });

  if (existingBucket.ok) {
    return true;
  }

  if (existingBucket.status !== 404) {
    return false;
  }

  const createBucketEndpoint = getSupabaseStorageEndpoint("/bucket");

  if (!createBucketEndpoint) {
    return false;
  }

  const createdBucket = await fetch(createBucketEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: bucket,
      name: bucket,
      public: false,
    }),
    cache: "no-store",
  });

  return createdBucket.ok || createdBucket.status === 409;
}

async function findProjectBySlug(projectSlug: string, headers: Record<string, string>) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?select=id,slug,title,page_count&slug=eq.${encodeURIComponent(
      projectSlug,
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

  const rows = (await response.json()) as NewsletterProjectReference[];

  return rows[0] ?? null;
}

async function patchProjectPdf(
  projectSlug: string,
  file: File,
  storagePath: string,
  headers: Record<string, string>,
) {
  const endpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?slug=eq.${encodeURIComponent(projectSlug)}`,
  );

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      pdf_original_path: storagePath,
      pdf_original_file_name: file.name,
      pdf_original_uploaded_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });

  return response.ok;
}

async function upsertPageImage(
  project: NewsletterProjectReference,
  pageNumber: number,
  storagePath: string,
  headers: Record<string, string>,
) {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_pages?on_conflict=project_id,page_number");

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      project_id: project.id,
      page_number: pageNumber,
      title: `${pageNumber}쪽`,
      image_path: storagePath,
      image_status: "uploaded",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  if (pageNumber <= project.page_count) {
    return true;
  }

  const projectEndpoint = getSupabaseRestEndpoint(
    `/rest/v1/newsletter_projects?id=eq.${encodeURIComponent(project.id)}`,
  );

  if (!projectEndpoint) {
    return true;
  }

  await fetch(projectEndpoint, {
    method: "PATCH",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ page_count: pageNumber }),
    cache: "no-store",
  });

  return true;
}

async function insertAssetImage(
  project: NewsletterProjectReference,
  file: File,
  storagePath: string,
  headers: Record<string, string>,
) {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_assets");

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      project_id: project.id,
      source_type: "institution_original",
      title: file.name,
      file_path: storagePath,
      mime_type: file.type || uploadSettings.asset_image.defaultMimeType,
      rights_status: "확인 필요",
      quality_status: "검수 대기",
      usage_note: "모바일 이미지 자산",
    }),
    cache: "no-store",
  });

  return response.ok;
}

async function insertAudioFile(
  project: NewsletterProjectReference,
  file: File,
  storagePath: string,
  headers: Record<string, string>,
) {
  const endpoint = getSupabaseRestEndpoint("/rest/v1/newsletter_audio_files");

  if (!endpoint) {
    return false;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      project_id: project.id,
      title: file.name,
      file_path: storagePath,
      script_status: "unchecked",
    }),
    cache: "no-store",
  });

  return response.ok;
}

export async function uploadProjectFile({
  file,
  kind,
  pageNumber,
  projectSlug,
}: {
  file: File;
  kind: ProjectFileUploadKind;
  pageNumber?: number;
  projectSlug: string;
}): Promise<ProjectFileUploadResult> {
  const headers = getServiceHeaders();

  if (!headers) {
    return {
      ok: false,
      status: "not_configured",
      message: "SUPABASE_SERVICE_ROLE_KEY가 설정되어야 파일 업로드를 사용할 수 있습니다.",
    };
  }

  const settings = uploadSettings[kind];

  if (!file || file.size === 0 || file.size > settings.maxSizeBytes || !isAllowedFile(kind, file)) {
    return {
      ok: false,
      status: "invalid_file",
      message: "파일 형식 또는 용량을 확인하세요.",
    };
  }

  const project = await findProjectBySlug(projectSlug, headers);

  if (!project) {
    return {
      ok: false,
      status: "project_not_found",
      message: "업로드할 프로젝트를 찾지 못했습니다. 대시보드에서 프로젝트를 다시 열어 주세요.",
      httpStatus: 404,
    };
  }

  const storagePath = makeStoragePath(project.slug, file, settings.fallbackExtension);
  const storageHeaders = getServiceHeaders(file.type || settings.defaultMimeType);
  const storageEndpoint = getSupabaseStorageEndpoint(
    `/object/${settings.bucket}/${encodeStoragePath(storagePath)}`,
  );

  if (!storageHeaders || !storageEndpoint || !(await ensureBucket(settings.bucket, headers))) {
    return {
      ok: false,
      status: "request_failed",
      message: "Supabase Storage 버킷을 준비하지 못했습니다.",
    };
  }

  const uploadResponse = await fetch(storageEndpoint, {
    method: "POST",
    headers: {
      ...storageHeaders,
      "x-upsert": "true",
    },
    body: file,
    cache: "no-store",
  });

  if (!uploadResponse.ok) {
    return {
      ok: false,
      status: "request_failed",
      message: (await uploadResponse.text()) || "Supabase Storage 파일 업로드에 실패했습니다.",
      httpStatus: uploadResponse.status,
    };
  }

  const recordUpdated =
    kind === "pdf_original"
      ? await patchProjectPdf(project.slug, file, storagePath, headers)
      : kind === "page_image"
        ? await upsertPageImage(project, pageNumber && pageNumber > 0 ? pageNumber : 1, storagePath, headers)
        : kind === "asset_image"
          ? await insertAssetImage(project, file, storagePath, headers)
          : await insertAudioFile(project, file, storagePath, headers);

  if (!recordUpdated) {
    return {
      ok: false,
      status: "request_failed",
      message: "파일은 저장됐지만 프로젝트 기록을 업데이트하지 못했습니다.",
    };
  }

  return {
    ok: true,
    message: "파일을 Supabase Storage에 업로드하고 프로젝트 기록에 연결했습니다.",
    bucket: settings.bucket,
    path: storagePath,
    fileName: file.name,
    mimeType: file.type || settings.defaultMimeType,
    size: file.size,
  };
}
