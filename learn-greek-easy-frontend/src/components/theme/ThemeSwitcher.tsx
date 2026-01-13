import React from 'react';

import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeSwitcherProps {
  className?: string;
}

/**
 * ThemeSwitcher Component
 *
 * A button that toggles between light and dark themes.
 * Uses Sun icon for light mode, Moon icon for dark mode.
 * Matches the LanguageSwitcher ghost button pattern.
 */
export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ className }) => {
  const { t } = useTranslation('common');
  const { currentTheme, toggleTheme, isChanging } = useTheme();

  const handleClick = () => {
    toggleTheme('header');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('relative', className)}
      onClick={handleClick}
      disabled={isChanging}
      aria-label={
        currentTheme === 'light'
          ? t('theme.switchToDark', 'Switch to dark mode')
          : t('theme.switchToLight', 'Switch to light mode')
      }
      data-testid="theme-switcher"
    >
      {isChanging ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : currentTheme === 'light' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  );
};

ThemeSwitcher.displayName = 'ThemeSwitcher';
