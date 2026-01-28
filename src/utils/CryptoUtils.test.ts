/**
 * Run tests
 *
 *        npm run test:only CryptoUtils
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { convertPrivateKeyToPem } from './CryptoUtils';
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('CryptoUtils', () => {
  describe('convertPrivateKeyToPem()', () => {
    test('0: Method is implemented', async () => {
      expect(convertPrivateKeyToPem).toBeDefined();
    });

    function testSuccess(filename: string, usePassphrase = false) {
      const key = fs.readFileSync(
        path.resolve(
          __dirname,
          `../test/mocks/CryptoUtils/${filename}`
        ),
        'utf8'
      );
      const pem = convertPrivateKeyToPem({
        key, 
        passphrase: usePassphrase ? 'test' : undefined
      });
      expect(pem).toMatchSnapshot();
    }

    test('1: Test not providing a key', () => {
      expect(() => convertPrivateKeyToPem({ key: '' })).toThrow('Private key not provided.');
    });

    test('2: PEM PKCS#1 RSA', () => {
      testSuccess('pkcs1Rsa.pem');
    });

    test('3: PEM PKCS#8 RSA', () => {
      testSuccess('pkcs8Rsa.pem');
    });

    test('4: PEM PKCS#8 DSA', () => {
      testSuccess('pkcs8Dsa.pem');
    });

    test('5: PEM PKCS#8 ECDSA', () => {
      testSuccess('pkcs8Ecdsa.pem');
    });

    test('6: PEM PKCS#8 ED25519', () => {
      testSuccess('pkcs8Ed25519.pem');
    });

    test('7: PEM PKCS#8 ED25519 Encrypted', () => {
      testSuccess('pkcs8Ed25519Enc.pem', true);
    });

    test('8: OpenSSH RSA', () => {
      testSuccess('opensshRsa');
    });

    test('9: OpenSSH ECDSA', () => {
      testSuccess('opensshEcdsa');
    });

    test('10: OpenSSH ED25519', () => {
      testSuccess('opensshEd25519');
    });

    test('11: OpenSSH ED25519 Encrypted', () => {
      testSuccess('opensshEd25519Enc', true);
    });

    test('12: DNSSEC RSASHA512', () => {
      testSuccess('dnssecRsa.private');
    });

    test('13: JWK RSA', () => {
      testSuccess('jwkRsa.jwk');
    });

    test('14: JWK ECDSA', () => {
      testSuccess('jwkEcdsa.jwk');
    });

    // Can't find way to test this yet since it ends the program when it fails
    test.todo('15: Test incorrect passphrase');
  });
});
