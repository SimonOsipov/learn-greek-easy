/**
 * SIT-06 stub — filled in SIT-07a.
 *
 * NOTE: This stub renders a hidden RHF-registered input for `scenario_en` so that
 * tests can make the form dirty without needing a full tab implementation. The real
 * Dialog tab (SIT-07a) will reuse or replace this registration.
 */
import { useFormContext } from 'react-hook-form';

import type { SituationDetailResponse } from '@/types/situation';

import type { SituationDrawerFormData } from './SituationDrawer';

interface Props {
  situation: SituationDetailResponse;
}

export function SituationDrawerDialog({ situation: _situation }: Props) {
  const { register } = useFormContext<SituationDrawerFormData>();
  return (
    <input
      data-testid="scenario-en-input"
      aria-hidden="true"
      className="sr-only"
      {...register('scenario_en')}
    />
  );
}
