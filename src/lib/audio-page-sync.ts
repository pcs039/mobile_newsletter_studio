export type AudioPageSegment = {
  endTime: number;
  pageNumber: number;
  startTime: number;
};

export function buildAudioPageSegments(duration: number, pageCount: number) {
  if (!Number.isFinite(duration) || duration <= 0 || pageCount <= 0) {
    return [];
  }

  const segmentDuration = duration / pageCount;

  return Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const startTime = index * segmentDuration;
    const endTime = pageNumber === pageCount ? duration : pageNumber * segmentDuration;

    return {
      endTime,
      pageNumber,
      startTime,
    };
  });
}

export function getAudioSyncedPageNumber(currentTime: number, duration: number, pageCount: number) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0 || pageCount <= 0) {
    return null;
  }

  if (currentTime >= duration) {
    return pageCount;
  }

  const clampedTime = Math.max(0, currentTime);
  const segmentDuration = duration / pageCount;

  return Math.min(pageCount, Math.floor(clampedTime / segmentDuration) + 1);
}
