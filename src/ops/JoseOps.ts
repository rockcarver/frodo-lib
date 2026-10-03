import {
  CompactSign,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  SignJWT,
} from 'jose';
import { State } from '../shared/State';

export type Jose = {
  createJwkRsa(): Promise<JwkRsa>;
  getJwkRsaPublic(jwkJson: JwkRsa): Promise<JwkRsaPublic>;
  createJwks(...keys: JwkInterface[]): JwksInterface;
  createSignedJwtToken(payload: string | object, jwkJson: JwkRsa): Promise<any>;
  verifySignedJwtToken(jwt: string, jwkJson: JwkRsaPublic): Promise<any>;
  /**
   * Verifies a JWT's signature against an arbitrary JWKS document (e.g. a
   * third-party OIDC provider's published key set) and returns its decoded
   * payload. Pure signature verification only — issuer, audience, and
   * expiry are the caller's responsibility.
   */
  verifyJwtAgainstJwks(
    jwt: string,
    jwks: ExternalJwksDocument
  ): Promise<Record<string, unknown>>;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default (_state: State) => {
  return {
    async createJwkRsa(): Promise<JwkRsa> {
      return createJwkRsa();
    },

    async getJwkRsaPublic(jwkJson: JwkRsa): Promise<JwkRsaPublic> {
      return getJwkRsaPublic(jwkJson);
    },

    createJwks(...keys: JwkInterface[]): JwksInterface {
      return createJwks(...keys);
    },

    async createSignedJwtToken(payload: string | object, jwkJson: JwkRsa) {
      return createSignedJwtToken(payload, jwkJson);
    },

    async verifySignedJwtToken(jwt: string, jwkJson: JwkRsaPublic) {
      return verifySignedJwtToken(jwt, jwkJson);
    },

    async verifyJwtAgainstJwks(
      jwt: string,
      jwks: ExternalJwksDocument
    ): Promise<Record<string, unknown>> {
      return verifyJwtAgainstJwks(jwt, jwks);
    },
  };
};

export interface JwkInterface {
  kty: string;
  use?: string;
  key_ops?: string[];
  alg: string;
  kid?: string;
  x5u?: string;
  x5c?: string;
  x5t?: string;
  'x5t#S256'?: string;
}

export type JwkRsa = JwkInterface & {
  d: string;
  dp: string;
  dq: string;
  e: string;
  n: string;
  p: string;
  q: string;
  qi: string;
};

export type JwkRsaPublic = JwkInterface & {
  e: string;
  n: string;
};

export interface JwksInterface {
  keys: JwkInterface[];
}

/**
 * A JWKS document as published by an arbitrary third-party OIDC provider,
 * consumed (not created) by frodo — deliberately looser than
 * {@link JwksInterface}/{@link JwkInterface}, which model keys frodo itself
 * creates and can guarantee the shape of (e.g. always carrying `alg`).
 * A real external IDP's JWKS entries commonly omit fields like `alg`
 * while still being perfectly valid, verifiable keys.
 */
export interface ExternalJwksDocument {
  keys: Record<string, unknown>[];
}

export async function createJwkRsa(): Promise<JwkRsa> {
  const { privateKey } = await generateKeyPair('RS256', {
    modulusLength: 4096,
    extractable: true,
  });
  const jwk = (await exportJWK(privateKey)) as unknown as JwkRsa;
  // Reproduce the shape node-jose produced (kty/alg/use/kid) — tests and
  // possibly external consumers rely on it.
  jwk.kty = 'RSA';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  jwk.kid = jwk.n.slice(0, 16);
  // include the private key
  return jwk;
}

export async function getJwkRsaPublic(jwkJson: JwkRsa): Promise<JwkRsaPublic> {
  // extractable: true is required to export the key back to JWK form below
  // (private-key imports default to non-extractable CryptoKeys).
  const key = await importJWK(
    jwkJson as unknown as Parameters<typeof importJWK>[0],
    'RS256',
    { extractable: true }
  );
  const publicJwk = (await exportJWK(key)) as unknown as JwkRsaPublic;
  publicJwk.kty = jwkJson.kty;
  publicJwk.alg = jwkJson.alg ?? 'RS256';
  publicJwk.use = jwkJson.use ?? 'sig';
  if (jwkJson.kid) publicJwk.kid = jwkJson.kid;
  // do not include the private key
  const publicOnly = publicJwk as unknown as Record<string, unknown>;
  delete publicOnly.d;
  delete publicOnly.p;
  delete publicOnly.q;
  delete publicOnly.dp;
  delete publicOnly.dq;
  delete publicOnly.qi;
  return publicJwk;
}

export function createJwks(...keys: JwkInterface[]): JwksInterface {
  return {
    keys,
  };
}

export async function createSignedJwtToken(
  payload: string | object,
  // Accepts either a JWK JSON (imported here) or an already-imported
  // CryptoKey (e.g. from importPKCS8 in AuthenticateOps' amster flow).
  jwkJson: JwkRsa | CryptoKey | Uint8Array,
  header: object = {}
) {
  const key =
    typeof jwkJson === 'object' && 'kty' in (jwkJson as JwkRsa)
      ? await importJWK(
          jwkJson as unknown as Parameters<typeof importJWK>[0],
          'RS256'
        )
      : (jwkJson as CryptoKey | Uint8Array);
  const protectedHeader = { alg: 'RS256', typ: 'JWT', ...header };
  if (typeof payload === 'object') {
    // node-jose serialized object payloads to JSON; SignJWT does the same and
    // additionally base64url-encodes it into the compact JWT body.
    return new SignJWT(payload as Record<string, unknown>)
      .setProtectedHeader(protectedHeader)
      .sign(key);
  }
  // Raw string payloads are signed verbatim as the JWT body (node-jose's
  // .update(String) behavior) via the generic compact-signing path.
  return new CompactSign(new TextEncoder().encode(payload))
    .setProtectedHeader(protectedHeader)
    .sign(key);
}

export async function verifySignedJwtToken(jwt: string, jwkJson: JwkRsaPublic) {
  const key = await importJWK(
    jwkJson as unknown as Parameters<typeof importJWK>[0],
    'RS256'
  );
  const verifyResult = await jwtVerify(jwt, key);
  // node-jose returned an envelope with key, header, and payload (as Buffer);
  // callers use the payload, so return a compatible-ish shape with the
  // decoded payload string.
  return {
    payload: Buffer.from(JSON.stringify(verifyResult.payload), 'utf8'),
    key,
    header: verifyResult.protectedHeader,
  };
}

/**
 * Verifies a JWT's signature against an arbitrary JWKS document (e.g. a
 * third-party OIDC provider's published key set — the keystore selects the
 * right key by the token's own `kid` header) and returns its decoded payload.
 * Pure signature verification only — issuer, audience, and expiry are the
 * caller's responsibility.
 * @throws if the signature does not verify against any key in the JWKS,
 * or the payload is not valid JSON.
 */
export async function verifyJwtAgainstJwks(
  jwt: string,
  jwks: ExternalJwksDocument
): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(jwt, createLocalJWKSet(jwks));
  return payload as Record<string, unknown>;
}
