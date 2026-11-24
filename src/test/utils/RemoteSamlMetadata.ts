/**
 * Metadata XML of a remote SAML identity provider, in the shape the server
 * returns it, for tests of the metadata export.
 *
 * The server puts whitespace-only lines between two lines of markup: inside
 * `ds:KeyInfo` before `<ds:X509Data>` and inside `EncryptionMethod` before
 * `<ds:DigestMethod>` and `<xenc:KeySize>`. This builder writes that many such
 * lines (16 spaces each). The entity id, the certificate text and the
 * locations are made up.
 */

export type RemoteIdpMetadataOptions = {
  /**
   * One entry per signing key descriptor: the number of whitespace-only lines
   * before `<ds:X509Data>` in its `ds:KeyInfo`.
   */
  keyInfoBlankLines: number[];
  /**
   * When given, the metadata has an encryption key descriptor, and this is
   * the number of whitespace-only lines before `<ds:DigestMethod>` and before
   * `<xenc:KeySize>` in its `EncryptionMethod`.
   */
  encryptionBlankLines?: number;
  /** true to wrap the document in a (made up) `ds:Signature` element */
  signed?: boolean;
  /** the line ending, `\n` by default */
  eol?: string;
};

/** the certificate text lines of the made up certificates */
export const FAKE_CERTIFICATE_LINES = [
  'EXAMPLEFAKECERTIFICATELINEONEEXAMPLEFAKECERTIFICATELINEONE',
  'EXAMPLEFAKECERTIFICATELINETWOEXAMPLEFAKECERTIFICATELINETWO',
  'EXAMPLEFAKE',
];

const pad = (n: number) => ' '.repeat(n);

/** `count` whitespace-only lines of 16 spaces */
function blankLines(count: number): string[] {
  return Array.from({ length: count }, () => pad(16));
}

function keyInfo(blankBeforeX509Data: number): string[] {
  return [
    `${pad(12)}<ds:KeyInfo>`,
    ...blankLines(blankBeforeX509Data),
    `${pad(16)}<ds:X509Data>`,
    `${pad(20)}<ds:X509Certificate>`,
    ...FAKE_CERTIFICATE_LINES,
    `${pad(20)}</ds:X509Certificate>`,
    `${pad(16)}</ds:X509Data>`,
    `${pad(12)}</ds:KeyInfo>`,
  ];
}

/**
 * Build the metadata XML of a remote identity provider.
 * @param {RemoteIdpMetadataOptions} options how many whitespace-only lines to write where
 * @returns {string} the metadata XML
 */
export function remoteIdpMetadata({
  keyInfoBlankLines,
  encryptionBlankLines,
  signed = false,
  eol = '\n',
}: RemoteIdpMetadataOptions): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<EntityDescriptor entityID="https://idp.example.com/saml2" ID="_example-id" xmlns="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xenc="http://www.w3.org/2001/04/xmlenc#">',
  ];
  if (signed) {
    lines.push(
      `${pad(4)}<ds:Signature>`,
      `${pad(8)}<ds:SignedInfo>`,
      `${pad(12)}<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>`,
      `${pad(8)}</ds:SignedInfo>`,
      `${pad(8)}<ds:SignatureValue>EXAMPLEFAKESIGNATUREVALUE</ds:SignatureValue>`,
      `${pad(4)}</ds:Signature>`
    );
  }
  lines.push(
    `${pad(4)}<IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`
  );
  for (const blank of keyInfoBlankLines) {
    lines.push(
      `${pad(8)}<KeyDescriptor use="signing">`,
      ...keyInfo(blank),
      `${pad(8)}</KeyDescriptor>`
    );
  }
  if (encryptionBlankLines !== undefined) {
    lines.push(
      `${pad(8)}<KeyDescriptor use="encryption">`,
      ...keyInfo(0),
      `${pad(12)}<EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p">`,
      ...blankLines(encryptionBlankLines),
      `${pad(16)}<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>`,
      ...blankLines(encryptionBlankLines),
      `${pad(16)}<xenc:KeySize>256</xenc:KeySize>`,
      `${pad(12)}</EncryptionMethod>`,
      `${pad(8)}</KeyDescriptor>`
    );
  }
  lines.push(
    `${pad(8)}<SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso"/>`,
    `${pad(4)}</IDPSSODescriptor>`,
    '</EntityDescriptor>',
    ''
  );
  return lines.join(eol);
}

/**
 * Metadata XML of a hosted provider: the server adds no whitespace-only lines.
 * @returns {string} the metadata XML
 */
export function hostedSpMetadata(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<EntityDescriptor entityID="https://sp.example.com/saml2" xmlns="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
    `${pad(4)}<SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`,
    `${pad(8)}<KeyDescriptor use="signing">`,
    ...keyInfo(0),
    `${pad(8)}</KeyDescriptor>`,
    `${pad(8)}<AssertionConsumerService index="0" isDefault="true" Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://sp.example.com/acs"/>`,
    `${pad(4)}</SPSSODescriptor>`,
    '</EntityDescriptor>',
    '',
  ].join('\n');
}
