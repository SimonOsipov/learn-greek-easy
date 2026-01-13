import { cn } from '@/lib/utils';

interface TranslationProps {
  text: string;
  isVisible: boolean;
}

export function Translation({ text, isVisible }: TranslationProps) {
  return (
    <div
      className={cn(
        'mt-6 pt-6 text-3xl text-muted-foreground transition-opacity duration-300',
        isVisible ? 'border-t-2 border-border opacity-100' : 'opacity-0'
      )}
    >
      {text}
    </div>
  );
}
