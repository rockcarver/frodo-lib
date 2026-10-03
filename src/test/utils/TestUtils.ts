/* eslint-disable no-console */
import { createPrivateKey, createPublicKey, webcrypto } from 'crypto';
import { isIP } from 'net';
import 'reflect-metadata';
import {
  BasicConstraintsExtension,
  ExtendedKeyUsageExtension,
  GeneralName,
  KeyUsagesExtension,
  Pkcs10CertificateRequest,
  SubjectAlternativeNameExtension,
  SubjectKeyIdentifierExtension,
  X509CertificateGenerator,
} from '@peculiar/x509';
import { CSR } from '../../api/cloud/EnvCSRsApi';
import { FrodoError } from '../../ops/FrodoError';

const privateKey =
  '-----BEGIN RSA PRIVATE KEY-----\r\n' +
  'MIIEogIBAAKCAQEAm/kYQnXXlWEf9XkmeSolcuBWYkieScyQO8ePq2++GmZSKy3+\r\n' +
  'J9ClCPigPq+y8ycFLS/ztQGiz/2LKvOlFzv3nmfxDXr21NrMYoqUyXsbf+MXIWif\r\n' +
  '9h9akeHXeOsNypnfnYHZ9K7acQGa5/yMsxm8PlvCBzneQPwksC3hXzS0oyu4ja+J\r\n' +
  '5+OMDqCyzLO9+T4fzEOIWB83NymXx5oJo10x4jk8ptb76nZELHz2wu0SPZHWMOp8\r\n' +
  'xOGd7h0QEIqqachEAASvSArpNWxAzV35ajjIOXyE5oujuWbV6tw0tnKXs3onlRum\r\n' +
  'H/LfERv3Cwu+q4yYYLMrVkCJLR7+ohwqs3YUHwIDAQABAoIBABoor1xqJjOL/A+v\r\n' +
  '93dnzasUG/jU5BNNhz03bY2bqp8D3TEXwCIOWLeF9148Gn+0YiZfffi0IwnOJLqZ\r\n' +
  '7WzVpmR/W0re/inZ3mCCjIy0JHsQ666zPOzK+mYwIfLKPWBm6T2h6xuh/cnpMoFI\r\n' +
  '9pINNWih/As5NeDhSQfxUfSlQsyAxALzoR08GA+exNnMShMHiQs9dPPDFjk5Jsjn\r\n' +
  '/sJ+fnr/YT2zcQe7FjMfBY1nmH/dv+TvNi+BueWly6S93cZFxM6iZ/IuUT/e6P0L\r\n' +
  'q05oEdxMOgh3ZPdl0PucZkJusc+n9SWxqGB1DPyT/mp+7GpMTlCnKDNAoGWEuEHM\r\n' +
  '6I/OSqECgYEA1SJby8dHAMmA2h9LwcMp2vu7HIp7kOT5K5DFRXrLYicQGcCp6l+Q\r\n' +
  'pKvzUPAFAsomRChQcQu7DnqtaNaUtDTEr4lt9jxQVVxj01NiPqYecF0HqTuuwzqM\r\n' +
  'ihHjktHkGxMNcE/zaiqXOdmyPEUND24G2eUIj861nTzmb0KwDj3BkqECgYEAu1et\r\n' +
  'mMWw+YjzcXx7Ey4cdyascod5nDqcNkWCaAhCaflfm5b7u79Ga8HFFOYnH0oYvhhp\r\n' +
  '5qycUgxA9c72hTV6kgUcg7g8sVpN6zZmz+aNgnaFyGDSwjjwY+uSVLYUvZOJ5GF4\r\n' +
  'ua3YczVROlZC57cVTjMO6Zcmx5n5AUCU34a47r8CgYBv3PmrCauFiT0cvoJHb0Rf\r\n' +
  'j/HT+AcEtHjm2bQAVIO8v13e9lT4EzJai3lISMGIhkrxSOt3eb2yysaLGNyxfGSi\r\n' +
  '8RGKxHsxYi1us/wDf7LILLuhohaGlws+SEdWPt1nLGfIQ94xIat/jHfU1DUXnRrx\r\n' +
  'cBk/STHfFiCn0quOvfEEIQKBgDUvyTssNPhDJ0o62v4xAyfYtPC3AZGXGi5WQZWj\r\n' +
  'cqd/guM7VDCTNzz0gC1UwhqiALBHYhl5O9AXZoHixh4/dpLqHJRQw/pd9u0mPr4b\r\n' +
  'aGV3nLestWkqnSThBmRCZVUFBArwmUOt1Vuv8WWsg8YhNk1DNaKfpQTZ89WlLh7f\r\n' +
  'srUlAoGAB1v7XQtrpczNCzqr3bgLpIpXMZ7y6IxNkKmkHfjnHxPBMxfAdqTxRx1w\r\n' +
  'rWEvwlOUqzgWTxCG9DiPl1cTIrY3l20WS25D+nqAQkYJcvUfdcz/oCPQFmtRHbpr\r\n' +
  'ZbGLhu2hrCr7NLXdnUC45bSnJrrRhyHwnVr3qqEz4XfjpJJjDAo=\r\n' +
  '-----END RSA PRIVATE KEY-----\r\n';
