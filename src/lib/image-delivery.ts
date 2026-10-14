// Reader shell: max 520px; mobile outer margins 40px and card padding 48–56px.
// Conservative slot bound also covers admin previews with less outer padding.
export const articleImageSizes = '(max-width: 520px) calc(100vw - 88px), 464px';
export const imageDeliveryWidths = [240, 480, 768, 960, 1200, 1600] as const;
export type ImageDeliveryKind = 'gpt' | 'canva';
export function imageDeliverySource(src: string, width: number, format: 'avif' | 'webp') {
  if (!src.startsWith('/') || src.startsWith('//')) return null;
  const url = new URL(src, 'https://delivery.invalid');
  if (!['/api/public-files/preview', '/api/client-review/files', '/api/project-files/preview'].includes(url.pathname) ||
    !['aiImageBlock', 'fullLayoutBlock', 'designAssetId'].some(key => url.searchParams.has(key))) return null;
  url.searchParams.set('deliveryWidth', String(width));
  url.searchParams.set('deliveryFormat', format);
  return url.pathname + url.search;
}
export function imageDeliverySrcSet(src: string, format: 'avif' | 'webp') {
  return imageDeliveryWidths.map(width => {
    const href = imageDeliverySource(src, width, format);
    return href ? `${href} ${width}w` : '';
  }).filter(Boolean).join(', ');
}
