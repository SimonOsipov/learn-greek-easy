// src/components/admin/news/newsThumbs.ts
//
// Deterministic gradient palette for news card thumbnails.
// Used as a fallback when a news item has no image_url.

export const NEWS_THUMB_GRADIENTS: readonly string[] = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
] as const;

/**
 * Returns a deterministic gradient for the given news item id.
 * The same id always maps to the same gradient; gradients spread across all 9 entries.
 */
export function pickNewsThumb(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 9;
  return NEWS_THUMB_GRADIENTS[hash];
}
