export type NewsLevel = 'a2' | 'b2';

export const NEWS_LEVEL_KEY = 'greekly_news_level';
export const DEFAULT_NEWS_LEVEL: NewsLevel = 'a2';

export function getPersistedNewsLevel(): NewsLevel {
  try {
    if (typeof window === 'undefined') return DEFAULT_NEWS_LEVEL;
    const stored = window.localStorage.getItem(NEWS_LEVEL_KEY);
    return stored === 'b2' ? 'b2' : 'a2';
  } catch {
    return DEFAULT_NEWS_LEVEL;
  }
}

export function setPersistedNewsLevel(level: NewsLevel): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NEWS_LEVEL_KEY, level);
  } catch {
    // best-effort persistence
  }
}
