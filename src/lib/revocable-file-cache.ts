// Project publication and asset permissions can be revoked without changing a URL.
// Neither a browser nor a shared CDN may answer these URLs without authorization.
export const revocableFileHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

export function preventRevocableFileCaching<T extends Response>(response: T): T {
  for (const [name, value] of Object.entries(revocableFileHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}
