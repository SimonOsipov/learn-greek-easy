// src/components/admin/CardErrorStatusBadge.tsx
//
// Shared status badge for card error reports.
// Reads the label from i18n so the badge renders in the active locale —
// root-cause fix for CER-24 (drawer badge was hardcoded English).

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { CARD_ERROR_STATUS_CONFIG, type CardErrorStatus } from '@/types/cardError';

type Props = { status: CardErrorStatus; className?: string };

export function CardErrorStatusBadge({ status, className }: Props) {
  const { t } = useTranslation('admin');
  const { badgeClass } = CARD_ERROR_STATUS_CONFIG[status];
  return (
    <span className={cn(badgeClass, className)} data-testid="card-error-status-badge">
      {t(`cardErrors.statuses.${status.toLowerCase()}`)}
    </span>
  );
}
