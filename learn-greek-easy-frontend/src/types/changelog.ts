/**
 * Changelog entry types for the Learn Greek Easy application.
 */

/** Tag classification for changelog entries */
export type ChangelogTag = 'new_feature' | 'bug_fix' | 'announcement';

/** Single changelog entry (public/localized) */
export interface ChangelogItem {
  id: string;
  title: string;
  content: string;
  tag: ChangelogTag;
  created_at: string;
  updated_at: string;
}

/** Paginated response for public changelog */
export interface ChangelogListResponse {
  total: number;
  page: number;
  page_size: number;
  items: ChangelogItem[];
}

/** Admin changelog entry with all language fields */
export interface ChangelogEntryAdmin {
  id: string;
  title_en: string;
  title_ru: string;
  content_en: string;
  content_ru: string;
  tag: ChangelogTag;
  created_at: string;
  updated_at: string;
}

/** Request body for creating a changelog entry */
export interface ChangelogCreateRequest {
  title_en: string;
  title_ru: string;
  content_en: string;
  content_ru: string;
  tag: ChangelogTag;
}

/** Request body for updating a changelog entry (all fields optional) */
export interface ChangelogUpdateRequest {
  title_en?: string;
  title_ru?: string;
  content_en?: string;
  content_ru?: string;
  tag?: ChangelogTag;
}

/** Paginated response for admin changelog list */
export interface ChangelogAdminListResponse {
  total: number;
  page: number;
  page_size: number;
  items: ChangelogEntryAdmin[];
}

/** Tag display configuration */
export const CHANGELOG_TAG_CONFIG: Record<
  ChangelogTag,
  {
    labelKey: string;
    colorClass: string;
  }
> = {
  new_feature: {
    labelKey: 'changelog:tag.newFeature',
    colorClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  bug_fix: {
    labelKey: 'changelog:tag.bugFix',
    colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  },
  announcement: {
    labelKey: 'changelog:tag.announcement',
    colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  },
};

/** Languages supported for changelog content */
export type ChangelogLanguage = 'en' | 'ru';

/** Language options for admin form tabs */
export const CHANGELOG_LANGUAGES: readonly ChangelogLanguage[] = ['en', 'ru'];

/** Tag options for admin form select */
export const CHANGELOG_TAG_OPTIONS: readonly ChangelogTag[] = [
  'new_feature',
  'bug_fix',
  'announcement',
];

/** Get title field name for a specific language */
export function getTitleField(lang: ChangelogLanguage): keyof ChangelogEntryAdmin {
  return `title_${lang}` as keyof ChangelogEntryAdmin;
}

/** Get content field name for a specific language */
export function getContentField(lang: ChangelogLanguage): keyof ChangelogEntryAdmin {
  return `content_${lang}` as keyof ChangelogEntryAdmin;
}
