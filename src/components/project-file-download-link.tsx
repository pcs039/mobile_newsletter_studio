type ProjectFileDownloadLinkProps = {
  bucket?: "mobile-assets";
  className?: string;
  fileName?: string;
  path?: string | null;
  projectSlug: string;
};

function getFallbackFileName(path: string) {
  return path.split("/").pop() || "newsletter-image";
}

function getDownloadFileName(path: string, fileName?: string) {
  const fallbackName = getFallbackFileName(path);
  const fallbackExtension = fallbackName.includes(".") ? fallbackName.split(".").pop() : "";
  const requestedName = fileName?.trim();

  if (!requestedName) {
    return fallbackName;
  }

  if (/\.[a-z0-9]{2,5}$/i.test(requestedName) || !fallbackExtension) {
    return requestedName;
  }

  return `${requestedName}.${fallbackExtension}`;
}

export function ProjectFileDownloadLink({
  bucket = "mobile-assets",
  className = "dd-btn dd-btn-secondary dd-btn-sm",
  fileName,
  path,
  projectSlug,
}: ProjectFileDownloadLinkProps) {
  if (!path) {
    return null;
  }

  const params = new URLSearchParams({
    bucket,
    fileName: getDownloadFileName(path, fileName),
    path,
    projectSlug,
  });

  return (
    <a href={`/api/project-files/download?${params.toString()}`} className={className}>
      원본 다운로드
    </a>
  );
}
