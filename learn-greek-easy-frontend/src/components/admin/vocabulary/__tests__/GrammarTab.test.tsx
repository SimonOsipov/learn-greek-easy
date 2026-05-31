// src/components/admin/vocabulary/__tests__/GrammarTab.test.tsx

/**
 * Tests for GrammarTab component.
 *
 * Covers:
 * - Placeholder rendered when no part_of_speech
 * - Correct grammar sub-form rendered per POS
 * - useEffect clears previous POS grammar data on POS change
 * - Initial mount does NOT clear anything
 * - Only the exiting POS key is cleared (not others)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { FormProvider, useForm } from 'react-hook-form';
import i18n from '@/i18n';

import { GrammarTab } from '../GrammarTab';

// ============================================
// Mocks for heavy sub-forms — keep tests fast
// ============================================

vi.mock('../grammar/NounGrammarForm', () => ({
  NounGrammarForm: () => <div data-testid="noun-grammar-form">NounForm</div>,
}));

vi.mock('../grammar/VerbGrammarForm', () => ({
  VerbGrammarForm: () => <div data-testid="verb-grammar-form">VerbForm</div>,
}));

vi.mock('../grammar/AdjectiveGrammarForm', () => ({
  AdjectiveGrammarForm: () => <div data-testid="adjective-grammar-form">AdjectiveForm</div>,
}));

vi.mock('../grammar/AdverbGrammarForm', () => ({
  AdverbGrammarForm: () => <div data-testid="adverb-grammar-form">AdverbForm</div>,
}));

// ============================================
// Types
// ============================================

type FormValues = {
  part_of_speech: string | null;
  noun_data: Record<string, unknown> | null;
  verb_data: Record<string, unknown> | null;
  adjective_data: Record<string, unknown> | null;
  adverb_data: Record<string, unknown> | null;
};

// ============================================
// Tests
// ============================================

describe('GrammarTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------
  // Placeholder
  // -------------------------------------------------------

  describe('placeholder', () => {
    it('renders placeholder when part_of_speech is null', () => {
      function Wrapper() {
        const methods = useForm<FormValues>({ defaultValues: { part_of_speech: null } });
        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
            </FormProvider>
          </I18nextProvider>
        );
      }
      render(<Wrapper />);
      expect(screen.getByTestId('grammar-tab-placeholder')).toBeInTheDocument();
    });

    it('renders placeholder when part_of_speech is empty string', () => {
      function Wrapper() {
        const methods = useForm<FormValues>({ defaultValues: { part_of_speech: '' } });
        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
            </FormProvider>
          </I18nextProvider>
        );
      }
      render(<Wrapper />);
      expect(screen.getByTestId('grammar-tab-placeholder')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------
  // Sub-form routing
  // -------------------------------------------------------

  describe('sub-form rendering', () => {
    it('renders NounGrammarForm when part_of_speech is "noun"', () => {
      function Wrapper() {
        const methods = useForm<FormValues>({ defaultValues: { part_of_speech: 'noun' } });
        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
            </FormProvider>
          </I18nextProvider>
        );
      }
      render(<Wrapper />);
      expect(screen.getByTestId('noun-grammar-form')).toBeInTheDocument();
      expect(screen.queryByTestId('verb-grammar-form')).not.toBeInTheDocument();
    });

    it('renders VerbGrammarForm when part_of_speech is "verb"', () => {
      function Wrapper() {
        const methods = useForm<FormValues>({ defaultValues: { part_of_speech: 'verb' } });
        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
            </FormProvider>
          </I18nextProvider>
        );
      }
      render(<Wrapper />);
      expect(screen.getByTestId('verb-grammar-form')).toBeInTheDocument();
      expect(screen.queryByTestId('noun-grammar-form')).not.toBeInTheDocument();
    });

    it('renders AdjectiveGrammarForm when part_of_speech is "adjective"', () => {
      function Wrapper() {
        const methods = useForm<FormValues>({ defaultValues: { part_of_speech: 'adjective' } });
        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
            </FormProvider>
          </I18nextProvider>
        );
      }
      render(<Wrapper />);
      expect(screen.getByTestId('adjective-grammar-form')).toBeInTheDocument();
    });

    it('renders AdverbGrammarForm when part_of_speech is "adverb"', () => {
      function Wrapper() {
        const methods = useForm<FormValues>({ defaultValues: { part_of_speech: 'adverb' } });
        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
            </FormProvider>
          </I18nextProvider>
        );
      }
      render(<Wrapper />);
      expect(screen.getByTestId('adverb-grammar-form')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------
  // useEffect clear behaviour — the core of this component
  // -------------------------------------------------------

  describe('POS change clears previous grammar data', () => {
    /**
     * Builds a controlled harness where we can imperatively change
     * part_of_speech via setValue and then read back what the useEffect did.
     */
    function renderControlled(initialPos: string) {
      let formRef: ReturnType<typeof useForm<FormValues>> | null = null;

      function Controlled() {
        const methods = useForm<FormValues>({
          defaultValues: {
            part_of_speech: initialPos,
            noun_data: { gender: 'feminine', nominative_singular: 'η μητέρα' },
            verb_data: { voice: 'active' },
            adjective_data: { masculine_nom_sg: 'καλός' },
            adverb_data: { comparative: 'καλύτερα' },
          },
        });
        formRef = methods;

        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
              <div data-testid="noun-snap">{JSON.stringify(methods.watch('noun_data'))}</div>
              <div data-testid="verb-snap">{JSON.stringify(methods.watch('verb_data'))}</div>
              <div data-testid="adj-snap">{JSON.stringify(methods.watch('adjective_data'))}</div>
              <div data-testid="adv-snap">{JSON.stringify(methods.watch('adverb_data'))}</div>
            </FormProvider>
          </I18nextProvider>
        );
      }

      render(<Controlled />);

      return {
        changePOS: (newPos: string) => {
          act(() => {
            formRef!.setValue('part_of_speech', newPos);
          });
        },
        snapText: (id: string) => screen.getByTestId(id).textContent,
      };
    }

    it('noun→verb: noun_data is cleared to null', () => {
      const { changePOS, snapText } = renderControlled('noun');

      // Pre-condition: noun_data is populated
      expect(snapText('noun-snap')).not.toBe('null');

      changePOS('verb');

      expect(snapText('noun-snap')).toBe('null');
    });

    it('noun→verb: VerbGrammarForm is rendered after change', () => {
      const { changePOS } = renderControlled('noun');

      expect(screen.getByTestId('noun-grammar-form')).toBeInTheDocument();

      changePOS('verb');

      expect(screen.getByTestId('verb-grammar-form')).toBeInTheDocument();
      expect(screen.queryByTestId('noun-grammar-form')).not.toBeInTheDocument();
    });

    it('noun→verb: verb_data (the new POS) is NOT cleared', () => {
      const { changePOS, snapText } = renderControlled('noun');

      const verbBefore = snapText('verb-snap');
      expect(verbBefore).not.toBe('null');

      changePOS('verb');

      // verb_data must remain — only the previous (noun) data is cleared
      expect(snapText('verb-snap')).not.toBe('null');
    });

    it('verb→noun: verb_data is cleared, noun_data is left intact', () => {
      const { changePOS, snapText } = renderControlled('verb');

      expect(snapText('noun-snap')).not.toBe('null');

      changePOS('noun');

      expect(snapText('verb-snap')).toBe('null');
      expect(snapText('noun-snap')).not.toBe('null');
    });

    it('adjective→adverb: adjective_data is cleared, noun_data and verb_data are untouched', () => {
      const { changePOS, snapText } = renderControlled('adjective');

      changePOS('adverb');

      expect(snapText('adj-snap')).toBe('null');
      // Unrelated fields must not be touched
      expect(snapText('noun-snap')).not.toBe('null');
      expect(snapText('verb-snap')).not.toBe('null');
      // adverb_data itself is not cleared (it was never the exiting POS)
      expect(snapText('adv-snap')).not.toBe('null');
    });

    it('adverb→adjective: adverb_data is cleared, adjective_data is preserved', () => {
      const { changePOS, snapText } = renderControlled('adverb');

      changePOS('adjective');

      expect(snapText('adv-snap')).toBe('null');
      expect(snapText('adj-snap')).not.toBe('null');
    });
  });

  // -------------------------------------------------------
  // Initial mount: no clear on first render
  // -------------------------------------------------------

  describe('initial mount does NOT clear grammar data', () => {
    it('does not clear noun_data on initial mount with part_of_speech="noun"', () => {
      function Controlled() {
        const methods = useForm<FormValues>({
          defaultValues: {
            part_of_speech: 'noun',
            noun_data: { gender: 'masculine', nominative_singular: 'ο άνθρωπος' },
            verb_data: null,
            adjective_data: null,
            adverb_data: null,
          },
        });

        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
              <div data-testid="noun-value">{JSON.stringify(methods.watch('noun_data'))}</div>
            </FormProvider>
          </I18nextProvider>
        );
      }

      render(<Controlled />);

      // noun_data must still be populated — the effect must NOT have fired a clear
      const text = screen.getByTestId('noun-value').textContent;
      expect(text).not.toBe('null');
      const parsed = JSON.parse(text || 'null');
      expect(parsed).not.toBeNull();
      expect(parsed.gender).toBe('masculine');
    });

    it('does not call setValue when part_of_speech has not changed', () => {
      const setValueSpy = vi.fn();

      function Spied() {
        const methods = useForm<FormValues>({
          defaultValues: {
            part_of_speech: 'verb',
            noun_data: null,
            verb_data: { voice: 'active' },
            adjective_data: null,
            adverb_data: null,
          },
        });

        // Spy on setValue to detect unexpected calls from the effect
        const orig = methods.setValue.bind(methods);
        methods.setValue = (...args: Parameters<typeof methods.setValue>) => {
          // Only spy on grammar-data keys, not part_of_speech itself
          if (
            args[0] === 'noun_data' ||
            args[0] === 'verb_data' ||
            args[0] === 'adjective_data' ||
            args[0] === 'adverb_data'
          ) {
            setValueSpy(...args);
          }
          return orig(...args);
        };

        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
            </FormProvider>
          </I18nextProvider>
        );
      }

      render(<Spied />);

      // After mount, the effect runs once but the condition
      // `previousPartOfSpeech.current !== partOfSpeech` is false because
      // the ref is initialised with the same value — so no setValue should fire.
      expect(setValueSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------
  // Sequential POS changes
  // -------------------------------------------------------

  describe('sequential POS changes', () => {
    it('noun→verb→adjective: clears noun_data on first change, verb_data on second', () => {
      let formRef: ReturnType<typeof useForm<FormValues>> | null = null;

      function Controlled() {
        const methods = useForm<FormValues>({
          defaultValues: {
            part_of_speech: 'noun',
            noun_data: { gender: 'feminine' },
            verb_data: { voice: 'active' },
            adjective_data: { masculine_nom_sg: 'καλός' },
            adverb_data: null,
          },
        });
        formRef = methods;

        return (
          <I18nextProvider i18n={i18n}>
            <FormProvider {...methods}>
              <GrammarTab />
              <div data-testid="noun-snap">{JSON.stringify(methods.watch('noun_data'))}</div>
              <div data-testid="verb-snap">{JSON.stringify(methods.watch('verb_data'))}</div>
              <div data-testid="adj-snap">{JSON.stringify(methods.watch('adjective_data'))}</div>
            </FormProvider>
          </I18nextProvider>
        );
      }

      render(<Controlled />);

      // Step 1: noun → verb
      act(() => {
        formRef!.setValue('part_of_speech', 'verb');
      });
      expect(screen.getByTestId('noun-snap').textContent).toBe('null');
      expect(screen.getByTestId('verb-snap').textContent).not.toBe('null');

      // Step 2: verb → adjective
      act(() => {
        formRef!.setValue('part_of_speech', 'adjective');
      });
      expect(screen.getByTestId('verb-snap').textContent).toBe('null');
      expect(screen.getByTestId('adj-snap').textContent).not.toBe('null');
    });
  });
});
