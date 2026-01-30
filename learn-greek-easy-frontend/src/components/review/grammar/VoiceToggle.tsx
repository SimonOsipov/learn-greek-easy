import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { VerbVoice } from '@/types/grammar';

export interface VoiceToggleProps {
  selectedVoice: VerbVoice;
  onVoiceChange: (voice: VerbVoice) => void;
  disabled?: boolean;
}

export function VoiceToggle({ selectedVoice, onVoiceChange, disabled = false }: VoiceToggleProps) {
  const { t } = useTranslation('review');

  const handleCheckedChange = (checked: boolean) => {
    onVoiceChange(checked ? 'passive' : 'active');
  };

  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="voice-toggle"
        className={cn('text-sm', disabled && 'cursor-not-allowed opacity-50')}
      >
        {t('grammar.verbConjugation.voice.active')}
      </Label>
      <Switch
        id="voice-toggle"
        checked={selectedVoice === 'passive'}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        aria-label={t('grammar.verbConjugation.voice.toggleAriaLabel')}
      />
      <Label
        htmlFor="voice-toggle"
        className={cn('text-sm', disabled && 'cursor-not-allowed opacity-50')}
      >
        {t('grammar.verbConjugation.voice.passive')}
      </Label>
    </div>
  );
}
