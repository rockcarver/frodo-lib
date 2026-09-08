/**
 * Run tests
 *
 *        npm run test:only PkceUtils
 */
import { createHash } from 'crypto';

import { createPkcePair } from './PkceUtils';

describe('PkceUtils', () => {
  describe('createPkcePair()', () => {
    test('0: Method is implemented', () => {
      expect(createPkcePair).toBeDefined();
    });

    test('1: Generates a verifier, an S256 challenge derived from it, and the method', () => {
      const pair = createPkcePair();
      expect(pair.method).toBe('S256');
      expect(pair.verifier).toEqual(expect.any(String));
      expect(pair.challenge).toEqual(expect.any(String));
      const expectedChallenge = createHash('sha256')
        .update(pair.verifier)
        .digest('base64url');
      expect(pair.challenge).toBe(expectedChallenge);
    });

    test('2: Neither verifier nor challenge contain base64 padding or URL-unsafe characters', () => {
      const { verifier, challenge } = createPkcePair();
      for (const value of [verifier, challenge]) {
        expect(value).not.toMatch(/[+/=]/);
      }
    });

    test('3: Generates a fresh, unique pair on every call', () => {
      const first = createPkcePair();
      const second = createPkcePair();
      expect(first.verifier).not.toBe(second.verifier);
      expect(first.challenge).not.toBe(second.challenge);
    });
  });
});
