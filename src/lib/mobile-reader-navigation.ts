export type ReaderPoint = { x: number; y: number };

export function readerSwipeDirection(start: ReaderPoint, end: ReaderPoint, viewportWidth: number) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const threshold = Math.min(90, Math.max(64, viewportWidth * 0.16));
  return Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.35 ? null : dx < 0 ? "next" : "previous";
}

export function isReaderInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest("a, button, input, select, textarea, audio, video, iframe, details, summary, [role=slider], [data-swipe-navigation-ignore]")) return true;
  // Do not steal gestures from an overflowing horizontal scroller.
  for (let node: Element | null = target; node; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return true;
  }
  return false;
}
