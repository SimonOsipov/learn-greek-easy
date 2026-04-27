import { useState } from 'react';

import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/theme';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const Header = () => {
  const { t } = useTranslation('landing');
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: '#features', labelKey: 'header.nav.features' },
    { href: '#faq', labelKey: 'header.nav.faq' },
  ];

  return (
    <header
      data-testid="landing-header"
      className="fixed left-0 right-0 top-0 z-50 border-b border-[hsl(var(--landing-navy))]/15 bg-[hsl(var(--landing-navy))]/80 backdrop-blur-lg motion-safe:animate-landing-fade-in dark:border-[hsl(var(--landing-navy))]/25"
    >
      <div className="relative flex h-16 w-full items-center justify-between px-6">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2 text-left transition-opacity hover:opacity-80"
          aria-label={t('header.logoAriaLabel')}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--landing-greek-blue))]">
            <span className="text-sm font-bold text-white">G</span>
          </div>
          <span className="text-lg font-semibold text-foreground">{t('header.brandName')}</span>
        </a>

        <nav
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-6 md:flex"
          data-testid="landing-nav"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-lg text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(link.labelKey)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeSwitcher data-testid="landing-theme-switcher" />
          <LanguageSwitcher variant="icon" data-testid="landing-language-switcher" />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t('header.nav.menuLabel')}
                data-testid="landing-menu-button"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">{t('header.nav.ariaLabel')}</SheetTitle>
              <nav className="flex flex-col gap-4 pt-8">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="text-lg text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(link.labelKey)}
                  </a>
                ))}
              </nav>
              <Separator className="my-4" />
              <div className="flex flex-col gap-3">
                <Button
                  className="justify-start"
                  data-testid="landing-get-started-button-mobile"
                  onClick={() => {
                    setOpen(false);
                    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {t('header.cta.getStarted')}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            className="hidden text-lg md:inline-flex"
            data-testid="landing-get-started-button"
            onClick={() => {
              document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {t('header.cta.getStarted')}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
