import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { NounGender } from '@/types/grammar';

export interface GenderBadgeProps {
  gender: NounGender;
  className?: string;
}

const GENDER_CONFIG: Record<NounGender, { bgClass: string; textClass: string }> = {
  masculine: { bgClass: 'bg-blue-500', textClass: 'text-white' },
  feminine: { bgClass: 'bg-rose-500', textClass: 'text-white' },
  neuter: { bgClass: 'bg-slate-500', textClass: 'text-white' },
};

export function GenderBadge({ gender, className }: GenderBadgeProps) {
  const { t } = useTranslation('review');
  const config = GENDER_CONFIG[gender];

  return (
    <Badge
      className={cn(config.bgClass, config.textClass, 'pointer-events-none', className)}
      data-testid="gender-badge"
    >
      {t(`grammar.nounDeclension.genders.${gender}`)}
    </Badge>
  );
}
