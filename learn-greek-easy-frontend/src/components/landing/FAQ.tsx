import { useTranslation } from 'react-i18next';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ = () => {
  const { t } = useTranslation('landing');

  const faqKeys = [
    'exam',
    'level',
    'difference',
    'customCards',
    'prepTime',
    'freePlan',
    'monthlyVsYearly',
    'foundersEdition',
    'refundPolicy',
    'offline',
  ];

  return (
    <section data-testid="faq-section" id="faq" className="bg-secondary/20 py-16 md:py-24">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium text-primary motion-safe:animate-fade-up motion-safe:opacity-0">
            {t('faq.label')}
          </p>
          <h2
            className="mb-3 text-2xl font-bold motion-safe:animate-fade-up motion-safe:opacity-0 md:text-4xl"
            style={{ animationDelay: '0.1s' }}
          >
            {t('faq.title')}
          </h2>
          <p
            className="text-lg text-muted-foreground motion-safe:animate-fade-up motion-safe:opacity-0"
            style={{ animationDelay: '0.2s' }}
          >
            {t('faq.subtitle')}
          </p>
        </div>

        {/* FAQ Accordion */}
        <div
          className="motion-safe:animate-fade-up motion-safe:opacity-0"
          style={{ animationDelay: '0.3s' }}
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqKeys.map((key, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-xl border border-border/50 bg-card px-6 transition-shadow data-[state=open]:shadow-md"
                data-testid="faq-item"
              >
                <AccordionTrigger className="py-5 text-left font-semibold text-foreground hover:no-underline">
                  {t(`faq.items.${key}.question`)}
                </AccordionTrigger>
                <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">
                  {t(`faq.items.${key}.answer`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact CTA */}
        <p
          className="mt-10 text-center text-muted-foreground motion-safe:animate-fade-up motion-safe:opacity-0"
          style={{ animationDelay: '0.4s' }}
        >
          {t('faq.contactPrompt')}{' '}
          <a href="mailto:hello@greekly.app" className="font-medium text-primary hover:underline">
            {t('faq.contactLink')}
          </a>
        </p>
      </div>
    </section>
  );
};

export default FAQ;
