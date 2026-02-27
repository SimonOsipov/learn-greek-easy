import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import type { AudioStatus } from '@/services/wordEntryAPI';

interface AudioGenerateButtonProps {
  status: AudioStatus | undefined | null;
  onClick: () => void;
  isLoading?: boolean;
  'data-testid'?: string;
}

export function AudioGenerateButton({
  status,
  onClick,
  isLoading = false,
  'data-testid': testId,
}: AudioGenerateButtonProps) {
  const { t } = useTranslation('admin');

  const label =
    status === 'failed'
      ? t('audioGenerate.retry')
      : status === 'ready'
        ? t('audioGenerate.regenerate')
        : t('audioGenerate.generate');
  const disabled = status === 'generating' || isLoading;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="h-6 px-2 text-xs"
    >
      {disabled && <Loader2 className="mr-1 h-3 w-3 motion-safe:animate-spin" />}
      {label}
    </Button>
  );
}
