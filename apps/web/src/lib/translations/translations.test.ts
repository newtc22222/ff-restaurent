import { describe, expect, it } from 'vitest';
import { translations, type Locale } from './index';

/**
 * The `satisfies` clauses in each en/<domain>.ts module already make a missing
 * English key a compile error. These tests cover what types cannot: extra keys,
 * empty strings, and interpolation placeholders that differ between locales.
 */

const locales: Locale[] = ['vi', 'en'];

const placeholders = (value: string) =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('translation dictionaries', () => {
  it('expose exactly the same key set in both locales', () => {
    const [vi, en] = locales.map((locale) =>
      Object.keys(translations[locale]).sort(),
    );
    expect(en).toEqual(vi);
  });

  it('carry a non-empty string for every key', () => {
    for (const locale of locales) {
      const blank = Object.entries(translations[locale])
        .filter(([, value]) => typeof value !== 'string' || !value.trim())
        .map(([key]) => key);
      expect(blank, `blank ${locale} values`).toEqual([]);
    }
  });

  it('use the same interpolation placeholders in both locales', () => {
    const mismatched = Object.keys(translations.vi).filter(
      (key) =>
        placeholders(translations.vi[key as never]).join() !==
        placeholders(translations.en[key as never]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it('namespaces every key so domain modules stay unambiguous', () => {
    const unnamespaced = Object.keys(translations.vi).filter(
      (key) => !key.includes('.'),
    );
    expect(unnamespaced).toEqual([]);
  });
});
