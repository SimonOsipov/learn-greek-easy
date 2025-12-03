import { useState } from 'react';

export function KeyboardShortcutsTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    { key: 'Space', action: 'Flip card' },
    { key: '1', action: 'Again' },
    { key: '2', action: 'Hard' },
    { key: '3', action: 'Good' },
    { key: '4', action: 'Easy' },
  ];

  return (
    <div
      className="absolute left-4 top-4 z-10 hidden md:block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="cursor-help text-2xl opacity-60 transition-opacity hover:opacity-100"
        aria-label="Keyboard shortcuts"
        type="button"
      >
        ⌨️
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 min-w-[200px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 text-center text-xs font-bold text-gray-900">Keyboard Shortcuts</div>
          <div className="space-y-1.5">
            {shortcuts.map(({ key, action }) => (
              <div key={key} className="flex items-center gap-3 text-xs text-gray-700">
                <kbd className="min-w-[24px] rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-center font-mono text-xs font-semibold">
                  {key}
                </kbd>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
