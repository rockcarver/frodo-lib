import { FrodoError } from '../ops/FrodoError';

export type Jwt = {
  decodeJwtPayload(jwt: string): Record<string, unknown>;
};

export default (): Jwt => {
  return {
    decodeJwtPayload(jwt: string): Record<string, unknown> {
      return decodeJwtPayload(jwt);
    },
  };
};

/**
 * Decode a JWT's payload (the middle, base64url-encoded segment) without
 * verifying its signature.
 *
 * @remarks
 * Signature verification is deliberately not performed — every caller in
 * frodo-lib only ever decodes a token it just received directly from AM
 * itself over TLS (e.g. to read the `may_act` claim off a freshly-issued
 * access token), never a token supplied by an untrusted third party.
 * @param {string} jwt the JSON Web Token to decode
 * @returns {Record<string, unknown>} the decoded payload claims
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const segments = jwt.split('.');
  if (segments.length < 2) {
    throw new FrodoError(`Not a valid JWT: expected at least 2 segments`);
  }
  try {
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
  } catch (error) {
    throw new FrodoError(`Error decoding JWT payload`, error);
  }
}
