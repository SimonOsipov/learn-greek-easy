import { useTranslation } from 'react-i18next';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function KeyboardShortcutsTooltip() {
  const { t } = useTranslation('review');

  const shortcuts = [
    { key: t('keyboard.spaceKey'), actionKey: 'keyboard.flipCard' },
    { key: '1', actionKey: 'ratings.again' },
    { key: '2', actionKey: 'ratings.hard' },
    { key: '3', actionKey: 'ratings.good' },
    { key: '4', actionKey: 'ratings.easy' },
  ];

  return (
    <div className="absolute left-4 top-4 z-10 hidden md:block">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="cursor-help text-2xl opacity-60 transition-opacity hover:opacity-100"
            aria-label={t('keyboard.title')}
            type="button"
          >
            ⌨️
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="min-w-[200px] p-3">
          <div className="mb-2 text-center text-xs font-bold text-foreground">
            {t('keyboard.title')}
          </div>
          <div className="space-y-1.5">
            {shortcuts.map(({ key, actionKey }) => (
              <div key={key} className="flex items-center gap-3 text-xs text-foreground">
                <kbd className="min-w-[24px] rounded border border-border bg-muted px-2 py-0.5 text-center font-mono text-xs font-semibold">
                  {key}
                </kbd>
                <span>{t(actionKey)}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
