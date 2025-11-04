import { cn } from '@/lib/utils';

interface TranslationProps {
  text: string;
  isVisible: boolean;
}

export function Translation({ text, isVisible }: TranslationProps) {
  return (
    <div
      className={cn(
        'mt-6 pt-6 text-3xl text-gray-600 transition-opacity duration-300',
        isVisible ? 'opacity-100 border-t-2 border-gray-200' : 'opacity-0'
      )}
    >
      {text}
    </div>
  );
}
