import type { ImgHTMLAttributes } from 'react';
import { articleImageSizes, imageDeliverySrcSet } from '@/lib/image-delivery';
// Explicit enlargement/lightbox continues to use the original proxy URL.
export function ResponsiveDesignImage({src,alt,sizes=articleImageSizes,...props}:ImgHTMLAttributes<HTMLImageElement> & {src:string;alt:string}) {
  const webp=imageDeliverySrcSet(src,'webp'),avif=imageDeliverySrcSet(src,'avif');
  // eslint-disable-next-line @next/next/no-img-element -- Unrelated images keep their existing original delivery.
  if (!webp) return <img {...props} src={src} alt={alt}/>;
  return <picture style={{display:"contents"}}>
    {avif?<source type="image/avif" srcSet={avif} sizes={sizes}/>:null}
    {webp?<source type="image/webp" srcSet={webp} sizes={sizes}/>:null}
    <img {...props} src={src} alt={alt} sizes={sizes} loading="lazy"/>
  </picture>;
}
