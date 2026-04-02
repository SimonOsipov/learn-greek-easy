import { ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

interface ScenePlaceholderProps {
  className?: string;
}

export const ScenePlaceholder: React.FC<ScenePlaceholderProps> = ({ className }) => {
  const { t } = useTranslation('common');

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-muted/40', className)}>
      <div className="flex aspect-video items-center justify-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <div className="px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {t('situations.detail.about.scenePlaceholder')}
        </span>
      </div>
    </div>
  );
};
