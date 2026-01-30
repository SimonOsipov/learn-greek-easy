import React, { useCallback } from 'react';

import { Globe, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { trackCultureLanguageChanged } from '@/lib/analytics';
import log from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { CultureLanguage } from '@/types/culture';

/**
 * Language options for culture content (includes Greek for question content).
 * This is separate from UI language options because culture questions
 * support Greek content even though the UI doesn't have Greek translations.
 */
interface CultureLanguageOption {
  code: CultureLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

const CULTURE_LANGUAGE_OPTIONS: CultureLanguageOption[] = [
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
];

/**
 * Storage key for culture question language preference.
 * Used when persisting selection to localStorage.
 */
const CULTURE_LANGUAGE_KEY = 'culture_question_language';

/**
 * Props for LanguageSelector component
 */
export interface LanguageSelectorProps {
  /** Current selected language */
  value: CultureLanguage;

  /** Callback when language changes */
  onChange: (lang: CultureLanguage) => void;

  /** Display variant: buttons (default) or dropdown */
  variant?: 'buttons' | 'dropdown';

  /** Size variant */
  size?: 'sm' | 'md';

  /** Whether to show flag icons */
  showFlags?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Get display configuration for a language
 */
function getLanguageDisplay(code: CultureLanguage) {
  const option = CULTURE_LANGUAGE_OPTIONS.find((opt) => opt.code === code);
  return {
    code: code.toUpperCase(),
    name: option?.nativeName || code,
    flag: option?.flag || '',
  };
}

/**
 * LanguageSelector Component
 *
 * Allows users to toggle the display language for culture exam questions.
 * This is separate from the app-wide language switcher because:
 * - It's specific to question content, not UI chrome
 * - Users may prefer different languages for questions vs interface
 * - It has a more compact, inline design
 *
 * Features:
 * - Button group variant (default): Shows EL/EN/RU as toggle buttons
 * - Dropdown variant: Compact dropdown for space-constrained UIs
 * - Optional flag icons
 * - Persists to localStorage when selection changes
 *
 * @example
 * ```tsx
 * // Button group variant (default)
 * <LanguageSelector
 *   value={questionLanguage}
 *   onChange={setQuestionLanguage}
 * />
 *
 * // Dropdown variant with flags
 * <LanguageSelector
 *   value={questionLanguage}
 *   onChange={setQuestionLanguage}
 *   variant="dropdown"
 *   showFlags
 * />
 * ```
 */
export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  variant = 'buttons',
  size = 'md',
  showFlags = false,
  className,
}) => {
  const { t } = useTranslation('culture');

  /**
   * Handle language selection.
   * Persists to localStorage, tracks analytics, and calls onChange.
   */
  const handleSelect = useCallback(
    (lang: CultureLanguage) => {
      if (lang === value) return;

      // Track analytics event
      trackCultureLanguageChanged(value, lang);

      // Persist to localStorage
      try {
        localStorage.setItem(CULTURE_LANGUAGE_KEY, lang);
      } catch {
        log.warn('[LanguageSelector] Could not save to localStorage');
      }

      onChange(lang);
    },
    [value, onChange]
  );

  const languages: CultureLanguage[] = ['el', 'en', 'ru'];

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  if (variant === 'dropdown') {
    const currentDisplay = getLanguageDisplay(value);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={size === 'sm' ? 'sm' : 'default'}
            className={cn('gap-2', className)}
            aria-label={t('language.selectLanguage', 'Question Language')}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            {showFlags && currentDisplay.flag && (
              <span aria-hidden="true">{currentDisplay.flag}</span>
            )}
            <span>{currentDisplay.name}</span>
            <ChevronDown className="h-3 w-3 opacity-50" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {languages.map((lang) => {
            const display = getLanguageDisplay(lang);
            const isSelected = lang === value;

            return (
              <DropdownMenuItem
                key={lang}
                onClick={() => handleSelect(lang)}
                className={cn(isSelected && 'bg-primary/10 dark:bg-primary/20')}
              >
                <span className="flex items-center gap-2">
                  {showFlags && display.flag && <span aria-hidden="true">{display.flag}</span>}
                  <span className={cn(isSelected && 'font-semibold')}>{display.name}</span>
                </span>
                {isSelected && (
                  <span className="ml-auto text-primary">
                    {/* Checkmark indicator for selected */}
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Button group variant (default)
  return (
    <div
      className={cn('inline-flex rounded-lg border border-border p-1', className)}
      role="group"
      aria-label={t('language.selectLanguage', 'Question Language')}
    >
      {languages.map((lang) => {
        const display = getLanguageDisplay(lang);
        const isSelected = lang === value;

        return (
          <button
            key={lang}
            type="button"
            onClick={() => handleSelect(lang)}
            className={cn(
              'rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 dark:focus:ring-offset-background',
              sizeClasses[size],
              isSelected
                ? 'bg-primary/20 text-primary dark:bg-primary/30'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            aria-pressed={isSelected}
            aria-label={t(`language.${lang}`, display.name)}
          >
            <span className="flex items-center gap-1">
              {showFlags && display.flag && <span aria-hidden="true">{display.flag}</span>}
              <span>{display.code}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
