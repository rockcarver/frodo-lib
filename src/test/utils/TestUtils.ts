/* eslint-disable no-console */
import { isIP } from 'net';
import forge from 'node-forge';

import { CSR } from '../../api/cloud/EnvCSRsApi';
import { FrodoError } from '../../ops/FrodoError';

const pki = forge.pki;

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

export function getPrivateKey(): string {
  return privateKey;
}

export function getPublicKey(): string {
  return publicKey;
}

export function createSelfSignedCertificate(csr: CSR): string {
  const cert = forge.pki.createCertificate();
  cert.publicKey = pki.publicKeyFromPem(publicKey);
  cert.serialNumber = csr.serialNumber || '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    {
      name: 'commonName',
      value: csr.commonName,
    },
    {
      name: 'countryName',
      value: csr.country,
    },
    {
      shortName: 'ST',
      value: csr.state,
    },
    {
      name: 'localityName',
      value: csr.city,
    },
    {
      name: 'organizationName',
      value: csr.organization,
    },
    {
      shortName: 'OU',
      value: csr.organizationalUnit,
    },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  const ext: any[] = [
    {
      name: 'basicConstraints',
      cA: true /*,
    pathLenConstraint: 4*/,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      emailProtection: true,
      timeStamping: true,
    },
    {
      name: 'nsCertType',
      client: true,
      server: true,
      email: true,
      objsign: true,
      sslCA: true,
      emailCA: true,
      objCA: true,
    },
    {
      name: 'subjectKeyIdentifier',
    },
  ];
  const altNames = [];
  for (const subjectAlternativeName of csr.subjectAlternativeNames) {
    if (isIP(subjectAlternativeName)) {
      altNames.push({
        type: 7, // IP
        ip: subjectAlternativeName,
      });
    } else {
      altNames.push({
        type: 6, // URI
        value: subjectAlternativeName,
      });
    }
  }
  ext.push({
    name: 'subjectAltName',
    altNames,
  });
  cert.setExtensions(ext);
  // FIXME: add authorityKeyIdentifier extension

  // self-sign certificate
  cert.sign(pki.privateKeyFromPem(privateKey));

  // PEM-format keys and cert
  const pem = forge.pki.certificateToPem(cert);

  return pem;
}

export function issueSelfSignedCertificate(csrpem: string): string {
  const csr = pki.certificationRequestFromPem(csrpem);
  // console.debug(`subject attributes:`, csr.subject);

  const cert = pki.createCertificate();
  cert.publicKey = csr.publicKey;

  // serial number from csr
  cert.serialNumber = csr.subject.getField({ name: 'serialNumber' }).value;

  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  // set subject and issuer from a csr
  cert.setSubject(csr.subject.attributes);
  cert.setIssuer(csr.subject.attributes);

  // set extensions from csr
  const extensions = csr.getAttribute({ name: 'extensionRequest' }).extensions;

  // optionally add more extensions
  extensions.push.apply(extensions, [
    {
      name: 'basicConstraints',
      cA: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
  ]);
  cert.setExtensions(extensions);

  // self-sign certificate
  cert.sign(pki.privateKeyFromPem(privateKey));

  // convert a Forge certificate to PEM
  const certpem = pki.certificateToPem(cert);

  return certpem;
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
    expect(error.getCombinedMessage()).toMatchSnapshot();
  }
}
