import type { ReactNode } from 'react';

import {
  BookOpen,
  CheckCircle,
  GraduationCap,
  Headphones,
  Landmark,
  Languages,
  Layers,
  Newspaper,
  Play,
  Plus,
  Tv,
  Volume2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Feature {
  icon: ReactNode;
  titleKey: string;
  descriptionKey: string;
  mockup: string;
  comingSoon: boolean;
}

const Features = () => {
  const { t } = useTranslation('landing');

  const features: Feature[] = [
    {
      icon: <GraduationCap className="h-8 w-8" />,
      titleKey: 'features.cards.basicVocabulary.title',
      descriptionKey: 'features.cards.basicVocabulary.description',
      mockup: 'basicVocabulary',
      comingSoon: false,
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      titleKey: 'features.cards.themedVocabulary.title',
      descriptionKey: 'features.cards.themedVocabulary.description',
      mockup: 'vocabulary',
      comingSoon: false,
    },
    {
      icon: <Layers className="h-8 w-8" />,
      titleKey: 'features.cards.customCards.title',
      descriptionKey: 'features.cards.customCards.description',
      mockup: 'customCards',
      comingSoon: false,
    },
    {
      icon: <Languages className="h-8 w-8" />,
      titleKey: 'features.cards.nounForms.title',
      descriptionKey: 'features.cards.nounForms.description',
      mockup: 'nounGrammar',
      comingSoon: false,
    },
    {
      icon: <Languages className="h-8 w-8" />,
      titleKey: 'features.cards.verbConjugations.title',
      descriptionKey: 'features.cards.verbConjugations.description',
      mockup: 'verbGrammar',
      comingSoon: false,
    },
    {
      icon: <Languages className="h-8 w-8" />,
      titleKey: 'features.cards.verbTenses.title',
      descriptionKey: 'features.cards.verbTenses.description',
      mockup: 'verbTenses',
      comingSoon: false,
    },
    {
      icon: <Newspaper className="h-8 w-8" />,
      titleKey: 'features.cards.realNews.title',
      descriptionKey: 'features.cards.realNews.description',
      mockup: 'news',
      comingSoon: false,
    },
    {
      icon: <Headphones className="h-8 w-8" />,
      titleKey: 'features.cards.audioDialogs.title',
      descriptionKey: 'features.cards.audioDialogs.description',
      mockup: 'audio',
      comingSoon: false,
    },
    {
      icon: <Landmark className="h-8 w-8" />,
      titleKey: 'features.cards.historyCulture.title',
      descriptionKey: 'features.cards.historyCulture.description',
      mockup: 'quiz',
      comingSoon: false,
    },
  ];

  const MockupWrapper = ({ children }: { children: ReactNode }) => (
    <div className="flex h-[360px] w-full flex-col rounded-2xl border border-border/50 bg-background p-5 shadow-lg">
      {children}
    </div>
  );

  const VocabularyMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-900">
          {t('features.mockups.finance')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('features.mockups.cardOf', { current: 8, total: 40 })}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-xl bg-secondary/50 p-6 text-center">
        <p className="mb-1 text-2xl font-bold text-foreground md:text-3xl">i eforia</p>
        <p className="text-sm text-muted-foreground">{t('features.mockups.tapToReveal')}</p>
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        <span className="rounded bg-secondary px-2 py-1 text-xs">
          {t('features.mockups.taxAuthority')}
        </span>
        <span className="rounded bg-secondary px-2 py-1 text-xs">
          {t('features.mockups.a2Level')}
        </span>
      </div>
      <div className="mt-auto flex gap-3">
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-red-100 text-sm font-semibold text-red-900"
        >
          {t('features.mockups.again')}
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          {t('features.mockups.gotIt')}
        </button>
      </div>
    </MockupWrapper>
  );

  const AudioMockup = () => (
    <MockupWrapper>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Volume2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-base font-bold text-foreground">
            {t('features.mockups.atThePharmacy')}
          </p>
          <p className="text-sm text-muted-foreground">{t('features.mockups.dialog')} - 2:34</p>
        </div>
      </div>
      <div className="flex-1 rounded-xl bg-secondary/50 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20">
            <Play className="ml-0.5 h-4 w-4 text-primary" />
          </div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/20">
            <div className="h-full w-1/3 rounded-full bg-primary" />
          </div>
          <span className="text-xs text-muted-foreground">0:48</span>
        </div>
        <p className="text-sm italic text-foreground">{t('features.mockups.pharmacyDialog')}</p>
      </div>
      <div className="mt-auto flex gap-3">
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground"
        >
          {t('features.mockups.transcript')}
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          {t('features.mockups.quizMe')}
        </button>
      </div>
    </MockupWrapper>
  );

  const QuizMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
          {t('features.mockups.history')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('features.mockups.questionOf', { current: 5, total: 20 })}
        </span>
      </div>
      <p className="mb-3 line-clamp-2 text-sm font-bold text-foreground">
        {t('features.mockups.independenceQuestion')}
      </p>
      <div className="flex-1 space-y-1.5">
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">1821</div>
        <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 p-2.5">
          <span className="text-sm font-semibold text-foreground">1832</span>
          <CheckCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">1829</div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        {t('features.mockups.nextQuestion')}
      </button>
    </MockupWrapper>
  );

  const BasicVocabularyMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800">
          {t('features.mockups.basics')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('features.mockups.cardOf', { current: 3, total: 25 })}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-xl bg-secondary/50 p-6 text-center">
        <p className="mb-1 text-3xl font-bold text-foreground md:text-4xl">kalimera</p>
        <p className="text-sm text-muted-foreground">{t('features.mockups.tapToReveal')}</p>
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        <span className="rounded bg-secondary px-2 py-1 text-xs">
          {t('features.mockups.greetings')}
        </span>
        <span className="rounded bg-secondary px-2 py-1 text-xs">
          {t('features.mockups.a1Level')}
        </span>
      </div>
      <div className="mt-auto flex gap-3">
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-red-100 text-sm font-semibold text-red-900"
        >
          {t('features.mockups.again')}
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          {t('features.mockups.gotIt')}
        </button>
      </div>
    </MockupWrapper>
  );

  const NounGrammarMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          {t('features.mockups.nouns')}
        </span>
        <span className="text-xs text-muted-foreground">{t('features.mockups.cases')}</span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">o filos</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('features.mockups.theFriendMasc')}</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.singular')}</p>
          <p className="text-sm font-medium text-foreground">o filos</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.plural')}</p>
          <p className="text-sm font-medium text-foreground">oi filoi</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.accusative')}</p>
          <p className="text-sm font-medium text-foreground">ton filo</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.genitive')}</p>
          <p className="text-sm font-medium text-foreground">tou filou</p>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        {t('features.mockups.nextNoun')}
      </button>
    </MockupWrapper>
  );

  const VerbGrammarMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-900">
          {t('features.mockups.verbs')}
        </span>
        <span className="text-xs text-muted-foreground">{t('features.mockups.present')}</span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">milao</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('features.mockups.toSpeak')}</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.iSpeak')}</p>
          <p className="text-sm font-medium text-foreground">milao</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.youSpeak')}</p>
          <p className="text-sm font-medium text-foreground">milas</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.heSheSpeak')}</p>
          <p className="text-sm font-medium text-foreground">milaei</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.weSpeak')}</p>
          <p className="text-sm font-medium text-foreground">milame</p>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        {t('features.mockups.showPastTense')}
      </button>
    </MockupWrapper>
  );

  const VerbTensesMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
          {t('features.mockups.tenses')}
        </span>
        <span className="text-xs text-muted-foreground">grafo</span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">grafo</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('features.mockups.toWrite')}</p>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">{t('features.mockups.present')}</span>
          <span className="text-sm font-medium text-foreground">grafo</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">{t('features.mockups.pastSimple')}</span>
          <span className="text-sm font-medium text-foreground">egrapsa</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">{t('features.mockups.future')}</span>
          <span className="text-sm font-medium text-foreground">tha grapso</span>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        {t('features.mockups.nextVerb')}
      </button>
    </MockupWrapper>
  );

  const NewsMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center gap-2">
        <Tv className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary">ERT News</span>
        <span className="ml-auto text-xs text-muted-foreground">{t('features.mockups.today')}</span>
      </div>
      <div className="mb-3 flex-1 rounded-xl bg-secondary/50 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">
          I kivernisi anakoinose nea metra...
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {t('features.mockups.newsHeadline')}
        </p>
      </div>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
          <Play className="ml-0.5 h-4 w-4 text-primary" />
        </div>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/20">
          <div className="h-full w-1/4 rounded-full bg-primary" />
        </div>
        <span className="text-xs text-muted-foreground">1:20</span>
      </div>
      <div className="mt-auto flex gap-3">
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground"
        >
          {t('features.mockups.readArticle')}
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          {t('features.mockups.watchClip')}
        </button>
      </div>
    </MockupWrapper>
  );

  const CustomCardsMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700">
          {t('features.mockups.myDecks')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('features.mockups.decksCount', { count: 3 })}
        </span>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('features.mockups.workVocabulary')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('features.mockups.cardsCount', { count: 24 })}
            </p>
          </div>
          <div className="text-xs font-medium text-primary">{t('features.mockups.progress80')}</div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('features.mockups.restaurantPhrases')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('features.mockups.cardsCount', { count: 15 })}
            </p>
          </div>
          <div className="text-xs font-medium text-primary">{t('features.mockups.progress65')}</div>
        </div>
        <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Plus className="h-4 w-4" />
            <span className="text-sm">{t('features.mockups.createNewDeck')}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        {t('features.mockups.addNewCard')}
      </button>
    </MockupWrapper>
  );

  const getMockup = (type: string): ReactNode => {
    switch (type) {
      case 'basicVocabulary':
        return <BasicVocabularyMockup />;
      case 'vocabulary':
        return <VocabularyMockup />;
      case 'customCards':
        return <CustomCardsMockup />;
      case 'nounGrammar':
        return <NounGrammarMockup />;
      case 'verbGrammar':
        return <VerbGrammarMockup />;
      case 'verbTenses':
        return <VerbTensesMockup />;
      case 'news':
        return <NewsMockup />;
      case 'audio':
        return <AudioMockup />;
      case 'quiz':
        return <QuizMockup />;
      default:
        return null;
    }
  };

  return (
    <section
      data-testid="features-section"
      id="features"
      className="bg-secondary/20 py-12 md:py-16"
    >
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="mb-3 text-sm font-medium text-primary motion-safe:animate-fade-up">
            {t('features.label')}
          </p>
          <h2
            className="mb-3 text-2xl font-bold motion-safe:animate-fade-up md:text-4xl"
            style={{ animationDelay: '0.1s' }}
          >
            {t('features.title')}
          </h2>
          <p
            className="text-lg text-muted-foreground motion-safe:animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            {t('features.subtitle')}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col" data-testid="feature-card">
              {/* Feature content */}
              <div className="mb-4 h-[160px]">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <h3 className="mb-2 line-clamp-2 text-xl font-bold text-foreground">
                  {t(feature.titleKey)}
                </h3>
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {t(feature.descriptionKey)}
                </p>
              </div>

              {/* Mockup */}
              <div className="flex-1">{getMockup(feature.mockup)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
