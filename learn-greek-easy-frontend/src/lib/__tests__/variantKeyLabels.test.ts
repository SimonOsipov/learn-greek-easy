import { describe, it, expect } from 'vitest';
import { getVariantKeyLabel } from '../variantKeyLabels';

describe('getVariantKeyLabel', () => {
  it('returns Default for "default"', () => {
    expect(getVariantKeyLabel('default')).toBe('Default');
  });
  it('returns Singular → Plural for "sg_to_pl"', () => {
    expect(getVariantKeyLabel('sg_to_pl')).toBe('Singular → Plural');
  });
  it('returns Singular → Plural (Masc.) for "sg_to_pl_masculine"', () => {
    expect(getVariantKeyLabel('sg_to_pl_masculine')).toBe('Singular → Plural (Masc.)');
  });
  it('returns Plural → Singular for "pl_to_sg"', () => {
    expect(getVariantKeyLabel('pl_to_sg')).toBe('Plural → Singular');
  });
  it('returns Plural → Singular (Fem.) for "pl_to_sg_feminine"', () => {
    expect(getVariantKeyLabel('pl_to_sg_feminine')).toBe('Plural → Singular (Fem.)');
  });
  it('returns Greek → Translation for el_to_target_ prefix', () => {
    expect(getVariantKeyLabel('el_to_target_abc123')).toBe('Greek → Translation');
    expect(getVariantKeyLabel('el_to_target_uuid-1234')).toBe('Greek → Translation');
  });
  it('returns Translation → Greek for target_to_el_ prefix', () => {
    expect(getVariantKeyLabel('target_to_el_abc123')).toBe('Translation → Greek');
  });
  it('returns Conjugation for conjugation_ prefix', () => {
    expect(getVariantKeyLabel('conjugation_present')).toBe('Conjugation');
  });
  it('returns Nom. → Gen. (Sg.) for nominative_to_genitive_singular', () => {
    expect(getVariantKeyLabel('nominative_to_genitive_singular')).toBe('Nom. → Gen. (Sg.)');
  });
  it('returns Nom. → Acc. (Sg.) for nominative_to_accusative_singular', () => {
    expect(getVariantKeyLabel('nominative_to_accusative_singular')).toBe('Nom. → Acc. (Sg.)');
  });
  it('returns Nom. → Voc. (Sg.) for nominative_to_vocative_singular', () => {
    expect(getVariantKeyLabel('nominative_to_vocative_singular')).toBe('Nom. → Voc. (Sg.)');
  });
  it('returns Nom. → Gen. (Pl.) for nominative_to_genitive_plural', () => {
    expect(getVariantKeyLabel('nominative_to_genitive_plural')).toBe('Nom. → Gen. (Pl.)');
  });
  it('returns Nom. → Acc. (Pl.) for nominative_to_accusative_plural', () => {
    expect(getVariantKeyLabel('nominative_to_accusative_plural')).toBe('Nom. → Acc. (Pl.)');
  });
  it('returns Nom. → Voc. (Pl.) for nominative_to_vocative_plural', () => {
    expect(getVariantKeyLabel('nominative_to_vocative_plural')).toBe('Nom. → Voc. (Pl.)');
  });
  it('returns Declension for declension_ prefix', () => {
    expect(getVariantKeyLabel('declension_noun')).toBe('Declension');
  });
  it('returns Grammar Form for grammar_ prefix', () => {
    expect(getVariantKeyLabel('grammar_verb')).toBe('Grammar Form');
  });
  it('returns title-cased fallback for unmapped keys', () => {
    expect(getVariantKeyLabel('some_unknown_key')).toBe('Some Unknown Key');
    expect(getVariantKeyLabel('meaning_el_to_en_t1')).toBe('Meaning El To En T1');
  });
  it('returns title-cased single word for single-word key', () => {
    expect(getVariantKeyLabel('custom')).toBe('Custom');
  });
});
