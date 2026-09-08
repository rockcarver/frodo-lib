import { createHash, randomBytes } from 'crypto';

import { encodeBase64Url } from './Base64Utils';

export type PkcePair = {
  verifier: string;
  challenge: string;
  method: 'S256';
};

export type Pkce = {
  createPkcePair(): PkcePair;
};

export default (): Pkce => {
  return {
    createPkcePair(): PkcePair {
      return createPkcePair();
    },
  };
};

/**
 * Generate a PKCE (RFC 7636) verifier/challenge pair for an OAuth2
 * authorization code exchange.
 * @returns {PkcePair} a fresh, cryptographically random verifier/challenge pair
 */
export function createPkcePair(): PkcePair {
  const verifier = encodeBase64Url(randomBytes(32));
  const challenge = encodeBase64Url(
    createHash('sha256').update(verifier).digest()
  );
  return { verifier, challenge, method: 'S256' };
}
