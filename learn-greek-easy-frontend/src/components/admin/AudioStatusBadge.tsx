import { useTranslation } from 'react-i18next';

import type { AudioStatus } from '@/services/wordEntryAPI';

const STATUS_CLASS: Record<AudioStatus, string> = {
  ready: 'badge b-green',
  missing: 'badge b-red',
  generating: 'badge b-amber motion-safe:animate-pulse',
  failed: 'badge b-red',
};

interface AudioStatusBadgeProps {
  status: AudioStatus;
  'data-testid'?: string;
}

export function AudioStatusBadge({ status, 'data-testid': testId }: AudioStatusBadgeProps) {
  const { t } = useTranslation('admin');
  return (
    <span className={STATUS_CLASS[status]} data-testid={testId}>
      <span data-testid={`audio-status-${status}`}>{t(`audioStatus.${status}`)}</span>
    </span>
  );
}
