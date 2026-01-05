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

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
  mockup: string;
  comingSoon: boolean;
}

const Features = () => {
  const features: Feature[] = [
    {
      icon: <GraduationCap className="h-8 w-8" />,
      title: 'Basic Vocabulary Cards',
      description:
        'Start with essential Greek words and phrases. Build your foundation with everyday vocabulary from greetings to numbers.',
      mockup: 'basicVocabulary',
      comingSoon: false,
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: 'Themed Vocabulary Cards',
      description:
        'From A2 foundations to specialized topics - master words for real estate, medical visits, banking, and everyday conversations.',
      mockup: 'vocabulary',
      comingSoon: false,
    },
    {
      icon: <Layers className="h-8 w-8" />,
      title: 'Custom Cards & Decks',
      description:
        'Create your own flashcards and organize them into custom decks. Learn the words that matter most to you.',
      mockup: 'customCards',
      comingSoon: false,
    },
    {
      icon: <Languages className="h-8 w-8" />,
      title: 'Noun Forms & Cases',
      description:
        'Master articles, plural/singular forms, and noun cases like accusative and genitive - essential for speaking correctly.',
      mockup: 'nounGrammar',
      comingSoon: false,
    },
    {
      icon: <Languages className="h-8 w-8" />,
      title: 'Verb Conjugations',
      description:
        'Practice verb forms across tenses and persons. From present to past, master how Greek verbs change.',
      mockup: 'verbGrammar',
      comingSoon: false,
    },
    {
      icon: <Languages className="h-8 w-8" />,
      title: 'Verb Tenses',
      description:
        'Learn past, present, and future forms of verbs. See how the same verb changes across different time contexts.',
      mockup: 'verbTenses',
      comingSoon: false,
    },
    {
      icon: <Newspaper className="h-8 w-8" />,
      title: 'Real News Practice',
      description:
        'Learn from actual Greek TV broadcasts and newspaper articles. Immerse yourself in authentic content to sharpen comprehension.',
      mockup: 'news',
      comingSoon: false,
    },
    {
      icon: <Headphones className="h-8 w-8" />,
      title: 'Real Audio Dialogs',
      description:
        'Practice with authentic conversations - ordering coffee, visiting the doctor, talking to your landlord. No synthetic textbook scripts.',
      mockup: 'audio',
      comingSoon: false,
    },
    {
      icon: <Landmark className="h-8 w-8" />,
      title: 'History & Culture Questions',
      description:
        'Prepare for the citizenship exam history and culture section with curated questions about Greek heritage and traditions.',
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
        <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-600">
          Finance
        </span>
        <span className="text-xs text-muted-foreground">Card 8 of 40</span>
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-xl bg-secondary/50 p-6 text-center">
        <p className="mb-1 text-2xl font-bold text-foreground md:text-3xl">i eforia</p>
        <p className="text-sm text-muted-foreground">tap to reveal</p>
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        <span className="rounded bg-secondary px-2 py-1 text-xs">Tax Authority</span>
        <span className="rounded bg-secondary px-2 py-1 text-xs">A2 Level</span>
      </div>
      <div className="mt-auto flex gap-3">
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-destructive/10 text-sm font-semibold text-destructive"
        >
          Again
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          Got it!
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
          <p className="text-base font-bold text-foreground">At the Pharmacy</p>
          <p className="text-sm text-muted-foreground">Dialog - 2:34</p>
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
        <p className="text-sm italic text-foreground">
          &quot;Kalimera, thelo kati gia ton ponokefalo...&quot;
        </p>
      </div>
      <div className="mt-auto flex gap-3">
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground"
        >
          Transcript
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          Quiz Me
        </button>
      </div>
    </MockupWrapper>
  );

  const QuizMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          History
        </span>
        <span className="text-xs text-muted-foreground">Question 5/20</span>
      </div>
      <p className="mb-3 line-clamp-2 text-sm font-bold text-foreground">
        When did Greece gain independence from the Ottoman Empire?
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
        Next Question
      </button>
    </MockupWrapper>
  );

  const BasicVocabularyMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-600">
          Basics
        </span>
        <span className="text-xs text-muted-foreground">Card 3 of 25</span>
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-xl bg-secondary/50 p-6 text-center">
        <p className="mb-1 text-3xl font-bold text-foreground md:text-4xl">kalimera</p>
        <p className="text-sm text-muted-foreground">tap to reveal</p>
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        <span className="rounded bg-secondary px-2 py-1 text-xs">Greetings</span>
        <span className="rounded bg-secondary px-2 py-1 text-xs">A1 Level</span>
      </div>
      <div className="mt-auto flex gap-3">
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-destructive/10 text-sm font-semibold text-destructive"
        >
          Again
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          Got it!
        </button>
      </div>
    </MockupWrapper>
  );

  const NounGrammarMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-600">
          Nouns
        </span>
        <span className="text-xs text-muted-foreground">Cases</span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">o filos</p>
        <p className="mt-1 text-xs text-muted-foreground">the friend (masc.)</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">Singular</p>
          <p className="text-sm font-medium text-foreground">o filos</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">Plural</p>
          <p className="text-sm font-medium text-foreground">oi filoi</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">Accusative</p>
          <p className="text-sm font-medium text-foreground">ton filo</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">Genitive</p>
          <p className="text-sm font-medium text-foreground">tou filou</p>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        Next Noun
      </button>
    </MockupWrapper>
  );

  const VerbGrammarMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-600">
          Verbs
        </span>
        <span className="text-xs text-muted-foreground">Present</span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">milao</p>
        <p className="mt-1 text-xs text-muted-foreground">to speak</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">I speak</p>
          <p className="text-sm font-medium text-foreground">milao</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">you speak</p>
          <p className="text-sm font-medium text-foreground">milas</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">he/she speaks</p>
          <p className="text-sm font-medium text-foreground">milaei</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">we speak</p>
          <p className="text-sm font-medium text-foreground">milame</p>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        Show Past Tense
      </button>
    </MockupWrapper>
  );

  const VerbTensesMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-600">
          Tenses
        </span>
        <span className="text-xs text-muted-foreground">grafo</span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">grafo</p>
        <p className="mt-1 text-xs text-muted-foreground">to write</p>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">Present</span>
          <span className="text-sm font-medium text-foreground">grafo</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">Past (simple)</span>
          <span className="text-sm font-medium text-foreground">egrapsa</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">Future</span>
          <span className="text-sm font-medium text-foreground">tha grapso</span>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        Next Verb
      </button>
    </MockupWrapper>
  );

  const NewsMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center gap-2">
        <Tv className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary">ERT News</span>
        <span className="ml-auto text-xs text-muted-foreground">Today</span>
      </div>
      <div className="mb-3 flex-1 rounded-xl bg-secondary/50 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">
          I kivernisi anakoinose nea metra...
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          The government announced new measures for the economy, focusing on support for small
          businesses.
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
          Read Article
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
        >
          Watch Clip
        </button>
      </div>
    </MockupWrapper>
  );

  const CustomCardsMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-600">
          My Decks
        </span>
        <span className="text-xs text-muted-foreground">3 decks</span>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Work Vocabulary</p>
            <p className="text-xs text-muted-foreground">24 cards</p>
          </div>
          <div className="text-xs font-medium text-primary">80%</div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Restaurant Phrases</p>
            <p className="text-xs text-muted-foreground">15 cards</p>
          </div>
          <div className="text-xs font-medium text-primary">65%</div>
        </div>
        <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Plus className="h-4 w-4" />
            <span className="text-sm">Create new deck</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="mt-auto flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
      >
        Add New Card
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
          <p className="mb-3 animate-fade-up text-sm font-medium text-primary opacity-0">
            DESIGNED FOR SUCCESS
          </p>
          <h2
            className="mb-3 animate-fade-up text-2xl font-bold opacity-0 md:text-4xl"
            style={{ animationDelay: '0.1s' }}
          >
            Everything you need to pass
          </h2>
          <p
            className="animate-fade-up text-lg text-muted-foreground opacity-0"
            style={{ animationDelay: '0.2s' }}
          >
            A complete toolkit built specifically for Greek citizenship exam preparation
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col">
              {/* Feature content */}
              <div className="mb-4 h-[160px]">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <h3 className="mb-2 line-clamp-2 text-xl font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
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
