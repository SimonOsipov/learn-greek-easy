import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { ChangelogTag } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG, CHANGELOG_TAG_OPTIONS } from '@/types/changelog';

interface TagFilterProps {
  activeTag: ChangelogTag | null;
  onTagChange: (tag: ChangelogTag | null) => void;
}

export function TagFilter({ activeTag, onTagChange }: TagFilterProps) {
  const { t } = useTranslation('changelog');

  return (
    <div className="pill-nav" data-testid="tag-filter">
      <button
        type="button"
        onClick={() => onTagChange(null)}
        aria-pressed={activeTag === null}
        className={cn(activeTag === null && 'active')}
        data-testid="tag-filter-all"
      >
        {t('filter.all')}
      </button>
      {CHANGELOG_TAG_OPTIONS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onTagChange(tag)}
          aria-pressed={activeTag === tag}
          className={cn(activeTag === tag && 'active')}
          data-testid={`tag-filter-${tag}`}
        >
          {t(CHANGELOG_TAG_CONFIG[tag].labelKey)}
        </button>
      ))}
    </div>
  );
}
