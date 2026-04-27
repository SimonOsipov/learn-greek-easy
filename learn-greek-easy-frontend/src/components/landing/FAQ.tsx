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
    'difference',
    'customCards',
    'prepTime',
    'freePlan',
    'monthlyVsYearly',
    'refundPolicy',
    'offline',
  ];

  return (
    <section
      data-testid="faq-section"
      id="faq"
      className="bg-[hsl(var(--landing-navy))]/5 py-16 md:py-24"
    >
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium text-[hsl(var(--landing-greek-blue-light))] motion-safe:animate-fade-up">
            {t('faq.label')}
          </p>
          <h2
            className="mb-3 text-2xl font-bold text-[hsl(var(--landing-greek-blue-light))] motion-safe:animate-fade-up md:text-4xl"
            style={{ animationDelay: '0.1s' }}
          >
            {t('faq.title')}
          </h2>
          <p
            className="text-lg text-[hsl(var(--landing-greek-blue-light))]/80 motion-safe:animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            {t('faq.subtitle')}
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="motion-safe:animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <Accordion type="single" collapsible className="space-y-4">
            {faqKeys.map((key, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-xl border border-[hsl(var(--landing-greek-blue-light))]/15 bg-[hsl(var(--landing-navy))]/5 px-6 transition-shadow data-[state=open]:shadow-md dark:border-[hsl(var(--landing-navy))]/25"
                data-testid="faq-item"
              >
                <AccordionTrigger className="py-5 text-left font-semibold text-[hsl(var(--landing-greek-blue-light))] hover:no-underline">
                  {t(`faq.items.${key}.question`)}
                </AccordionTrigger>
                <AccordionContent className="pb-5 leading-relaxed text-[hsl(var(--landing-greek-blue-light))]/80">
                  {t(`faq.items.${key}.answer`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
