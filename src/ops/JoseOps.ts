import jose from 'node-jose';

import { State } from '../shared/State';

export type Jose = {
  createJwkRsa(): Promise<JwkRsa>;
  getJwkRsaPublic(jwkJson: JwkRsa): Promise<JwkRsaPublic>;
  createJwks(...keys: JwkInterface[]): JwksInterface;
  createSignedJwtToken(payload: string | object, jwkJson: JwkRsa): Promise<any>;
  verifySignedJwtToken(jwt: string, jwkJson: JwkRsaPublic): Promise<any>;
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

export async function createJwkRsa(): Promise<JwkRsa> {
  const jwk = await jose.JWK.createKey('RSA', 4096, { alg: 'RS256' });
  // include the private key
  return jwk.toJSON(true) as JwkRsa;
}

export async function getJwkRsaPublic(jwkJson: JwkRsa): Promise<JwkRsaPublic> {
  const jwk = await jose.JWK.asKey(jwkJson);
  // do not include the private key
  return jwk.toJSON(false) as JwkRsaPublic;
}

export function createJwks(...keys: JwkInterface[]): JwksInterface {
  return {
    keys,
  };
}

export async function createSignedJwtToken(
  payload: string | object,
  jwkJson: JwkRsa,
  header: object = {}
) {
  const key = await jose.JWK.asKey(jwkJson);
  if (typeof payload === 'object') {
    payload = JSON.stringify(payload);
  }
  const jwt = await jose.JWS.createSign(
    { alg: 'RS256', compact: true, fields: header },
    // https://github.com/cisco/node-jose/issues/253
    { key, reference: false }
  )
    .update(payload)
    .final();
  return jwt;
}

export async function verifySignedJwtToken(jwt: string, jwkJson: JwkRsaPublic) {
  const jwk = await jose.JWK.asKey(jwkJson);
  const verifyResult = await jose.JWS.createVerify(jwk).verify(jwt);
  return verifyResult;
}
