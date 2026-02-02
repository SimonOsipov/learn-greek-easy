import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trackGrammarVoiceToggled } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { VerbVoice } from '@/types/grammar';

export interface VoiceToggleProps {
  selectedVoice: VerbVoice;
  onVoiceChange: (voice: VerbVoice) => void;
  disabled?: boolean;
  /** Optional card ID for analytics tracking */
  cardId?: string;
  /** Optional session ID for analytics tracking */
  sessionId?: string;
}

export function VoiceToggle({
  selectedVoice,
  onVoiceChange,
  disabled = false,
  cardId,
  sessionId,
}: VoiceToggleProps) {
  const { t } = useTranslation('review');

  const handleCheckedChange = (checked: boolean) => {
    const newVoice: VerbVoice = checked ? 'passive' : 'active';

    // Track analytics if context is provided
    if (cardId && sessionId) {
      trackGrammarVoiceToggled({
        card_id: cardId,
        part_of_speech: 'verb',
        from_voice: selectedVoice,
        to_voice: newVoice,
        session_id: sessionId,
      });
    }

    onVoiceChange(newVoice);
  };

  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor="voice-toggle"
        className={cn(
          'text-sm',
          selectedVoice === 'active' ? 'font-semibold' : 'font-normal',
          disabled && 'cursor-not-allowed opacity-50'
        )}
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
        className={cn(
          'text-sm',
          selectedVoice === 'passive' ? 'font-semibold' : 'font-normal',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {t('grammar.verbConjugation.voice.passive')}
      </Label>
    </div>
  );
}
