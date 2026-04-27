import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { NounGender } from '@/types/grammar';

export interface GenderBadgeProps {
  gender: NounGender;
  className?: string;
}

// Semantic color mapping: masculine=blue, feminine=red, neuter=gray
const GENDER_CONFIG: Record<NounGender, string> = {
  masculine: 'b-blue',
  feminine: 'b-red',
  neuter: 'b-gray',
};

export function GenderBadge({ gender, className }: GenderBadgeProps) {
  const { t } = useTranslation('review');
  const badgeVariant = GENDER_CONFIG[gender];

  return (
    <span className={cn('badge', badgeVariant, className)} data-testid="gender-badge">
      {t(`grammar.nounDeclension.genders.${gender}`)}
    </span>
  );
}