const publicKey =
  '-----BEGIN PUBLIC KEY-----\r\n' +
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm/kYQnXXlWEf9XkmeSol\r\n' +
  'cuBWYkieScyQO8ePq2++GmZSKy3+J9ClCPigPq+y8ycFLS/ztQGiz/2LKvOlFzv3\r\n' +
  'nmfxDXr21NrMYoqUyXsbf+MXIWif9h9akeHXeOsNypnfnYHZ9K7acQGa5/yMsxm8\r\n' +
  'PlvCBzneQPwksC3hXzS0oyu4ja+J5+OMDqCyzLO9+T4fzEOIWB83NymXx5oJo10x\r\n' +
  '4jk8ptb76nZELHz2wu0SPZHWMOp8xOGd7h0QEIqqachEAASvSArpNWxAzV35ajjI\r\n' +
  'OXyE5oujuWbV6tw0tnKXs3onlRumH/LfERv3Cwu+q4yYYLMrVkCJLR7+ohwqs3YU\r\n' +
  'HwIDAQAB\r\n' +
  '-----END PUBLIC KEY-----\r\n';

// WebCrypto key pair imported from the fixed PEM keys above, created once
// (the PKCS#1 private key is converted to PKCS#8 DER via node:crypto first,
// since WebCrypto only imports PKCS#8).
let webCryptoKeys: {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
} | null = null;

async function getWebCryptoKeys(): Promise<{
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
}> {
  if (!webCryptoKeys) {
    const nodePrivateKey = createPrivateKey(privateKey);
    const nodePublicKey = createPublicKey(publicKey);
    const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    webCryptoKeys = {
      privateKey: await webcrypto.subtle.importKey(
        'pkcs8',
        nodePrivateKey.export({ type: 'pkcs8', format: 'der' }),
        alg,
        true,
        ['sign']
      ),
      publicKey: await webcrypto.subtle.importKey(
        'spki',
        nodePublicKey.export({ type: 'spki', format: 'der' }),
        alg,
        true,
        ['verify']
      ),
    };
  }
  return webCryptoKeys;
}

export function getPrivateKey(): string {
  return privateKey;
}

export function getPublicKey(): string {
  return publicKey;
}

/**
 * Builds the RFC 4514 subject string from a CSR, matching the attribute set
 * the forge-based implementation produced (commonName, countryName, state,
 * locality, organization, organizationalUnit).
 */
function csrToSubjectString(csr: CSR): string {
  const attrs: string[] = [];
  if (csr.commonName) attrs.push(`CN=${csr.commonName}`);
  if (csr.country) attrs.push(`C=${csr.country}`);
  if (csr.state) attrs.push(`ST=${csr.state}`);
  if (csr.city) attrs.push(`L=${csr.city}`);
  if (csr.organization) attrs.push(`O=${csr.organization}`);
  if (csr.organizationalUnit) attrs.push(`OU=${csr.organizationalUnit}`);
  return attrs.join(', ');
}

