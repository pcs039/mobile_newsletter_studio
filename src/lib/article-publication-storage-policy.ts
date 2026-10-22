// Reserved for independent revisions; legacy file endpoints must not serve or mutate it.
export const publicationPreservationBucket = "article-publication-preserved";
export const publicationPreservationPrefix = "independent-publications/v1";
export function isPublicationStorageReference(path: string) {
  let decoded=path;
  for(let n=0;n<5;n++){
    const parts=decoded.split(/[/?#\\]/).map(v=>v.toLowerCase());
    if(parts.includes(publicationPreservationBucket)||parts.includes("independent-publications"))return true;
    try{const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}catch{break;}
  }
  return false;
}
