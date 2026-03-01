import { useTranslation } from 'react-i18next';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type NewsLevel } from '@/utils/newsLevel';

interface NewsLevelToggleProps {
  level: NewsLevel;
  onChange: (level: NewsLevel) => void;
}

export function NewsLevelToggle({ level, onChange }: NewsLevelToggleProps) {
  const { t } = useTranslation('common');

  return (
    <Tabs
      value={level}
      onValueChange={(value) => onChange(value as NewsLevel)}
      data-testid="news-level-toggle"
    >
      <TabsList aria-label={t('news.level.label')}>
        <TabsTrigger value="a2">{t('news.level.a2')}</TabsTrigger>
        <TabsTrigger value="b2">{t('news.level.b2')}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