/**
 * Maps the CSR's subjectAlternativeNames to GeneralNames. IP addresses use
 * the "ip" type, everything else is treated as a DNS/URI-style name.
 */
function sanExtensionsFromCsr(csr: CSR): SubjectAlternativeNameExtension[] {
  if (!csr.subjectAlternativeNames?.length) return [];
  return [
    new SubjectAlternativeNameExtension(
      csr.subjectAlternativeNames.map((san) =>
        isIP(san) ? new GeneralName('ip', san) : new GeneralName('dns', san)
      )
    ),
  ];
}

export async function createSelfSignedCertificate(csr: CSR): Promise<string> {
  const keys = (await getWebCryptoKeys()) as unknown as CryptoKeyPair;
  const signingAlgorithm = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: csr.serialNumber || '01',
    name: csrToSubjectString(csr),
    notBefore: new Date(),
    notAfter: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    keys,
    signingAlgorithm,
    extensions: [
      new BasicConstraintsExtension(true, undefined, true),
      new KeyUsagesExtension(
        // keyCertSign | digitalSignature | nonRepudiation | keyEncipherment |
        // dataEncipherment
        0x01 | 0x80 | 0x40 | 0x20 | 0x10,
        true
      ),
      new ExtendedKeyUsageExtension([
        '1.3.6.1.5.5.7.3.1', // serverAuth
        '1.3.6.1.5.5.7.3.2', // clientAuth
        '1.3.6.1.5.5.7.3.3', // codeSigning
        '1.3.6.1.5.5.7.3.4', // emailProtection
        '1.3.6.1.5.5.7.3.8', // timeStamping
      ]),
      await SubjectKeyIdentifierExtension.create(keys.publicKey),
      ...sanExtensionsFromCsr(csr),
    ],
  });
  return cert.toString('pem');
}

export async function issueSelfSignedCertificate(
  csrpem: string
): Promise<string> {
  const csr = new Pkcs10CertificateRequest(csrpem);
  const keys = await getWebCryptoKeys();
  const cert = await X509CertificateGenerator.create({
    serialNumber: '01',
    subject: csr.subject.toString(),
    issuer: csr.subject.toString(),
    notBefore: new Date(),
    notAfter: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    publicKey: csr.publicKey,
    signingKey: keys.privateKey as unknown as CryptoKey,
    signingAlgorithm: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    extensions: [
      ...csr.extensions,
      new BasicConstraintsExtension(true, undefined, true),
      new KeyUsagesExtension(
        // keyCertSign | digitalSignature | nonRepudiation | keyEncipherment |
        // dataEncipherment
        0x01 | 0x80 | 0x40 | 0x20 | 0x10,
        true
      ),
    ],
  });
  return cert.toString('pem');
}

/**
 * Prints an error message from an error object and an optional custom message
 *
 * @param error error object
 */
export function printError(error: Error, message?: string) {
  if (message) console.debug('' + message);
  switch (error.name) {
    case 'FrodoError':
      console.debug('' + (error as FrodoError).getCombinedMessage());
      console.debug(error.stack);
      break;

    case 'AxiosError': {
      const code = error['code'];
      const status = error['response'] ? error['response'].status : null;
      const message = error['response']
        ? error['response'].data
          ? error['response'].data.message
          : null
        : null;
      const detail = error['response']
        ? error['response'].data
          ? error['response'].data.detail
          : null
        : null;
      let errorMessage = 'HTTP client error';
      errorMessage += code ? `\n  Code: ${code}` : '';
      errorMessage += status ? `\n  Status: ${status}` : '';
      errorMessage += message ? `\n  Message: ${message}` : '';
      errorMessage += detail ? `\n  Detail: ${detail}` : '';
      console.debug(errorMessage);
      break;
    }

    default:
      console.debug(error.message);
      break;
  }
}

export function snapshotResultCallback(error: FrodoError) {
  if (error) {
    if (typeof error.getCombinedMessage === 'function') {
      expect(error.getCombinedMessage()).toMatchSnapshot();
    } else {
      throw new FrodoError(
        'TESTING ERROR: Expected a FrodoError, but got a different error.\nMessage: ' +
          error.message
      );
    }
  }
}
