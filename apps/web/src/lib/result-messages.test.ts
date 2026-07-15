import { describe, expect, it } from 'vitest';
import { resultErrorMessage } from './result-messages';

const messages: Record<string, string> = {
  'error.invalidCredentials': 'Localized credentials error',
};
const t = (key: string) => messages[key] ?? key;

describe('resultErrorMessage', () => {
  it('maps stable API codes to localized copy', () => {
    expect(resultErrorMessage('INVALID_CREDENTIALS', 'Fallback', t)).toBe(
      'Localized credentials error',
    );
  });

  it('uses the localized action fallback for unknown or missing codes', () => {
    expect(resultErrorMessage('NEW_CODE', 'Fallback', t)).toBe('Fallback');
    expect(resultErrorMessage(undefined, 'Fallback', t)).toBe('Fallback');
  });
});
