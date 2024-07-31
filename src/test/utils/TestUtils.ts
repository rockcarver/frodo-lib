import forge from 'node-forge';

let key = '';
key += '-----BEGIN RSA PRIVATE KEY-----\n';
key += 'MIIEpAIBAAKCAQEAng+4KFn/zzksNx9vJj2K6qSDiPqEtsZz3zOhuUZ9O0ot9HFk\n';
key += 'w73tsBwGMbM3RdyB0jIlBPtsxD1z99QKQOXx8Ifl6JWgR84BMFkBtAr8BRj4uzRq\n';
key += 'jcl4qo6UiFkGdcgeBd/ROvmmHpcoe+6IM9cc4pkeTiOlQh2A5PqTO34v042qPpTg\n';
key += 'aKMORArgCiIi1LZ5zM/JKMn5TtL6/T5dokKTJ65bASLMEG8cjSiuqcsfavb0rLnP\n';
key += '/lRyg0sicLHNSqUoHs9fA9j2dQxLi0HOVLQuFlFgxFWOyEomGh2y3OttGbROVWUS\n';
key += '0k2oNNS+3T3U2wjIGtu0Y9pes6UPxanYqUL2TQIDAQABAoIBAAHnSWzTxsTE/TDT\n';
key += 'BC978NkqEyfXG7GTIAsZ6HFxlV7U6qBLAsJ5XjstRVp974U79UbOYOuM33Hhr3Dw\n';
key += 'CFYcm5iC6evZBflph2NnKjMNkALvCY1jDk8tR1B+xQE28pQRiS59ZSjRF02czjMJ\n';
key += 'vejDPqa03wPswAj3ByA/EbqjyMDtqvA7iFfep/bBzmzvPqD4bwhVUTwcFLRpxlHQ\n';
key += 'Ws79QShhTWPO15fsLadtXNSGXlPkVf46R96OV4GQvzNLl81itMKzfqTVS4dpYJIn\n';
key += 'ZMEdE8cm9lMaNnD/dZ3jELXbpMceW+QM2KAp/TaP8A8PgGt2a4oEeC8ixDYyBI6q\n';
key += 'BqHovtECgYEAyivRrwQ30JLxZZEE5dmhRgYQPKNP/74AQ6YjOEiM1PylzjOkaC0q\n';
key += 'SdxsiPwR0FCXa3P39MQSqEGNFoVeChtXlybHb7um0WFw8cc57widpvYGDEhxLszv\n';
key += 'E7k3jCqgGIMn2ZjXb9BchaXtw/pd+iRm+5HTxwtF16rAQ5GwKe4adxkCgYEAyCVW\n';
key += 'HeAh0Luxvb55JI/e3r0LWkd8Mo8DahdHfXzk2NomTdcNVmqabj5Qp86ogCjwLOiH\n';
key += 'TzKpyHhvUALxcrSzcgAchG1P8dXjj1+NygyI2QeY1tjam67slpMmKP3t92j+7qxg\n';
key += 'hn4X6jXIV59zoXw+f9UR+2DmZIjeMirxGUjZI1UCgYAL1vEarMaQAmr8pbeBtnMJ\n';
key += 'ZMWCp5XBxmDBlXMukqEcwAb9wmx4ZVy6opwAkbKBXpbfhhUZUno9PEmE7h6JvPwu\n';
key += 'L+kyE+07CdfRcPdllj2VT4cfJQbr1LiTkR89qClkBhpJVfgX5j3k3cjE1161jXgy\n';
key += 'd2HNoE1gyfEkg92rNvR50QKBgQC/32tLgM9qOEYRTUT91B8pEbqMdfOO1KPFVUPn\n';
key += '/Y+2hIwsG3ph2hjqjzrrZKcNFjIKG3F8b2ltEmhEIE4wVSOiqpCsM89sXEyn6kcX\n';
key += '6CRZS3sunP4WOf/96luu+KDliva7AO4YgVGT6rOBrQ9BRMb17eIrR54Xy06Ycapp\n';
key += 'PvlLcQKBgQDCNhjxMTmZ5nmdgLz/keLMD66UIR0IagN4f/KTI03iAZuXqfXH6Krh\n';
key += 'Etl8aNHPnF047ZhlJWZZ+zKapPZVpIVFtnGN3hKTBga4I/yGz11B9JLX6P1CKOK3\n';
key += '1RO/QYLVcY4EEm+wkmVbpyzQTmAfPOyA3cwC22s4tQn/yXRWkGGSig==\n';
key += '-----END RSA PRIVATE KEY-----';

export function issueSelfSignedCertificate(csrpem: string): string {
  const pki = forge.pki;
  const csr = pki.certificationRequestFromPem(csrpem);
  // eslint-disable-next-line no-console
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
  cert.sign(pki.privateKeyFromPem(key));

  // convert a Forge certificate to PEM
  const certpem = pki.certificateToPem(cert);

  return certpem;
}
