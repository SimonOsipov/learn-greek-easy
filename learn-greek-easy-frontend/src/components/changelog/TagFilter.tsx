import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { ChangelogTag } from '@/types/changelog';
import { CHANGELOG_TAG_CONFIG, CHANGELOG_TAG_OPTIONS } from '@/types/changelog';

interface TagFilterProps {
  activeTag: ChangelogTag | null;
  onTagChange: (tag: ChangelogTag | null) => void;
}

export function TagFilter({ activeTag, onTagChange }: TagFilterProps) {
  const { t } = useTranslation('changelog');

  return (
    <div className="flex flex-wrap gap-2" data-testid="tag-filter">
      <Button
        variant={activeTag === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onTagChange(null)}
        data-testid="tag-filter-all"
      >
        {t('filter.all')}
      </Button>
      {CHANGELOG_TAG_OPTIONS.map((tag) => (
        <Button
          key={tag}
          variant={activeTag === tag ? 'default' : 'outline'}
          size="sm"
          onClick={() => onTagChange(tag)}
          data-testid={`tag-filter-${tag}`}
        >
          {t(CHANGELOG_TAG_CONFIG[tag].labelKey)}
        </Button>
      ))}
    </div>
  );
}
