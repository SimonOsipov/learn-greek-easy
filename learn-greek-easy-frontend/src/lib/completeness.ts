import type { AdminVocabularyCard } from '@/services/adminAPI';

export type ChipColor = 'green' | 'yellow' | 'gray';

export interface ChipData {
  name: 'en' | 'ru' | 'pron' | 'audio' | 'gram' | 'ex';
  label: string;
  color: ChipColor;
  tooltip: string;
  ratio: number; // 0.0-1.0 for completion calc
  visible: boolean; // false for grammar when grammar_total=0
}

export const chipColorClasses: Record<ChipColor, string> = {
  green:
    'border-green-600/50 bg-green-50 text-green-700 dark:border-green-500/50 dark:bg-green-950/30 dark:text-green-400',
  yellow:
    'border-yellow-600/50 bg-yellow-50 text-yellow-700 dark:border-yellow-500/50 dark:bg-yellow-950/30 dark:text-yellow-400',
  gray: 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
};

export function computeChipsFromCard(card: AdminVocabularyCard): ChipData[] {
  // EN chip: back_text_en (singular) + translation_en_plural
  const enCount = (card.back_text_en ? 1 : 0) + (card.translation_en_plural ? 1 : 0);
  const enColor: ChipColor = enCount === 2 ? 'green' : 'yellow'; // never gray per AC
  const enRatio = enCount / 2;

  // RU chip: back_text_ru + translation_ru_plural
  const ruCount = (card.back_text_ru ? 1 : 0) + (card.translation_ru_plural ? 1 : 0);
  const ruColor: ChipColor = ruCount === 2 ? 'green' : ruCount === 1 ? 'yellow' : 'gray';
  const ruRatio = ruCount / 2;

  // Pronunciation chip
  const hasPron = Boolean(card.pronunciation);
  const pronColor: ChipColor = hasPron ? 'green' : 'gray';
  const pronRatio = hasPron ? 1 : 0;

  // Audio chip
  let audioColor: ChipColor = 'gray';
  let audioLabel = 'Audio ✗';
  let audioRatio = 0;
  if (card.audio_status === 'ready') {
    audioColor = 'green';
    audioLabel = 'Audio ✓';
    audioRatio = 1;
  } else if (card.audio_status === 'generating') {
    audioColor = 'yellow';
    audioLabel = 'Audio …';
    audioRatio = 0.5;
  }

  // Grammar chip (only when grammar_total > 0)
  const gramTotal = card.grammar_total ?? 0;
  const gramFilled = card.grammar_filled ?? 0;
  let gramColor: ChipColor = 'gray';
  const gramRatio = gramTotal > 0 ? gramFilled / gramTotal : 1;
  if (gramTotal > 0) {
    if (gramFilled === gramTotal) gramColor = 'green';
    else if (gramFilled > 0) gramColor = 'yellow';
  }

  // Example chip
  const exCount = card.example_count ?? 0;
  const exWithEn = card.examples_with_en ?? 0;
  const exWithRu = card.examples_with_ru ?? 0;
  const exWithAudio = card.examples_with_audio ?? 0;
  let exColor: ChipColor = 'gray';
  let exRatio = 0;
  if (exCount > 0) {
    exRatio = (exWithEn / exCount + exWithRu / exCount + exWithAudio / exCount) / 3;
    const allHaveEn = exWithEn === exCount;
    const allHaveRu = exWithRu === exCount;
    const allHaveAudio = exWithAudio === exCount;
    exColor = allHaveEn && allHaveRu && allHaveAudio ? 'green' : 'yellow';
  }

  return [
    {
      name: 'en',
      label: `EN ${enCount}/2`,
      color: enColor,
      tooltip: `English: singular (${card.back_text_en ? 'present' : 'missing'}), plural (${card.translation_en_plural ? 'present' : 'missing'})`,
      ratio: enRatio,
      visible: true,
    },
    {
      name: 'ru',
      label: `RU ${ruCount}/2`,
      color: ruColor,
      tooltip: `Russian: singular (${card.back_text_ru ? 'present' : 'missing'}), plural (${card.translation_ru_plural ? 'present' : 'missing'})`,
      ratio: ruRatio,
      visible: true,
    },
    {
      name: 'pron',
      label: hasPron ? 'Pron ✓' : 'Pron ✗',
      color: pronColor,
      tooltip: hasPron ? `Pronunciation: ${card.pronunciation}` : 'Pronunciation: missing',
      ratio: pronRatio,
      visible: true,
    },
    {
      name: 'audio',
      label: audioLabel,
      color: audioColor,
      tooltip: `Audio: ${card.audio_status}`,
      ratio: audioRatio,
      visible: true,
    },
    {
      name: 'gram',
      label: `Gram ${gramFilled}/${gramTotal}`,
      color: gramColor,
      tooltip: `Grammar: ${gramFilled} of ${gramTotal} fields filled`,
      ratio: gramRatio,
      visible: gramTotal > 0,
    },
    {
      name: 'ex',
      label: `Ex ${exCount}`,
      color: exColor,
      tooltip: `Examples: ${exCount} total, ${exWithEn} with EN, ${exWithRu} with RU, ${exWithAudio} with audio`,
      ratio: exRatio,
      visible: true,
    },
  ];
}

export function computeCompletionPercentage(card: AdminVocabularyCard): number {
  const chips = computeChipsFromCard(card);
  const sum = chips.reduce((acc, chip) => acc + chip.ratio, 0);
  return Math.round((sum / chips.length) * 100);
}
