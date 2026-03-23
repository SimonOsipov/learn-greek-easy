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

import { Button } from '@/components/ui/button';
import { getCEFRColor, getCEFRTextColor } from '@/lib/cefrColors';

interface Feature {
  icon: ReactNode;
  titleKey: string;
  descriptionKey: string;
  mockup: string;
}

const MOCKUP_BADGE = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  blue: 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-100',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-100',
  orange: 'bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100',
  red: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100',
} as const;

const Features = () => {
  const { t } = useTranslation('landing');

  const features: Feature[] = [
    {
      icon: <GraduationCap className="h-8 w-8" />,
      titleKey: 'features.cards.basicVocabulary.title',
      descriptionKey: 'features.cards.basicVocabulary.description',
      mockup: 'basicVocabulary',
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      titleKey: 'features.cards.themedVocabulary.title',
      descriptionKey: 'features.cards.themedVocabulary.description',
      mockup: 'vocabulary',
    },
    {
      icon: <Layers className="h-8 w-8" />,
      titleKey: 'features.cards.customCards.title',
      descriptionKey: 'features.cards.customCards.description',
      mockup: 'customCards',
    },
    {
      icon: <Languages className="h-8 w-8" />,
      titleKey: 'features.cards.nounForms.title',
      descriptionKey: 'features.cards.nounForms.description',
      mockup: 'nounGrammar',
    },
    {
      icon: <Languages className="h-8 w-8" />,
      titleKey: 'features.cards.verbConjugations.title',
      descriptionKey: 'features.cards.verbConjugations.description',
      mockup: 'verbGrammar',
    },
    {
      icon: <Languages className="h-8 w-8" />,
      titleKey: 'features.cards.verbTenses.title',
      descriptionKey: 'features.cards.verbTenses.description',
      mockup: 'verbTenses',
    },
    {
      icon: <Newspaper className="h-8 w-8" />,
      titleKey: 'features.cards.realNews.title',
      descriptionKey: 'features.cards.realNews.description',
      mockup: 'news',
    },
    {
      icon: <Headphones className="h-8 w-8" />,
      titleKey: 'features.cards.audioDialogs.title',
      descriptionKey: 'features.cards.audioDialogs.description',
      mockup: 'audio',
    },
    {
      icon: <Headphones className="h-8 w-8" />,
      titleKey: 'features.cards.listeningExercises.title',
      descriptionKey: 'features.cards.listeningExercises.description',
      mockup: 'listeningExercises',
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      titleKey: 'features.cards.readingComprehension.title',
      descriptionKey: 'features.cards.readingComprehension.description',
      mockup: 'readingComprehension',
    },
    {
      icon: <Landmark className="h-8 w-8" />,
      titleKey: 'features.cards.historyCulture.title',
      descriptionKey: 'features.cards.historyCulture.description',
      mockup: 'quiz',
    },
  ];

  const MockupWrapper = ({ children }: { children: ReactNode }) => (
    /* h-[360px]: fixed height ensures uniform card sizing across the 3-column grid */
    <div
      aria-hidden="true"
      className="flex h-[360px] w-full flex-col rounded-2xl border border-border/50 bg-background p-5 shadow-lg"
    >
      {children}
    </div>
  );

  const VocabularyMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${MOCKUP_BADGE.blue}`}>
          {t('features.mockups.finance')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">
          {t('features.mockups.cardOf', { current: 8, total: 40 })}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-xl bg-secondary/50 p-6 text-center">
        <p className="mb-1 text-2xl font-bold text-foreground md:text-3xl">η εφορία</p>
        <p className="text-sm text-muted-foreground">{t('features.mockups.tapToReveal')}</p>
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        <span className="rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground">
          {t('features.mockups.taxAuthority')}
        </span>
        <span
          className={`rounded px-2 py-1 text-xs font-semibold ${getCEFRColor('A2')} ${getCEFRTextColor('A2')}`}
        >
          A2
        </span>
      </div>
      <div className="mt-auto flex gap-3">
        <Button
          variant="secondary"
          tabIndex={-1}
          className={`h-11 flex-1 rounded-lg font-semibold ${MOCKUP_BADGE.red}`}
        >
          {t('features.mockups.again')}
        </Button>
        <Button tabIndex={-1} className="h-11 flex-1 rounded-lg font-semibold">
          {t('features.mockups.gotIt')}
        </Button>
      </div>
    </MockupWrapper>
  );

  const AudioMockup = () => (
    <MockupWrapper>
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Volume2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Στο Φαρμακείο</p>
          <p className="text-xs text-muted-foreground">{t('features.mockups.dialog')} - 2:34</p>
        </div>
      </div>
      {/* Dialog bubbles */}
      <div className="mb-3 flex-1 space-y-2 overflow-hidden">
        {/* Speaker A - left */}
        <div className="mr-8">
          <div className="rounded-2xl rounded-tl-sm bg-secondary/60 px-3 py-2">
            <p className="text-xs text-foreground">Καλημέρα, θέλω κάτι για τον πονοκέφαλο.</p>
          </div>
        </div>
        {/* Speaker B - right, with karaoke highlight */}
        <div className="ml-8">
          <div className="rounded-2xl rounded-tr-sm bg-primary/10 px-3 py-2">
            <p className="text-xs text-foreground">
              Βεβαίως, πόσο{' '}
              <span className="rounded bg-primary/25 px-0.5 font-semibold text-primary">συχνά</span>{' '}
              έχετε πονοκέφαλο;
            </p>
          </div>
        </div>
        {/* Speaker A - left */}
        <div className="mr-8">
          <div className="rounded-2xl rounded-tl-sm bg-secondary/60 px-3 py-2">
            <p className="text-xs text-foreground">Σχεδόν κάθε μέρα αυτή την εβδομάδα.</p>
          </div>
        </div>
        {/* Speaker B - right */}
        <div className="ml-8">
          <div className="rounded-2xl rounded-tr-sm bg-primary/10 px-3 py-2">
            <p className="text-xs text-foreground">Θα σας δώσω παρακεταμόλη.</p>
          </div>
        </div>
      </div>
      {/* Audio player */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20">
          <Play className="ml-0.5 h-4 w-4 text-primary" />
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/20">
          <div className="h-full w-1/3 rounded-full bg-primary" />
        </div>
        <span className="text-xs text-muted-foreground">0:48</span>
      </div>
      {/* Buttons */}
      <div className="mt-auto flex gap-3">
        <Button variant="outline" tabIndex={-1} className="h-11 flex-1 rounded-lg font-semibold">
          {t('features.mockups.transcript')}
        </Button>
        <Button tabIndex={-1} className="h-11 flex-1 rounded-lg font-semibold">
          {t('features.mockups.quizMe')}
        </Button>
      </div>
    </MockupWrapper>
  );

  const ListeningExercisesMockup = () => (
    <MockupWrapper>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${MOCKUP_BADGE.blue}`}>
          {t('features.mockups.listening')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">
          {t('features.mockups.exerciseOf', { current: 3, total: 8 })}
        </span>
      </div>
      {/* Audio player bar */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20">
          <Volume2 className="h-4 w-4 text-primary" />
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/20">
          <div className="h-full w-2/3 rounded-full bg-primary" />
        </div>
        <span className="text-xs text-muted-foreground">0:12</span>
      </div>
      {/* Prompt */}
      <p className="mb-2 text-sm font-medium text-foreground">Συμπληρώστε τη λέξη:</p>
      <p className="mb-3 text-sm italic text-muted-foreground">
        &quot;Θέλω ένα _____ παρακαλώ&quot;
      </p>
      {/* Answer grid */}
      <div className="mb-3 grid flex-1 grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 p-2.5">
          <span className="text-sm font-semibold text-foreground">καφέ</span>
          <CheckCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">νερό</div>
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">ψωμί</div>
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">τσάι</div>
      </div>
      {/* CTA */}
      <Button tabIndex={-1} className="mt-auto h-11 w-full rounded-lg font-semibold">
        {t('features.mockups.checkAnswer')}
      </Button>
    </MockupWrapper>
  );

  const ReadingComprehensionMockup = () => (
    <MockupWrapper>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${MOCKUP_BADGE.green}`}>
          {t('features.mockups.reading')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">
          {t('features.mockups.storyOf', { current: 2, total: 6 })}
        </span>
      </div>
      {/* Story title + level */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-base font-bold text-foreground">Στο Ταχυδρομείο</p>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${getCEFRColor('B1')} ${getCEFRTextColor('B1')}`}
        >
          B1
        </span>
      </div>
      {/* Story excerpt */}
      <div className="mb-2 rounded-xl bg-secondary/50 p-3">
        <p className="line-clamp-2 text-sm italic text-foreground">
          &quot;Ο Γιάννης πήγε στο ταχυδρομείο για να στείλει ένα δέμα στην Ελλάδα...&quot;
        </p>
      </div>
      {/* Question + answers (all Greek) */}
      <p className="mb-2 text-sm font-medium text-foreground">Πού πήγε ο Γιάννης;</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">
          Στην τράπεζα
        </div>
        <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 p-2.5">
          <span className="text-sm font-semibold text-foreground">Στο ταχυδρομείο</span>
          <CheckCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">
          Στο νοσοκομείο
        </div>
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">
          Στο σχολείο
        </div>
      </div>
      {/* CTA in Greek */}
      <Button tabIndex={-1} className="mt-auto h-11 w-full rounded-lg font-semibold">
        Επόμενη Ερώτηση
      </Button>
    </MockupWrapper>
  );

  const QuizMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${MOCKUP_BADGE.blue}`}>
          {t('features.mockups.history')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">
          {t('features.mockups.questionOf', { current: 5, total: 20 })}
        </span>
      </div>
      <p className="mb-3 text-sm font-bold text-foreground">Πότε η Κύπρος έγινε ανεξάρτητη;</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">1821</div>
        <div className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 p-2.5">
          <span className="text-sm font-semibold text-foreground">1832</span>
          <CheckCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">1829</div>
        <div className="rounded-lg border border-border p-2.5 text-sm text-foreground">1878</div>
      </div>
      <Button tabIndex={-1} className="mt-auto h-11 w-full rounded-lg font-semibold">
        {t('features.mockups.nextQuestion')}
      </Button>
    </MockupWrapper>
  );

  const BasicVocabularyMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${MOCKUP_BADGE.green}`}>
          {t('features.mockups.basics')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">
          {t('features.mockups.cardOf', { current: 3, total: 25 })}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center rounded-xl bg-secondary/50 p-6 text-center">
        <p className="mb-1 text-3xl font-bold text-foreground md:text-4xl">καλημέρα</p>
        <p className="text-sm text-muted-foreground">{t('features.mockups.tapToReveal')}</p>
      </div>
      <div className="my-3 flex flex-wrap gap-2">
        <span className="rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground">
          {t('features.mockups.greetings')}
        </span>
        <span
          className={`rounded px-2 py-1 text-xs font-semibold ${getCEFRColor('A1')} ${getCEFRTextColor('A1')}`}
        >
          A1
        </span>
      </div>
      <div className="mt-auto flex gap-3">
        <Button
          variant="secondary"
          tabIndex={-1}
          className={`h-11 flex-1 rounded-lg font-semibold ${MOCKUP_BADGE.red}`}
        >
          {t('features.mockups.again')}
        </Button>
        <Button tabIndex={-1} className="h-11 flex-1 rounded-lg font-semibold">
          {t('features.mockups.gotIt')}
        </Button>
      </div>
    </MockupWrapper>
  );

  const NounGrammarMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${MOCKUP_BADGE.purple}`}>
          {t('features.mockups.nouns')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">
          {t('features.mockups.cases')}
        </span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">ο φίλος</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('features.mockups.theFriendMasc')}</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.singular')}</p>
          <p className="text-sm font-medium text-foreground">ο φίλος</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.plural')}</p>
          <p className="text-sm font-medium text-foreground">οι φίλοι</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.accusative')}</p>
          <p className="text-sm font-medium text-foreground">τον φίλο</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.genitive')}</p>
          <p className="text-sm font-medium text-foreground">του φίλου</p>
        </div>
      </div>
      <Button tabIndex={-1} className="mt-auto h-11 w-full rounded-lg font-semibold">
        {t('features.mockups.nextNoun')}
      </Button>
    </MockupWrapper>
  );

  const VerbGrammarMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${MOCKUP_BADGE.orange}`}>
          {t('features.mockups.verbs')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">
          {t('features.mockups.present')}
        </span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">μιλάω</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('features.mockups.toSpeak')}</p>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.iSpeak')}</p>
          <p className="text-sm font-medium text-foreground">μιλάω</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.youSpeak')}</p>
          <p className="text-sm font-medium text-foreground">μιλάς</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.heSheSpeak')}</p>
          <p className="text-sm font-medium text-foreground">μιλάει</p>
        </div>
        <div className="rounded-lg bg-secondary/30 p-2 text-center">
          <p className="text-xs text-muted-foreground">{t('features.mockups.weSpeak')}</p>
          <p className="text-sm font-medium text-foreground">μιλάμε</p>
        </div>
      </div>
      <Button tabIndex={-1} className="mt-auto h-11 w-full rounded-lg font-semibold">
        {t('features.mockups.showPastTense')}
      </Button>
    </MockupWrapper>
  );

  const VerbTensesMockup = () => (
    <MockupWrapper>
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${MOCKUP_BADGE.teal}`}>
          {t('features.mockups.tenses')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">γράφω</span>
      </div>
      <div className="mb-3 rounded-xl bg-secondary/50 p-4 text-center">
        <p className="text-2xl font-bold text-foreground">γράφω</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('features.mockups.toWrite')}</p>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">{t('features.mockups.present')}</span>
          <span className="text-sm font-medium text-foreground">γράφω</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">{t('features.mockups.pastSimple')}</span>
          <span className="text-sm font-medium text-foreground">έγραψα</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
          <span className="text-xs text-muted-foreground">{t('features.mockups.future')}</span>
          <span className="text-sm font-medium text-foreground">θα γράψω</span>
        </div>
      </div>
      <Button tabIndex={-1} className="mt-auto h-11 w-full rounded-lg font-semibold">
        {t('features.mockups.nextVerb')}
      </Button>
    </MockupWrapper>
  );

  const NewsMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center gap-2">
        <Tv className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary">ERT News</span>
        <span className="ml-auto text-xs text-muted-foreground dark:text-foreground/70">
          {t('features.mockups.today')}
        </span>
      </div>
      <div className="mb-3 flex-1 rounded-xl bg-secondary/50 p-4">
        <p className="line-clamp-5 text-sm text-foreground">
          Η κυβέρνηση ανακοίνωσε νέα μέτρα για την ενίσχυση της οικονομίας, με έμφαση στη στήριξη
          των μικρών επιχειρήσεων. Οι αλλαγές περιλαμβάνουν μείωση φόρων και νέα προγράμματα
          επιδοτήσεων. Ο πρωθυπουργός δήλωσε ότι στόχος είναι η δημιουργία νέων θέσεων εργασίας.
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
        <Button variant="outline" tabIndex={-1} className="h-11 flex-1 rounded-lg font-semibold">
          {t('features.mockups.readArticle')}
        </Button>
        <Button tabIndex={-1} className="h-11 flex-1 rounded-lg font-semibold">
          {t('features.mockups.watchClip')}
        </Button>
      </div>
    </MockupWrapper>
  );

  const CustomCardsMockup = () => (
    <MockupWrapper>
      <div className="mb-4 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${MOCKUP_BADGE.indigo}`}>
          {t('features.mockups.myDecks')}
        </span>
        <span className="text-xs text-muted-foreground dark:text-foreground/70">
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
          <div className="text-xs font-medium text-primary">80%</div>
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
          <div className="text-xs font-medium text-primary">65%</div>
        </div>
        <div className="flex items-center justify-between rounded-lg border-2 border-dashed border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground dark:text-foreground">
            <Plus className="h-4 w-4" />
            <span className="text-sm">{t('features.mockups.createNewDeck')}</span>
          </div>
        </div>
      </div>
      <Button tabIndex={-1} className="mt-auto h-11 w-full rounded-lg font-semibold">
        {t('features.mockups.addNewCard')}
      </Button>
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
      case 'listeningExercises':
        return <ListeningExercisesMockup />;
      case 'readingComprehension':
        return <ReadingComprehensionMockup />;
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
            className="mb-3 text-2xl font-bold text-foreground motion-safe:animate-fade-up md:text-4xl"
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
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col" data-testid="feature-card">
              {/* Feature content */}
              <div className="mb-4 min-h-40">
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
