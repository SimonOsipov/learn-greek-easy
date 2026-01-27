import React, { useState, useEffect } from 'react';

import {
  Home,
  Layers,
  BarChart3,
  User,
  MessageSquare,
  ChevronUp,
  GraduationCap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface MobileNavProps {
  className?: string;
}

interface NavChild {
  labelKey: string;
  href: string;
}

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** Additional paths that should also highlight this nav item */
  additionalActivePaths?: string[];
  /** Child menu items for sub-menu */
  children?: NavChild[];
}

const navItems: NavItem[] = [
  { id: 'home', labelKey: 'nav.home', icon: Home, href: '/' },
  {
    id: 'decks',
    labelKey: 'nav.decks',
    icon: Layers,
    href: '/decks',
    additionalActivePaths: ['/my-decks'],
    children: [
      { labelKey: 'nav.decksDropdown.allDecks', href: '/decks' },
      { labelKey: 'nav.decksDropdown.myDecks', href: '/my-decks' },
    ],
  },
  {
    id: 'practice',
    labelKey: 'nav.practice',
    icon: GraduationCap,
    href: '/practice',
    additionalActivePaths: ['/practice/culture-exam', '/news'],
    children: [
      { labelKey: 'nav.practiceDropdown.cultureExam', href: '/practice/culture-exam' },
      { labelKey: 'nav.practiceDropdown.newsFeed', href: '/news' },
    ],
  },
  {
    id: 'stats',
    labelKey: 'nav.stats',
    icon: BarChart3,
    href: '/statistics',
    additionalActivePaths: ['/achievements'],
  },
  { id: 'feedback', labelKey: 'nav.feedback', icon: MessageSquare, href: '/feedback' },
  { id: 'profile', labelKey: 'nav.profile', icon: User, href: '/profile' },
];

export const MobileNav: React.FC<MobileNavProps> = ({ className }) => {
  const { t } = useTranslation('common');
  const location = useLocation();
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);

  // Close sub-menu on route change
  useEffect(() => {
    setOpenSubMenu(null);
  }, [location.pathname]);

  const isActive = (item: NavItem) => {
    if (location.pathname === item.href) return true;
    if (item.additionalActivePaths) {
      return item.additionalActivePaths.includes(location.pathname);
    }
    return false;
  };

  const handleNavClick = (item: NavItem, e: React.MouseEvent) => {
    if (item.children) {
      e.preventDefault();
      setOpenSubMenu(openSubMenu === item.id ? null : item.id);
    }
  };

  const closeSubMenu = () => {
    setOpenSubMenu(null);
  };

  return (
    <>
      {/* Backdrop for closing sub-menu */}
      {openSubMenu && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={closeSubMenu} aria-hidden="true" />
      )}

      {/* Sub-menu popover */}
      {openSubMenu && (
        <div
          className="fixed bottom-16 left-0 right-0 z-[60] border-t border-border bg-background shadow-lg lg:hidden"
          role="menu"
          aria-label={t('nav.decks')}
          data-testid={`mobile-submenu-${openSubMenu}`}
        >
          <div className="flex flex-col py-2">
            {navItems
              .find((item) => item.id === openSubMenu)
              ?.children?.map((child) => (
                <Link
                  key={child.href}
                  to={child.href}
                  className={cn(
                    'flex items-center px-6 py-3 text-sm font-medium transition-colors',
                    location.pathname === child.href
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-secondary'
                  )}
                  role="menuitem"
                  onClick={closeSubMenu}
                >
                  {t(child.labelKey)}
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background shadow-nav lg:hidden',
          className
        )}
      >
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            const label = t(item.labelKey);
            const isSubMenuOpen = openSubMenu === item.id;

            if (item.children) {
              return (
                <button
                  key={item.id}
                  onClick={(e) => handleNavClick(item, e)}
                  className={cn(
                    'flex min-w-[64px] flex-col items-center px-3 py-2 transition-colors',
                    active || isSubMenuOpen
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label={label}
                  aria-expanded={isSubMenuOpen}
                  aria-haspopup="true"
                >
                  <div className="relative mb-1">
                    <Icon className="h-5 w-5" />
                    <ChevronUp
                      className={cn(
                        'absolute -right-2.5 -top-1 h-3 w-3 transition-transform',
                        isSubMenuOpen ? 'rotate-0' : 'rotate-180'
                      )}
                    />
                  </div>
                  <span className="text-xs font-medium">{label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                to={item.href}
                className={cn(
                  'flex min-w-[64px] flex-col items-center px-3 py-2 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="mb-1 h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};
