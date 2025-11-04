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
      className="absolute top-4 left-4 z-10 hidden md:block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className="text-2xl opacity-60 hover:opacity-100 transition-opacity cursor-help"
        aria-label="Keyboard shortcuts"
        type="button"
      >
        ⌨️
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
          <div className="text-xs font-bold text-gray-900 mb-2 text-center">
            Keyboard Shortcuts
          </div>
          <div className="space-y-1.5">
            {shortcuts.map(({ key, action }) => (
              <div key={key} className="flex items-center gap-3 text-xs text-gray-700">
                <kbd className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-semibold font-mono min-w-[24px] text-center">
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
