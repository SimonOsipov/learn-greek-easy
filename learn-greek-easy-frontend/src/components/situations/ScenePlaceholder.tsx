import { ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

interface ScenePlaceholderProps {
  variant: 'source' | 'illustration';
  className?: string;
}

export const ScenePlaceholder: React.FC<ScenePlaceholderProps> = ({ variant, className }) => {
  const { t } = useTranslation('common');

  const messageKey =
    variant === 'source'
      ? 'situations.detail.about.sourcePlaceholder'
      : 'situations.detail.about.illustrationPlaceholder';

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-muted/40', className)}>
      <div className="flex aspect-video items-center justify-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
      </div>
      <div className="px-4 py-3 text-sm">
        <span className="text-muted-foreground">{t(messageKey)}</span>
      </div>
    </div>
  );
};
