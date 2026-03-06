import type { ChipColor } from '@/lib/completeness';
import type { AdminCultureQuestion } from '@/services/adminAPI';

export interface CultureChipData {
  name: string;
  label: string;
  color: ChipColor;
  tooltip: string;
  visible: boolean;
}

function getTranslationFields(
  question: AdminCultureQuestion,
  lang: string
): { key: string; present: boolean }[] {
  const fields: { key: string; present: boolean }[] = [
    { key: 'Question', present: !!question.question_text[lang] },
    { key: 'Option A', present: !!question.option_a[lang] },
    { key: 'Option B', present: !!question.option_b[lang] },
  ];
  if (question.option_c !== null) {
    fields.push({ key: 'Option C', present: !!question.option_c[lang] });
  }
  if (question.option_d !== null) {
    fields.push({ key: 'Option D', present: !!question.option_d[lang] });
  }
  return fields;
}

function translationColor(fields: { present: boolean }[]): ChipColor {
  const presentCount = fields.filter((f) => f.present).length;
  if (presentCount === 0) return 'gray';
  if (presentCount === fields.length) return 'green';
  return 'yellow';
}

export function isTranslationComplete(question: AdminCultureQuestion): boolean {
  const langs = ['el', 'en', 'ru'];
  return langs.every((lang) => {
    const fields = getTranslationFields(question, lang);
    return fields.every((f) => f.present);
  });
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function computeCultureChips(question: AdminCultureQuestion): CultureChipData[] {
  const chips: CultureChipData[] = [];

  // Translation chips: EL, EN, RU
  for (const [lang, label] of [
    ['el', 'EL'],
    ['en', 'EN'],
    ['ru', 'RU'],
  ] as [string, string][]) {
    const fields = getTranslationFields(question, lang);
    const color = translationColor(fields);
    const tooltipLines = fields
      .map((f) => `${f.key}: ${f.present ? 'present' : 'missing'}`)
      .join(', ');
    chips.push({
      name: `lang-${lang}`,
      label,
      color,
      tooltip: tooltipLines,
      visible: true,
    });
  }

  // Option count chip
  const optCount = 2 + (question.option_c !== null ? 1 : 0) + (question.option_d !== null ? 1 : 0);
  const optColor: ChipColor = optCount === 4 ? 'green' : optCount === 3 ? 'yellow' : 'gray';
  chips.push({
    name: 'opts',
    label: `Opts ${optCount}`,
    color: optColor,
    tooltip: `${optCount} answer options available`,
    visible: true,
  });

  // Audio chips
  if (question.news_item_id !== null) {
    // News question: B2 + A2
    chips.push({
      name: 'audio-b2',
      label: 'B2 Audio',
      color: question.audio_s3_key ? 'green' : 'gray',
      tooltip: question.audio_s3_key ? 'B2 audio present' : 'B2 audio missing',
      visible: true,
    });
    chips.push({
      name: 'audio-a2',
      label: 'A2 Audio',
      color: question.news_item_audio_a2_s3_key ? 'green' : 'gray',
      tooltip: question.news_item_audio_a2_s3_key ? 'A2 audio present' : 'A2 audio missing',
      visible: true,
    });
  } else {
    // Exam question: single audio
    chips.push({
      name: 'audio',
      label: 'Audio',
      color: question.audio_s3_key ? 'green' : 'gray',
      tooltip: question.audio_s3_key ? 'Audio present' : 'Audio missing',
      visible: true,
    });
  }

  // News badge
  chips.push({
    name: 'news',
    label: 'News',
    color: 'green',
    tooltip: question.original_article_url
      ? `Source: ${extractDomain(question.original_article_url)}`
      : '',
    visible: !!question.original_article_url,
  });

  return chips;
}
