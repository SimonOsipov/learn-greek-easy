import { useState } from 'react';

import { useTranslation } from 'react-i18next';

export function KeyboardShortcutsTooltip() {
  const { t } = useTranslation('review');
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { key: t('keyboard.spaceKey'), actionKey: 'keyboard.flipCard' },
    { key: '1', actionKey: 'ratings.again' },
    { key: '2', actionKey: 'ratings.hard' },
    { key: '3', actionKey: 'ratings.good' },
    { key: '4', actionKey: 'ratings.easy' },
  ];

  return (
    <div
      className="absolute left-4 top-4 z-10 hidden md:block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="cursor-help text-2xl opacity-60 transition-opacity hover:opacity-100"
        aria-label={t('keyboard.title')}
        type="button"
      >
        ⌨️
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 min-w-[200px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 text-center text-xs font-bold text-gray-900">
            {t('keyboard.title')}
          </div>
          <div className="space-y-1.5">
            {shortcuts.map(({ key, actionKey }) => (
              <div key={key} className="flex items-center gap-3 text-xs text-gray-700">
                <kbd className="min-w-[24px] rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-center font-mono text-xs font-semibold">
                  {key}
                </kbd>
                <span>{t(actionKey)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
