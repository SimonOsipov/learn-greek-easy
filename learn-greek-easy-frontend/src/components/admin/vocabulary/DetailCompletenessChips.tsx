import React from 'react';

import { computeChipsFromCard, chipColorClasses } from '@/lib/completeness';
import type { ChipData } from '@/lib/completeness';
import type { AdminVocabularyCard } from '@/services/adminAPI';

interface DetailCompletenessChipsProps {
  card: AdminVocabularyCard;
  onEnsureEntryTab: () => void;
  activeTab: string;
}

const SECTION_IDS: Record<ChipData['name'], string> = {
  en: 'section-en',
  ru: 'section-ru',
  pron: 'section-pron',
  audio: 'section-pron',
  gram: 'section-gram',
  ex: 'section-ex',
};

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function DetailCompletenessChips({
  card,
  onEnsureEntryTab,
  activeTab,
}: DetailCompletenessChipsProps) {
  const chips = computeChipsFromCard(card).filter((c) => c.visible);

  function handleChipClick(name: ChipData['name']) {
    const sectionId = SECTION_IDS[name];
    if (activeTab !== 'entry') {
      onEnsureEntryTab();
      setTimeout(() => scrollToSection(sectionId), 100);
    } else {
      scrollToSection(sectionId);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <button
          key={chip.name}
          type="button"
          title={chip.tooltip}
          onClick={() => handleChipClick(chip.name)}
          className={`inline-flex cursor-pointer items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${chipColorClasses[chip.color]}`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
