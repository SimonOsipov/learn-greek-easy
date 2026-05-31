import { describe, it, expect } from 'vitest';
import { getLocalizedDeckName, getLocalizedDeckDescription } from '../deckLocale';

// ---------------------------------------------------------------------------
// getLocalizedDeckName
// ---------------------------------------------------------------------------

describe('getLocalizedDeckName — ru fallback chain', () => {
  it('returns nameRu when present (camelCase primary)', () => {
    expect(
      getLocalizedDeckName(
        { nameRu: 'РусскоеИмя', nameEn: 'English Name', name_ru: 'snake_ru', name_en: 'snake_en' },
        'ru'
      )
    ).toBe('РусскоеИмя');
  });

  it('falls back to name_ru when nameRu is absent', () => {
    expect(
      getLocalizedDeckName(
        { name_ru: 'snake_ru', nameEn: 'English Name', name_en: 'snake_en' },
        'ru'
      )
    ).toBe('snake_ru');
  });

  it('falls back to nameEn when both ru fields are absent', () => {
    expect(getLocalizedDeckName({ nameEn: 'English Name', name_en: 'snake_en' }, 'ru')).toBe(
      'English Name'
    );
  });

  it('falls back to name_en when nameRu, name_ru, nameEn are absent', () => {
    expect(getLocalizedDeckName({ name_en: 'snake_en' }, 'ru')).toBe('snake_en');
  });

  it('falls back to name when all locale fields absent (ru)', () => {
    expect(getLocalizedDeckName({ name: 'Generic Name' }, 'ru')).toBe('Generic Name');
  });

  it('falls back to title when name is also absent (ru)', () => {
    expect(getLocalizedDeckName({ title: 'Title Only' }, 'ru')).toBe('Title Only');
  });

  it('returns empty string when all fields absent (ru)', () => {
    expect(getLocalizedDeckName({}, 'ru')).toBe('');
  });
});

describe('getLocalizedDeckName — en fallback chain', () => {
  it('returns nameEn when present (en locale)', () => {
    expect(getLocalizedDeckName({ nameEn: 'English Name', nameRu: 'РусскоеИмя' }, 'en')).toBe(
      'English Name'
    );
  });

  it('falls back to name_en when nameEn is absent (en locale)', () => {
    expect(getLocalizedDeckName({ name_en: 'snake_en', nameRu: 'РусскоеИмя' }, 'en')).toBe(
      'snake_en'
    );
  });

  it('falls back to name when nameEn and name_en are absent (en locale)', () => {
    expect(getLocalizedDeckName({ name: 'Generic', nameRu: 'РусскоеИмя' }, 'en')).toBe('Generic');
  });

  it('falls back to title when name is also absent (en locale)', () => {
    expect(getLocalizedDeckName({ title: 'Title', nameRu: 'РусскоеИмя' }, 'en')).toBe('Title');
  });

  it('skips nameRu / name_ru fields for en locale', () => {
    // RU-only deck — en locale must NOT expose Russian text
    expect(getLocalizedDeckName({ nameRu: 'РусскоеИмя', name_ru: 'snake_ru' }, 'en')).toBe('');
  });

  it('returns empty string when all fields absent (en)', () => {
    expect(getLocalizedDeckName({}, 'en')).toBe('');
  });

  it('unknown locale behaves like en (skips ru, uses en chain)', () => {
    expect(getLocalizedDeckName({ nameEn: 'English Name', nameRu: 'РусскоеИмя' }, 'de')).toBe(
      'English Name'
    );
  });
});

describe('getLocalizedDeckName — snake_case-only admin shape', () => {
  it('resolves name from snake_case en fields (en locale)', () => {
    // Admin shape: no camelCase fields at all
    expect(getLocalizedDeckName({ name_en: 'Admin EN Name' }, 'en')).toBe('Admin EN Name');
  });

  it('resolves name from snake_case ru fields (ru locale)', () => {
    expect(getLocalizedDeckName({ name_ru: 'Admin RU Name' }, 'ru')).toBe('Admin RU Name');
  });

  it('resolves ru snake shape falls back to snake en', () => {
    expect(getLocalizedDeckName({ name_en: 'snake EN' }, 'ru')).toBe('snake EN');
  });

  it('resolves snake name as last resort (ru locale)', () => {
    expect(getLocalizedDeckName({ name: 'Generic snake' }, 'ru')).toBe('Generic snake');
  });
});

// ---------------------------------------------------------------------------
// getLocalizedDeckDescription
// ---------------------------------------------------------------------------

