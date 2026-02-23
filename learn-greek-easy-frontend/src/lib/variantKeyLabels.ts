interface Rule {
  test: (key: string) => boolean;
  label: string;
}

const RULES: Rule[] = [
  { test: (k) => k === 'default', label: 'Default' },
  { test: (k) => k === 'sg_to_pl', label: 'Singular → Plural' },
  { test: (k) => k === 'sg_to_pl_masculine', label: 'Singular → Plural (Masc.)' },
  { test: (k) => k === 'sg_to_pl_feminine', label: 'Singular → Plural (Fem.)' },
  { test: (k) => k === 'sg_to_pl_neuter', label: 'Singular → Plural (Neut.)' },
  { test: (k) => k === 'pl_to_sg', label: 'Plural → Singular' },
  { test: (k) => k === 'pl_to_sg_masculine', label: 'Plural → Singular (Masc.)' },
  { test: (k) => k === 'pl_to_sg_feminine', label: 'Plural → Singular (Fem.)' },
  { test: (k) => k === 'pl_to_sg_neuter', label: 'Plural → Singular (Neut.)' },
  { test: (k) => k.startsWith('el_to_target_'), label: 'Greek → Translation' },
  { test: (k) => k.startsWith('target_to_el_'), label: 'Translation → Greek' },
  { test: (k) => k.startsWith('conjugation_'), label: 'Conjugation' },
  { test: (k) => k.startsWith('declension_'), label: 'Declension' },
  { test: (k) => k.startsWith('grammar_'), label: 'Grammar Form' },
];

function formatFallback(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getVariantKeyLabel(key: string): string {
  const rule = RULES.find((r) => r.test(key));
  return rule ? rule.label : formatFallback(key);
}
