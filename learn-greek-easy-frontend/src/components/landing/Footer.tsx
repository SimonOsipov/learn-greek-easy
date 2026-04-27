import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation('landing');

  return (
    <footer
      data-testid="landing-footer"
      className="border-t border-[hsl(var(--landing-navy))]/15 py-12 motion-safe:animate-landing-fade-in dark:border-[hsl(var(--landing-navy))]/25"
    >
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--landing-greek-blue))]">
              <span className="text-sm font-bold text-white">G</span>
            </div>
            <span className="font-semibold text-foreground">{t('footer.brandName')}</span>
          </div>

          {/* Links */}
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:gap-8"
            data-testid="footer-links"
          >
            <a
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer.nav.features')}
            </a>
            <a
              href="#faq"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer.nav.faq')}
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer.nav.contact')}
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer.nav.privacy')}
            </a>
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-8 border-t border-[hsl(var(--landing-navy))]/15 pt-8 text-center dark:border-[hsl(var(--landing-navy))]/25">
          <p className="text-sm text-muted-foreground">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
