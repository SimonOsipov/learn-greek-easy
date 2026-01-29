import { useTranslation } from 'react-i18next';

import type { Example } from '@/types/grammar';

export interface ExampleSentencesProps {
  examples: Example[];
}

export function ExampleSentences({ examples }: ExampleSentencesProps) {
  const { t } = useTranslation('review');

  if (!examples || examples.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        {t('grammar.examples.noExamples')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {examples.map((example, index) => (
        <div key={index} className="rounded-lg border border-border bg-card p-4">
          {examples.length > 1 && (
            <span className="text-sm font-medium text-muted-foreground">{index + 1}. </span>
          )}
          {/* Greek - most prominent */}
          <p className="text-base font-medium">{example.greek}</p>
          {/* English */}
          <p className="mt-1 text-sm text-muted-foreground">{example.english}</p>
          {/* Russian */}
          <p className="text-sm text-muted-foreground">{example.russian}</p>
        </div>
      ))}
    </div>
  );
}
