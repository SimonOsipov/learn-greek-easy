import type { CategoryReadiness } from '@/services/cultureDeckAPI';

export interface WeakestCategoryResult {
  category: CategoryReadiness;
  wasTieBroken: boolean;
}

export function getWeakestCategory(categories: CategoryReadiness[]): WeakestCategoryResult | null {
  if (categories.length === 0) return null;

  const lowestPct = Math.min(...categories.map((c) => c.readiness_percentage));
  const tied = categories.filter((c) => c.readiness_percentage === lowestPct);

  if (tied.length === 1) {
    return { category: tied[0], wasTieBroken: false };
  }

  // Tie-break: most NEW questions first (questions_total - questions_mastered)
  // Secondary: alphabetical by category name
  const sorted = [...tied].sort((a, b) => {
    const aNew = a.questions_total - a.questions_mastered;
    const bNew = b.questions_total - b.questions_mastered;
    if (bNew !== aNew) return bNew - aNew; // descending by NEW count
    return a.category.localeCompare(b.category); // alphabetical fallback
  });

  return { category: sorted[0], wasTieBroken: true };
}
