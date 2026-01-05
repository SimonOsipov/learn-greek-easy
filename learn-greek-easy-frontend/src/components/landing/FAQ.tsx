import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ = () => {
  const faqs: FAQItem[] = [
    {
      question: 'What is the Greek citizenship language exam?',
      answer:
        'The Greek citizenship language exam tests your ability to communicate in Greek at a B1 or B2 level (depending on your application category). It includes reading comprehension, writing, listening, and speaking sections. You will need to demonstrate that you can handle everyday situations, understand main points of clear texts, and express yourself on familiar topics.',
    },
    {
      question: 'What level of Greek do I need to pass?',
      answer:
        'Most applicants need to demonstrate B1 level proficiency, which means you can understand the main points of clear standard input on familiar matters. Some categories may require B2 level. Greekly covers vocabulary and grammar from A1 through B2 to ensure you are fully prepared.',
    },
    {
      question: 'How is Greekly different from other language apps?',
      answer:
        'Greekly is built specifically for the Greek citizenship exam. Unlike general language apps, we focus on the vocabulary, grammar, and cultural knowledge you will actually be tested on. Our content includes themed vocabulary for real-life situations (banking, medical visits, bureaucracy), history and culture questions, and authentic audio from Greek media.',
    },
    {
      question: 'Can I create my own flashcards?',
      answer:
        'Yes! With our Custom Cards & Decks feature, you can create your own flashcards and organize them into personalized decks. This is perfect for words you encounter in daily life, terms from your specific profession, or areas where you need extra practice.',
    },
    {
      question: 'How long does it take to prepare for the exam?',
      answer:
        'Preparation time varies based on your starting level. If you are starting from zero, plan for 6-12 months of consistent study. If you already have some Greek knowledge, 3-6 months of focused practice may be sufficient. We recommend 20-30 minutes of daily practice for best results.',
    },
    {
      question: 'What is included in the Free plan?',
      answer:
        'The Free plan includes access to basic A1 vocabulary cards, limited daily practice sessions, progress tracking, and community access. It is a great way to get started and see if Greekly is right for you before upgrading to Premium.',
    },
    {
      question: 'What is the difference between Monthly and Yearly Premium?',
      answer:
        'Both plans include full access to all features: complete vocabulary from A1-B2, unlimited practice, all grammar exercises, real news and audio content, and history/culture questions. The Yearly plan saves you 148 EUR compared to paying monthly (equivalent to getting 2+ months free) and includes early access to new features.',
    },
    {
      question: 'What is the Founders Edition?',
      answer:
        'The Founders Edition is a one-time payment of 250 EUR that gives you lifetime access to Greekly, including all future updates and features. You will also get a Founders badge, direct input on new features, and access to our exclusive founders community. It is perfect for those who want to support our mission while securing permanent access.',
    },
    {
      question: 'What is your refund policy?',
      answer:
        'We offer a 14-day money-back guarantee on all paid plans, no questions asked. If Greekly is not the right fit for you, simply contact us within 14 days of your purchase for a full refund. For the Founders Edition, the same 14-day guarantee applies.',
    },
    {
      question: 'Can I use Greekly offline?',
      answer:
        'Offline mode is coming soon for Yearly Premium and Founders Edition members. This will allow you to download vocabulary decks and practice without an internet connection - perfect for studying on your commute or when traveling.',
    },
  ];

  return (
    <section data-testid="faq-section" id="faq" className="bg-secondary/20 py-16 md:py-24">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 animate-fade-up text-sm font-medium text-primary opacity-0">
            COMMON QUESTIONS
          </p>
          <h2
            className="mb-3 animate-fade-up text-2xl font-bold opacity-0 md:text-4xl"
            style={{ animationDelay: '0.1s' }}
          >
            Frequently Asked Questions
          </h2>
          <p
            className="animate-fade-up text-lg text-muted-foreground opacity-0"
            style={{ animationDelay: '0.2s' }}
          >
            Everything you need to know about Greekly and the citizenship exam
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="animate-fade-up opacity-0" style={{ animationDelay: '0.3s' }}>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-xl border border-border/50 bg-card px-6 transition-shadow data-[state=open]:shadow-md"
              >
                <AccordionTrigger className="py-5 text-left font-semibold text-foreground hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact CTA */}
        <p
          className="mt-10 animate-fade-up text-center text-muted-foreground opacity-0"
          style={{ animationDelay: '0.4s' }}
        >
          Still have questions?{' '}
          <a href="mailto:hello@greekly.app" className="font-medium text-primary hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </section>
  );
};

export default FAQ;
