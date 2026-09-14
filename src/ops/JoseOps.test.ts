/**
 * Run tests
 *
 *        npm run test:only JoseOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as Jose from './JoseOps';
import { parseUrl } from '../utils/ExportImportUtils';
import { v4 } from 'uuid';
import { isEqualJson } from '../utils/JsonUtils';
import { decode } from '../utils/Base64Utils';

describe('JoseOps - createJWK()', () => {
  test('createJWK() 0: Method is implemented', async () => {
    expect(Jose.createJwkRsa).toBeDefined();
  });

  test('createJWK() 1: Create JWK with RSA key', async () => {
    const jwk = await Jose.createJwkRsa();
    expect(jwk).toBeTruthy();
    expect(jwk.kty).toBe('RSA');
    expect(jwk.alg).toBe('RS256');
    expect(jwk.kid).toBeTruthy();
    expect(jwk.d).toBeTruthy();
    expect(jwk.dp).toBeTruthy();
    expect(jwk.dq).toBeTruthy();
    expect(jwk.e).toBe('AQAB');
    expect(jwk.n).toBeTruthy();
    expect(jwk.p).toBeTruthy();
    expect(jwk.q).toBeTruthy();
    expect(jwk.qi).toBeTruthy();
  });
});

describe('JoseOps - getJwkRsaPublic()', () => {
  test('getJwkRsaPublic() 0: Method is implemented', async () => {
    expect(Jose.getJwkRsaPublic).toBeDefined();
  });

  test('getJwkRsaPublic() 1: Get JWK with RSA public key, only', async () => {
    const jwk = await Jose.createJwkRsa();
    const jwkPublic = await Jose.getJwkRsaPublic(jwk);
    expect(jwkPublic).toBeTruthy();
    expect(jwkPublic.kty).toBe('RSA');
    expect(jwkPublic.alg).toBe('RS256');
    expect(jwkPublic.kid).toBeTruthy();
    expect(jwkPublic['d']).toBeFalsy();
    expect(jwkPublic['dp']).toBeFalsy();
    expect(jwkPublic['dq']).toBeFalsy();
    expect(jwkPublic.e).toBe('AQAB');
    expect(jwkPublic.n).toBeTruthy();
    expect(jwkPublic['p']).toBeFalsy();
    expect(jwkPublic['q']).toBeFalsy();
    expect(jwkPublic['qi']).toBeFalsy();
  });
});

describe('JoseOps - createJwks()', () => {
  test('createJwks() 0: Method is implemented', async () => {
    expect(Jose.createJwks).toBeDefined();
  });

  test('createJwks() 1: Create JWKS with 1 key', async () => {
    const jwk = await Jose.createJwkRsa();
    const jwks = await Jose.createJwks(jwk);
    expect(jwks).toBeTruthy();
    expect(jwks.keys).toBeTruthy();
    expect(jwks.keys.length).toBe(1);
  });

  test('createJwks() 2: Create JWKS with 2 keys', async () => {
    const jwk1 = await Jose.createJwkRsa();
    const jwk2 = await Jose.createJwkRsa();
    const jwks = await Jose.createJwks(jwk1, jwk2);
    expect(jwks).toBeTruthy();
    expect(jwks.keys).toBeTruthy();
    expect(jwks.keys.length).toBe(2);
  });
});

describe('JoseOps - createSignedJwtToken()', () => {
  test('createSignedJwtToken() 0: Method is implemented', async () => {
    expect(Jose.createSignedJwtToken).toBeDefined();
  });

  test('createSignedJwtToken() 1: Create signed JWT', async () => {
    // The audience is the URL of the access token in the realm for client, and must include the port number
    const u = parseUrl('https://openam-svcaccts-final.forgeblocks.com/am');
    const aud = `${u.origin}:${
      u.port ? u.port : u.protocol === 'https' ? '443' : '80'
    }${u.pathname}/oauth2/access_token`;

    // Cross platform way of setting JWT expiry time 3 minutes in the future, expressed as number of seconds since EPOCH
    const exp = Math.floor(new Date().getTime() / 1000 + 180);

    // A unique ID for the JWT which is required when requesting the openid scope
    const jti = v4();

    const iss = '0de8d0d8-e423-41e8-9034-73883af90917';
    const sub = iss;

    // Create the payload for our bearer token
    const payload = {
      iss,
      sub,
      aud,
      exp,
      jti,
    };
    const jwk = await Jose.createJwkRsa();
    const jwt = await Jose.createSignedJwtToken(payload, jwk);
    expect(jwt).toBeTruthy();
    expect(jwt.split('.').length).toBe(3);
    expect(
      isEqualJson(JSON.parse(decode(jwt.split('.')[1])), payload)
    ).toBeTruthy();
  });
});

describe('JoseOps - verifySignedJwtToken()', () => {
  test('verifySignedJwtToken() 0: Method is implemented', async () => {
    expect(Jose.verifySignedJwtToken).toBeDefined();
  });

  test('verifySignedJwtToken() 1: Verify signed JWT', async () => {
    // The audience is the URL of the access token in the realm for client, and must include the port number
    const u = parseUrl('https://openam-svcaccts-final.forgeblocks.com/am');
    const aud = `${u.origin}:${
      u.port ? u.port : u.protocol === 'https' ? '443' : '80'
    }${u.pathname}/oauth2/access_token`;

    // Cross platform way of setting JWT expiry time 3 minutes in the future, expressed as number of seconds since EPOCH
    const exp = Math.floor(new Date().getTime() / 1000 + 180);

    // A unique ID for the JWT which is required when requesting the openid scope
    const jti = v4();

    const iss = '0de8d0d8-e423-41e8-9034-73883af90917';
    const sub = iss;

    // Create the payload for our bearer token
    const payload = {
      iss,
      sub,
      aud,
      exp,
      jti,
    };
    const jwk = await Jose.createJwkRsa();
    const jwt = await Jose.createSignedJwtToken(payload, jwk);
    expect(jwt).toBeTruthy();
    const jwkPublic = await Jose.getJwkRsaPublic(jwk);
    const verifyResult = await Jose.verifySignedJwtToken(jwt, jwkPublic);
    expect(
      isEqualJson(JSON.parse(verifyResult.payload.toString()), payload)
    ).toBeTruthy();
  });
});

describe('JoseOps - verifyJwtAgainstJwks()', () => {
  test('verifyJwtAgainstJwks() 0: Method is implemented', async () => {
    expect(Jose.verifyJwtAgainstJwks).toBeDefined();
  });

  test('verifyJwtAgainstJwks() 1: Verifies a JWT against a multi-key JWKS, selecting the right key by kid', async () => {
    const signingJwk = await Jose.createJwkRsa();
    // A second, unrelated key in the JWKS — proves kid-based selection,
    // not "verifies against the first/only key" (the shape a real
    // external IDP's published JWKS always has: multiple keys, rotated
    // over time).
    const otherJwk = await Jose.createJwkRsa();
    const jwks = Jose.createJwks(
      await Jose.getJwkRsaPublic(otherJwk),
      await Jose.getJwkRsaPublic(signingJwk)
    );

    const payload = {
      iss: 'https://login.microsoftonline.com/tenant-id/v2.0',
      aud: 'test-client-id',
      sub: 'user-123',
      groups: ['frodo-mcp-admins'],
      exp: Math.floor(Date.now() / 1000 + 180),
    };
    // A real external IDP's tokens always carry a `kid` header naming
    // which of its (rotated) JWKS keys signed them — required here for
    // node-jose's keystore to pick the right one out of several
    // candidates. createSignedJwtToken() itself deliberately omits `kid`
    // by default (node-jose/node-jose#253), so it's set explicitly.
    const jwt = await Jose.createSignedJwtToken(payload, signingJwk, {
      kid: signingJwk.kid,
    });

    const verified = await Jose.verifyJwtAgainstJwks(jwt, jwks as any);
    expect(verified).toEqual(payload);
  });

  test('verifyJwtAgainstJwks() 2: Throws when the JWT was not signed by any key in the JWKS', async () => {
    const signingJwk = await Jose.createJwkRsa();
    const unrelatedJwk = await Jose.createJwkRsa();
    const jwks = Jose.createJwks(await Jose.getJwkRsaPublic(unrelatedJwk));

    const jwt = await Jose.createSignedJwtToken(
      { sub: 'user-123' },
      signingJwk
    );

    await expect(Jose.verifyJwtAgainstJwks(jwt, jwks as any)).rejects.toThrow();
  });
});
