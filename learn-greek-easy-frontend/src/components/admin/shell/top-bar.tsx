import * as React from 'react';

import { Bell, Globe, Moon, Search, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AdminAvatar } from '@/components/ui/admin-avatar';
import { useTheme } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import { cn } from '@/lib/utils';

export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Bell icon shows a red dot when true. Defaults to false.
   * Wire to inbox unread count once ADMIN2-03 lands.
   */
  hasNotifications?: boolean;
  /**
   * Avatar initials. Defaults to "SO" (single hard-coded admin user today).
   * Consumer can override once admin user identity is exposed via store.
   */
  avatarInitials?: string;
  /**
   * Click handler for the search icon. Currently a no-op in callers.
   * Reserved so we don't have to break the API when global search lands.
   */
  onSearchClick?: () => void;
}

export const TopBar = React.forwardRef<HTMLElement, TopBarProps>(
  ({ hasNotifications = false, avatarInitials = 'SO', onSearchClick, className, ...rest }, ref) => {
    const { t } = useTranslation('admin');
    const { currentTheme, toggleTheme } = useTheme();
    const isDark = currentTheme === 'dark';

    const handleLanguageToggle = () => {
      const next = i18n.language === 'en' ? 'ru' : 'en';
      void i18n.changeLanguage(next);
    };

    return (
      <header className={cn('va-top', className)} ref={ref} {...rest}>
        <div className="va-brand">
          <span className="brand-mark">Ελ</span>
          <span className="brand-text">Greeklish</span>
          <span className="chip">admin</span>
        </div>

        {/* Decorative chrome — real navigation lands in ADMIN2-04..11. */}
        <div className="va-nav" aria-hidden="true">
          <span className="active" aria-current="page">
            Admin
          </span>
          <span>Dashboard</span>
          <span>
            Decks <i className="caret">›</i>
          </span>
          <span>
            Practice <i className="caret">›</i>
          </span>
          <span>
            Statistics <i className="caret">›</i>
          </span>
          <span>
            Support <i className="caret">›</i>
          </span>
        </div>

        <div className="va-top-right">
          <button
            type="button"
            className="icon-btn"
            aria-label={t('shell.topBar.search')}
            onClick={onSearchClick}
          >
            <Search />
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label={t('shell.topBar.theme')}
            onClick={() => toggleTheme('header')}
          >
            {isDark ? <Sun data-testid="theme-icon-sun" /> : <Moon data-testid="theme-icon-moon" />}
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label={t('shell.topBar.language')}
            onClick={handleLanguageToggle}
          >
            <Globe />
          </button>

          <button
            type="button"
            className="icon-btn relative"
            aria-label={t('shell.topBar.notifications')}
          >
            <Bell />
            {hasNotifications && <i className="dot dot-red" aria-hidden="true" />}
          </button>

          <AdminAvatar initials={avatarInitials} tone="blue" />
        </div>
      </header>
    );
  }
);

TopBar.displayName = 'TopBar';
