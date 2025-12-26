import React from 'react';

import { Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { type SupportedLanguage } from '@/i18n';
import log from '@/lib/logger';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  /** Display variant: 'icon' shows only globe, 'full' shows globe + current language name */
  variant?: 'icon' | 'full';
  /** Additional CSS classes */
  className?: string;
}

/**
 * LanguageSwitcher Component
 *
 * A dropdown menu for switching the application's interface language.
 * Uses the LanguageContext for state management and persistence.
 *
 * Features:
 * - Globe icon trigger (accessible)
 * - Shows flag emoji + native language name
 * - Highlights current language with checkmark
 * - Disabled state while language is changing
 * - Works for both authenticated and guest users
 *
 * @example
 * ```tsx
 * // Icon only (for header)
 * <LanguageSwitcher variant="icon" />
 *
 * // Full with current language name
 * <LanguageSwitcher variant="full" />
 * ```
 */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'icon',
  className,
}) => {
  const { t } = useTranslation('common');
  const { currentLanguage, changeLanguage, isChanging, availableLanguages } = useLanguage();

  const currentLangOption = availableLanguages.find((opt) => opt.code === currentLanguage);

  const handleLanguageChange = async (langCode: SupportedLanguage) => {
    try {
      await changeLanguage(langCode, 'header');
    } catch (error) {
      // Error is handled in context via console.error
      // Could show a toast here for user feedback if desired
      log.error('[LanguageSwitcher] Language change failed:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'icon' ? 'icon' : 'default'}
          className={cn('relative', className)}
          disabled={isChanging}
          aria-label={t('language.select')}
          data-testid="language-switcher-trigger"
        >
          {isChanging ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <Globe className="h-5 w-5" />
              {variant === 'full' && currentLangOption && (
                <span className="ml-2">
                  {currentLangOption.flag && <>{currentLangOption.flag} </>}
                  {currentLangOption.nativeName}
                </span>
              )}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" data-testid="language-switcher-menu">
        {availableLanguages.map((option) => {
          const isSelected = option.code === currentLanguage;
          return (
            <DropdownMenuItem
              key={option.code}
              onClick={() => handleLanguageChange(option.code)}
              className={cn(
                'cursor-pointer justify-between',
                isSelected && 'bg-accent font-medium'
              )}
              data-testid={`language-option-${option.code}`}
              aria-selected={isSelected}
            >
              <span className="flex items-center gap-2">
                {option.flag && <span className="text-base">{option.flag}</span>}
                <span>{option.nativeName}</span>
              </span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

LanguageSwitcher.displayName = 'LanguageSwitcher';
