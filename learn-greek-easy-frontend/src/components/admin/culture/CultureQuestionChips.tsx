import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { chipColorClasses } from '@/lib/completeness';
import { computeCultureChips } from '@/lib/cultureCompleteness';
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
            <span
              className={`cursor-default ${chipColorClasses[chip.color]}`}
              data-testid={`culture-chip-${chip.name}-${question.id}`}
            >
              {chip.label}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{chip.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
