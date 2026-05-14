import * as React from 'react';

import { Bell, Globe, Moon, Search, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  /** Bell icon shows a red dot when true. */
  hasNotifications?: boolean;
  /** Avatar initials. */
  avatarInitials?: string;
  /** Click handler for the search icon. */
  onSearchClick?: () => void;
}

export const TopBar = React.forwardRef<HTMLElement, TopBarProps>(
  ({ hasNotifications = false, avatarInitials = 'SO', onSearchClick, className, ...rest }, ref) => {
    const { t, i18n } = useTranslation('admin');
    const { currentTheme, toggleTheme } = useTheme();

    const handleLanguageToggle = () => {
      const next = i18n.language === 'en' ? 'ru' : 'en';
      i18n.changeLanguage(next);
    };

    return (
      <header ref={ref} className={cn('va-top', className)} {...rest}>
        <div className="va-brand">
          <span className="brand-mark" aria-hidden="true">
            Ελ
          </span>
          <span className="brand-text">Greeklish</span>
          <span className="chip">admin</span>
        </div>
        <nav className="va-nav" aria-label={t('shell.topBar.brand', 'Greeklish admin')}>
          <a className="active" aria-current="page">
            {t('shell.topBar.nav.admin', 'Admin')}
          </a>
          <a>{t('shell.topBar.nav.dashboard', 'Dashboard')}</a>
          <a>
            {t('shell.topBar.nav.decks', 'Decks')} <i className="caret">›</i>
          </a>
          <a>
            {t('shell.topBar.nav.practice', 'Practice')} <i className="caret">›</i>
          </a>
          <a>
            {t('shell.topBar.nav.statistics', 'Statistics')} <i className="caret">›</i>
          </a>
          <a>
            {t('shell.topBar.nav.support', 'Support')} <i className="caret">›</i>
          </a>
        </nav>
        <div className="va-top-right">
          <button
            type="button"
            className="icon-btn"
            aria-label={t('shell.topBar.search', 'Search admin')}
            onClick={onSearchClick}
          >
            <Search />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('shell.topBar.theme', 'Toggle theme')}
            onClick={() => toggleTheme('header')}
          >
            {currentTheme === 'dark' ? <Sun /> : <Moon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('shell.topBar.language', 'Switch language')}
            onClick={handleLanguageToggle}
          >
            <Globe />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('shell.topBar.notifications', 'Notifications')}
          >
            <Bell />
            {hasNotifications ? <i className="dot dot-red" aria-hidden="true" /> : null}
          </button>
          <span className="va-avatar" role="img" aria-label={`Admin user ${avatarInitials}`}>
            {avatarInitials}
          </span>
        </div>
      </header>
    );
  }
);

TopBar.displayName = 'TopBar';
