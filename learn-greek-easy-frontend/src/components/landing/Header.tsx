import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/theme';
import { Button } from '@/components/ui/button';

const Header = () => {
  const { t } = useTranslation('landing');

  return (
    <header
      data-testid="landing-header"
      className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg"
    >
      <div className="flex h-16 w-full items-center justify-between px-6">
        <div className="flex items-center gap-2 text-left">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">G</span>
          </div>
          <span className="text-lg font-semibold text-foreground">{t('header.brandName')}</span>
        </div>

        <nav className="hidden items-center gap-6 md:flex" data-testid="landing-nav">
          <a
            href="#features"
            className="text-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('header.nav.features')}
          </a>
          <a
            href="#pricing"
            className="text-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('header.nav.pricing')}
          </a>
          <a
            href="#faq"
            className="text-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('header.nav.faq')}
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeSwitcher data-testid="landing-theme-switcher" />
          <LanguageSwitcher variant="icon" data-testid="landing-language-switcher" />
          <Button
            variant="ghost"
            className="hidden text-lg sm:inline-flex"
            data-testid="landing-login-button"
            asChild
          >
            <Link to="/login">{t('header.cta.login')}</Link>
          </Button>
          <Button className="text-lg" data-testid="landing-get-started-button" asChild>
            <Link to="/register">{t('header.cta.getStarted')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