describe('getLocalizedDeckDescription — ru fallback chain', () => {
  it('returns descriptionRu when present (camelCase primary)', () => {
    expect(
      getLocalizedDeckDescription(
        {
          descriptionRu: 'Описание',
          descriptionEn: 'Description',
          description_ru: 'snake_desc_ru',
          description_en: 'snake_desc_en',
        },
        'ru'
      )
    ).toBe('Описание');
  });

  it('falls back to description_ru when descriptionRu is absent', () => {
    expect(
      getLocalizedDeckDescription(
        { description_ru: 'snake_desc_ru', descriptionEn: 'Description EN' },
        'ru'
      )
    ).toBe('snake_desc_ru');
  });

  it('falls back to descriptionEn when ru fields absent', () => {
    expect(
      getLocalizedDeckDescription(
        { descriptionEn: 'Description EN', description_en: 'snake_en' },
        'ru'
      )
    ).toBe('Description EN');
  });

  it('falls back to description_en when descriptionRu, description_ru, descriptionEn absent', () => {
    expect(getLocalizedDeckDescription({ description_en: 'snake_en' }, 'ru')).toBe('snake_en');
  });

  it('falls back to bare description when all locale fields absent (ru)', () => {
    expect(getLocalizedDeckDescription({ description: 'Bare description' }, 'ru')).toBe(
      'Bare description'
    );
  });

  it('returns null when all sources are null (ru)', () => {
    expect(
      getLocalizedDeckDescription(
        {
          descriptionRu: null,
          description_ru: null,
          descriptionEn: null,
          description_en: null,
          description: null,
        },
        'ru'
      )
    ).toBeNull();
  });

  it('returns null when no fields are provided (ru)', () => {
    expect(getLocalizedDeckDescription({}, 'ru')).toBeNull();
  });
});

describe('getLocalizedDeckDescription — en fallback chain', () => {
  it('returns descriptionEn when present (en locale)', () => {
    expect(
      getLocalizedDeckDescription(
        { descriptionEn: 'Description EN', descriptionRu: 'Описание RU' },
        'en'
      )
    ).toBe('Description EN');
  });

  it('falls back to description_en when descriptionEn absent (en locale)', () => {
    expect(
      getLocalizedDeckDescription(
        { description_en: 'snake_en', descriptionRu: 'Описание RU' },
        'en'
      )
    ).toBe('snake_en');
  });

  it('falls back to bare description when en locale fields absent', () => {
    expect(
      getLocalizedDeckDescription(
        { description: 'Bare description', descriptionRu: 'Описание' },
        'en'
      )
    ).toBe('Bare description');
  });

  it('skips descriptionRu / description_ru fields for en locale', () => {
    // RU-only deck — en must NOT expose Russian description
    expect(
      getLocalizedDeckDescription({ descriptionRu: 'Описание', description_ru: 'snake_ru' }, 'en')
    ).toBeNull();
  });

  it('returns null when all sources are null (en)', () => {
    expect(
      getLocalizedDeckDescription(
        { descriptionEn: null, description_en: null, description: null },
        'en'
      )
    ).toBeNull();
  });

  it('returns null when no fields are provided (en)', () => {
    expect(getLocalizedDeckDescription({}, 'en')).toBeNull();
  });
});

describe('getLocalizedDeckDescription — snake_case-only admin shape', () => {
  it('resolves description from snake_case en fields (en locale)', () => {
    expect(getLocalizedDeckDescription({ description_en: 'Admin EN Desc' }, 'en')).toBe(
      'Admin EN Desc'
    );
  });

  it('resolves description from snake_case ru fields (ru locale)', () => {
    expect(getLocalizedDeckDescription({ description_ru: 'Admin RU Desc' }, 'ru')).toBe(
      'Admin RU Desc'
    );
  });

  it('resolves ru snake shape falls back to snake en description', () => {
    expect(getLocalizedDeckDescription({ description_en: 'snake EN desc' }, 'ru')).toBe(
      'snake EN desc'
    );
  });
});

describe('getLocalizedDeckDescription — null vs undefined handling', () => {
  it('treats explicit null as absent and continues chain (ru)', () => {
    // descriptionRu is explicitly null, should fall through to descriptionEn
    expect(
      getLocalizedDeckDescription({ descriptionRu: null, descriptionEn: 'EN Fallback' }, 'ru')
    ).toBe('EN Fallback');
  });

  it('treats explicit null as absent and continues chain (en)', () => {
    // descriptionEn is explicitly null, should fall through to description
    expect(
      getLocalizedDeckDescription({ descriptionEn: null, description: 'Bare fallback' }, 'en')
    ).toBe('Bare fallback');
  });
});
