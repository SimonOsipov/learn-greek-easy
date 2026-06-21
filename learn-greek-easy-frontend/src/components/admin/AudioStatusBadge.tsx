import { useTranslation } from 'react-i18next';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { AudioStatus } from '@/services/wordEntryAPI';

const STATUS_TONE: Record<AudioStatus, BadgeTone> = {
  ready: 'green',
  missing: 'red',
  generating: 'amber',
  failed: 'red',
};

interface AudioStatusBadgeProps {
  status: AudioStatus;
  'data-testid'?: string;
}

export function AudioStatusBadge({ status, 'data-testid': testId }: AudioStatusBadgeProps) {
  const { t } = useTranslation('admin');
  return (
    <Badge
      tone={STATUS_TONE[status]}
      className={status === 'generating' ? 'motion-safe:animate-pulse' : undefined}
      data-testid={testId}
    >
      <span data-testid={`audio-status-${status}`}>{t(`audioStatus.${status}`)}</span>
    </Badge>
  );
}
