import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AudioStatus } from '@/services/wordEntryAPI';

const statusConfig: Record<
  AudioStatus,
  { variant: 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  ready: {
    variant: 'outline',
    className: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  },
  missing: {
    variant: 'secondary',
    className: '',
  },
  generating: {
    variant: 'outline',
    className:
      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 motion-safe:animate-pulse',
  },
  failed: {
    variant: 'destructive',
    className: '',
  },
};

interface AudioStatusBadgeProps {
  status: AudioStatus;
  'data-testid'?: string;
}

export function AudioStatusBadge({ status, 'data-testid': testId }: AudioStatusBadgeProps) {
  const { t } = useTranslation('admin');
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} className={cn(config.className)} data-testid={testId}>
      <span data-testid={`audio-status-${status}`}>{t(`audioStatus.${status}`)}</span>
    </Badge>
  );
}
