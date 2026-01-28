import jwkToPem from 'jwk-to-pem';
import sshpk from 'sshpk';

import { FrodoError } from '../ops/FrodoError';

export type FrodoCrypto = {
  /**
   * Parses a private key and returns it as an unencrypted PKCS#8 PEM encoded string
   * Supported private key formats include:
   * - PEM (both PKCS#1 and PKCS#8 variants)
   * - OpenSSH
   * - DNSSEC
   * - JWK
   * @param {string} key The private key
   * @param {string | undefined} passphrase The passphrase for the private key if it is encrypted
   * @param {string | undefined} name The name of the private key (i.e. the name of the file it came from, if applicable); used for error handling
   * @returns {string} The unencrypted PKCS#8 PEM encoded private key
   */
  convertPrivateKeyToPem(
    key: string,
    passphrase?: string,
    name?: string
  ): string;
};

export default (): FrodoCrypto => {
  return {
    convertPrivateKeyToPem(
      key: string,
      passphrase?: string,
      name?: string
    ): string {
      return convertPrivateKeyToPem({ key, passphrase, name });
    },
  };
};

/**
 * Parses a private key and returns it as an unencrypted PKCS#8 PEM encoded string
 * Supported private key formats include:
 * - PEM (both PKCS#1 and PKCS#8 variants)
 * - OpenSSH
 * - DNSSEC
 * - JWK
 * @param {string} key The private key
 * @param {string | undefined} passphrase The passphrase for the private key if it is encrypted
 * @param {string | undefined} name The name of the private key (i.e. the name of the file it came from, if applicable); used for error handling
 * @returns {string} The unencrypted PKCS#8 PEM encoded private key
 */
export function convertPrivateKeyToPem({
  key,
  passphrase,
  name,
}: {
  key: string;
  passphrase?: string;
  name?: string;
}): string {
  if (!key) {
    throw new FrodoError(`Private key${name ? ` ${name}` : ''} not provided.`);
  }
  // Try converting JWK to PEM PKCS#8 format.
  try {
    const jwk = JSON.parse(key);
    // Need true flag to get the full private key
    return jwkToPem(jwk, { private: true });
  } catch (e) {
    /* Ignore error since private key may still be a supported format */
  }
  // Will automatically detect the format the private key is in and parse it if it is able to
  const privateKey = sshpk.parsePrivateKey(key, 'auto', {
    filename: name,
    passphrase,
  });
  return privateKey.toString('pkcs8');
}
