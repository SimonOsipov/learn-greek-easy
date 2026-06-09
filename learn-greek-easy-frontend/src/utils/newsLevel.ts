export type NewsLevel = 'a2' | 'b1';

export const NEWS_LEVEL_KEY = 'greekly_news_level';
export const DEFAULT_NEWS_LEVEL: NewsLevel = 'a2';

export function getPersistedNewsLevel(): NewsLevel {
  try {
    if (typeof window === 'undefined') return DEFAULT_NEWS_LEVEL;
    const stored = window.localStorage.getItem(NEWS_LEVEL_KEY);
    // 'b2' is the legacy value for the base news level (renamed to 'b1' to match
    // the DB / admin tab). Map it forward so existing users keep the base level.
    return stored === 'b1' || stored === 'b2' ? 'b1' : 'a2';
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
