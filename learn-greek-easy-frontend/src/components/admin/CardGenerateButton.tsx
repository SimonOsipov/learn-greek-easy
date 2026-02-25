import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface CardGenerateButtonProps {
  label: string;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

export function CardGenerateButton({
  label,
  onClick,
  isLoading = false,
  disabled = false,
  'data-testid': testId,
}: CardGenerateButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={isLoading || disabled}
      data-testid={testId}
      className="h-6 px-2 text-xs"
    >
      {isLoading && <Loader2 className="mr-1 h-3 w-3 motion-safe:animate-spin" />}
      {label}
    </Button>
  );
}
