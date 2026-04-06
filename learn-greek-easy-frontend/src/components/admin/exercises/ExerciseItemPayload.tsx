import { WaveformPlayer } from '@/components/culture/WaveformPlayer';
import { cn } from '@/lib/utils';

export function elText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val !== null && 'el' in val)
    return String((val as Record<string, unknown>).el);
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export function ExerciseItemPayload({
  payload,
  audioUrl,
  readingText,
}: {
  payload: Record<string, unknown>;
  audioUrl?: string;
  readingText?: string;
}) {
  const questionText = elText(
    payload.prompt ?? payload.question_text ?? payload.question ?? payload.text
  );
  const options = Array.isArray(payload.options) ? payload.options : undefined;
  // Production uses correct_answer_index (0-based), seed data uses correct_option (1-based)
  const correctIndex =
    typeof payload.correct_answer_index === 'number'
      ? payload.correct_answer_index
      : typeof payload.correct_option === 'number'
        ? payload.correct_option - 1
        : undefined;

  return (
    <div className="space-y-3 text-sm">
      {audioUrl && (
        <WaveformPlayer
          audioUrl={audioUrl}
          variant="admin"
          barCount={32}
          showSpeedControl={false}
        />
      )}
      {readingText && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm leading-relaxed">
          {readingText}
        </p>
      )}
      {questionText && <p className="font-medium">{questionText}</p>}
      {options && options.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt, idx) => {
            const isCorrect = correctIndex !== undefined && idx === correctIndex;
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-md border px-3 py-2',
                  isCorrect
                    ? 'border-green-600 bg-green-50 font-semibold text-green-700'
                    : 'border-border text-muted-foreground'
                )}
              >
                {elText(opt)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
