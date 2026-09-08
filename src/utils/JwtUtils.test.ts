/**
 * Run tests
 *
 *        npm run test:only JwtUtils
 */
import { decodeJwtPayload } from './JwtUtils';

function encodeSegment(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function fakeJwt(payload: object): string {
  const header = encodeSegment({ typ: 'JWT', alg: 'RS256' });
  const body = encodeSegment(payload);
  return `${header}.${body}.fake-signature`;
}

describe('JwtUtils', () => {
  describe('decodeJwtPayload()', () => {
    test('0: Method is implemented', () => {
      expect(decodeJwtPayload).toBeDefined();
    });

    test('1: Decodes the payload segment of a well-formed JWT', () => {
      const jwt = fakeJwt({ sub: 'abc123', scope: ['fr:am:*'] });
      expect(decodeJwtPayload(jwt)).toEqual({ sub: 'abc123', scope: ['fr:am:*'] });
    });

    test('2: Decodes a may_act claim', () => {
      const jwt = fakeJwt({ may_act: { client_id: 'AICMCPExchangeClient' } });
      const payload = decodeJwtPayload(jwt);
      expect(payload.may_act).toEqual({ client_id: 'AICMCPExchangeClient' });
    });

    test('3: Throws a FrodoError for a string with too few segments', () => {
      expect(() => decodeJwtPayload('not-a-jwt')).toThrow('Not a valid JWT');
    });

    test('4: Throws a FrodoError when the payload segment is not valid base64url JSON', () => {
      expect(() => decodeJwtPayload('header.not-valid-base64!!!.sig')).toThrow(
        'Error decoding JWT payload'
      );
    });
  });
});
