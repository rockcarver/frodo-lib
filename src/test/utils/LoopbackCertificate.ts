import { createPrivateKey, createPublicKey, webcrypto } from 'crypto';
import {
  BasicConstraintsExtension,
  GeneralName,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
  X509CertificateGenerator,
} from '@peculiar/x509';
import { getPrivateKey, getPublicKey } from './TestUtils';

/**
 * A self-signed certificate for 127.0.0.1, valid for a day, with the key it
 * belongs to, for an HTTPS server a test starts on the loopback interface.
 * The key is the fixed test key of TestUtils, not a secret.
 * @returns {Promise<{ key: string; cert: string }>} the key and the certificate, both PEM
 */
export async function createLoopbackCertificate(): Promise<{
  key: string;
  cert: string;
}> {
  // The signing keys are the fixed test PEMs from TestUtils. @peculiar/x509
  // signs with WebCrypto CryptoKeys, so import the PEMs as PKCS#8/SPKI DER.
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  // The CryptoKey of node:crypto and the global CryptoKey that @peculiar/x509
  // names are the same object at run time and differ only in their typings.
  const signingKey = (await webcrypto.subtle.importKey(
    'pkcs8',
    createPrivateKey(getPrivateKey()).export({ type: 'pkcs8', format: 'der' }),
    alg,
    true,
    ['sign']
  )) as unknown as CryptoKey;
  const publicKey = (await webcrypto.subtle.importKey(
    'spki',
    createPublicKey(getPublicKey()).export({ type: 'spki', format: 'der' }),
    alg,
    true,
    ['verify']
  )) as unknown as CryptoKey;
  const cert = await X509CertificateGenerator.create({
    serialNumber: '01',
    subject: 'CN=127.0.0.1',
    issuer: 'CN=127.0.0.1',
    notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
    notAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
    publicKey,
    signingKey,
    signingAlgorithm: { name: 'RSASSA-PKCS1-v1_5' },
    extensions: [
      new SubjectAlternativeNameExtension([new GeneralName('ip', '127.0.0.1')]),
      new BasicConstraintsExtension(false, undefined, true),
      new KeyUsagesExtension(0x80, true), // digitalSignature
    ],
  });
  return { key: getPrivateKey(), cert: cert.toString('pem') };
}
