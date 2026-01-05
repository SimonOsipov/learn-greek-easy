import { useTranslation } from 'react-i18next';

const Footer = () => {
  const { t } = useTranslation('landing');

  return (
    <footer data-testid="footer-section" className="border-t border-border/50 py-12">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">G</span>
            </div>
            <span className="font-semibold text-foreground">{t('footer.brandName')}</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-8">
            <a
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer.nav.about')}
            </a>
            <a
              href="#"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('footer.nav.pricing')}
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

          {/* Language hint */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('footer.languageCode')}</span>
            <span>{t('footer.language')}</span>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 border-t border-border/50 pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
