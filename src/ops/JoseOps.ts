import jose from 'node-jose';

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

export async function createSignedJwtToken(payload, jwkJson: JwkRsa) {
  const key = await jose.JWK.asKey(jwkJson);
  if (typeof payload === 'object') {
    payload = JSON.stringify(payload);
  }
  const jwt = await jose.JWS.createSign(
    { alg: 'RS256', compact: true, fields: {} },
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
