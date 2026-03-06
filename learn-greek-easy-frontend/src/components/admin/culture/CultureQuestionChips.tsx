import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { chipColorClasses } from '@/lib/completeness';
import { computeCultureChips } from '@/lib/cultureCompleteness';
import { cn } from '@/lib/utils';
import type { AdminCultureQuestion } from '@/services/adminAPI';

interface Props {
  question: AdminCultureQuestion;
}

export function CultureQuestionChips({ question }: Props) {
  const chips = computeCultureChips(question).filter((c) => c.visible);

  if (chips.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid={`culture-chips-${question.id}`}>
      {chips.map((chip) => (
        <Tooltip key={chip.name}>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn('cursor-default px-1.5 py-0 text-[10px]', chipColorClasses[chip.color])}
              data-testid={`culture-chip-${chip.name}-${question.id}`}
            >
              {chip.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{chip.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
