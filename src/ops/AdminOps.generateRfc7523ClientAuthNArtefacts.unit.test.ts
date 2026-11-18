import { decodeJwt } from 'jose';
import { state } from '../index';
import {
  generateRfc7523ClientAuthNArtefacts,
  getAccessTokenUrl,
} from './AdminOps';
import { createJwkRsa, getJwkRsaPublic, verifySignedJwtToken } from './JoseOps';

/**
 * The client authentication artefacts of RFC 7523 are generated locally when
 * `options.save` is left out: no request is sent, so the tests need no tenant
 * and no recording.
 */
describe('AdminOps.generateRfc7523ClientAuthNArtefacts()', () => {
  beforeEach(() => {
    state.setHost('https://openam-matrix.example.com/am');
  });

  test('the jwt of the result is the signed token, not a promise', async () => {
    const result = await generateRfc7523ClientAuthNArtefacts({
      clientId: 'matrix-client',
      state,
    });
    expect(typeof result.jwt).toBe('string');
    expect((result.jwt as string).split('.')).toHaveLength(3);
    // A promise serialises as `{}`; the token has to survive a JSON round trip
    // (an MCP result is JSON).
    expect(JSON.parse(JSON.stringify(result)).jwt).toBe(result.jwt);
  });

  test('the token is signed with the key of the result and says who it is for', async () => {
    const result = await generateRfc7523ClientAuthNArtefacts({
      clientId: 'matrix-client',
      state,
    });
    const verified = await verifySignedJwtToken(
      result.jwt as string,
      await getJwkRsaPublic(result.jwk)
    );
    expect(JSON.parse(verified.payload.toString('utf8'))).toMatchObject({
      iss: 'matrix-client',
      sub: 'matrix-client',
      aud: getAccessTokenUrl(state),
    });
    expect(result.client.coreOAuth2ClientConfig.clientType.value).toBe(
      'Confidential'
    );
  });

  test('the token expires five minutes after it was made, not at the start of 1970', async () => {
    const before = Math.floor(Date.now() / 1000);
    const result = await generateRfc7523ClientAuthNArtefacts({
      clientId: 'matrix-client',
      state,
    });
    const after = Math.floor(Date.now() / 1000);
    const { exp } = decodeJwt(result.jwt as string);
    expect(exp).toBeGreaterThanOrEqual(before + 300);
    expect(exp).toBeLessThanOrEqual(after + 300);
  });

  test('a given audience and a given key are used', async () => {
    const jwk = await createJwkRsa();
    const result = await generateRfc7523ClientAuthNArtefacts({
      clientId: 'matrix-client',
      aud: 'https://openam-matrix.example.com/am/oauth2/realms/root/access_token',
      jwk,
      state,
    });
    expect(result.jwk).toBe(jwk);
    expect(decodeJwt(result.jwt as string).aud).toBe(
      'https://openam-matrix.example.com/am/oauth2/realms/root/access_token'
    );
    await expect(
      verifySignedJwtToken(result.jwt as string, await getJwkRsaPublic(jwk))
    ).resolves.toBeDefined();
  });
});
