import { describe, expect, it } from 'vitest';
import { isValidContactEmail } from '../../src/core/email';

describe('isValidContactEmail (FR-025)', () => {
  it.each(['you@example.org', 'first.last@uni.edu.br', '  padded@example.org  '])(
    'accepts %s',
    (value) => {
      expect(isValidContactEmail(value)).toBe(true);
    },
  );

  it.each(['', '   ', 'you', 'you@', '@example.org', 'you@example', 'you @example.org', 'a@b.'])(
    'rejects %j',
    (value) => {
      expect(isValidContactEmail(value)).toBe(false);
    },
  );
});
