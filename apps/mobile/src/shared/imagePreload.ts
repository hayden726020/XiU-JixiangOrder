const MAX_PINNED_IMAGES = 64;
const preloadedUrls = new Set<string>();
const pinnedImages = new Map<string, HTMLImageElement>();

/**
 * Preloads and decodes an image URL once per page session, keeping a bounded set
 * of Image references alive so WebView does not immediately evict decoded bitmaps.
 */
export function preloadImage(url: string | null | undefined): void {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return;
  if (typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!trimmed || preloadedUrls.has(trimmed)) return;
  preloadedUrls.add(trimmed);

  const img = new Image();
  img.decoding = 'async';
  img.src = trimmed;
  if (typeof img.decode === 'function') {
    img.decode().catch(() => {});
  }

  if (pinnedImages.size >= MAX_PINNED_IMAGES) {
    const oldestKey = pinnedImages.keys().next().value;
    if (oldestKey !== undefined) {
      pinnedImages.delete(oldestKey);
    }
  }
  pinnedImages.set(trimmed, img);
}

/**
 * Batch preloads unique non-empty image URLs.
 */
export function preloadImages(urls: readonly (string | null | undefined)[]): void {
  for (const url of urls) {
    preloadImage(url);
  }
}
