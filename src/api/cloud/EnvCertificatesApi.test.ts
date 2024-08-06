/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record EnvCertificatesApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CSR test objects (cert1, cert2, cert3, etc)
 *
 *    After successful recording, look for the following console output:
 *
 *    *****************************************************************
 *    *** ATTENTION: UPDATE cert test objects before running tests! ***
 *    *****************************************************************
 *
 *    cert1.id:          0143d649-0995-49be-9133-ad1763c2ac93
 *
 *    cert2.id:          9b1c9774-1caa-4fc0-a640-fb40930f2f33
 *
 *    cert3.id:          387204c1-0f9b-43bb-a832-e226001d7741
 *
 *    cert4.certificate: "-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----\r\n"
 *
 *    cert5.certificate: "-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----\r\n"
 *
 *    *****************************************************************
 *
 *    Then find the test objects listed in the output in the code below and
 *    update the respective properties as indicated.
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EnvCertificatesApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvCertificatesApi from './EnvCertificatesApi';
import * as EnvCertificatesOps from '../../ops/cloud/EnvCertificatesOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import { encode } from '../../utils/Base64Utils';
import { stringify } from '../../utils/JsonUtils';
import {
  createSelfSignedCertificate,
  getPrivateKey,
  printError,
} from '../../test/utils/TestUtils';
import { CSR } from './EnvCSRsApi';

const ctx = autoSetupPolly();

type TestCertificate = {
  id: string;
  _stagingId?: string;
  csr: CSR;
  certificate: string;
  _stagingCertificate?: string;
  privateKey: string;
  active: boolean;
};

async function stageCertificate(cert: TestCertificate, create = true) {
  // delete if exists, then create
  try {
    if (cert._stagingId) {
      await EnvCertificatesApi.getCertificate({
        certificateId: cert._stagingId,
        state,
      });
      try {
        await EnvCertificatesOps.deleteCertificate({
          certificateId: cert._stagingId,
          force: true,
          state,
        });
      } catch (error) {
        console.debug('error staging certificate', error);
      }
    }
  } catch (error) {
    // ignore
  } finally {
    if (!cert._stagingCertificate)
      cert._stagingCertificate = createSelfSignedCertificate(cert.csr);
    if (create) {
      try {
        const certificate = await EnvCertificatesApi.createCertificate({
          active: cert.active,
          certificate: cert._stagingCertificate,
          privateKey: cert.privateKey,
          state,
        });
        cert._stagingId = certificate.id;
      } catch (error) {
        console.debug('error staging certificate', error);
      }
    }
  }
}

describe('EnvCertificatesApi', () => {
  const cert1: TestCertificate = {
    id: 'ccrt-663eca03-10c3-4ad2-96b8-6ab83c4aea2d',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev1.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '01',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev1-alt1.mytestrun.com',
        'frodo-dev1-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert2: TestCertificate = {
    id: 'ccrt-47fe3bf4-f788-4f9c-a7e4-ecdf710eb20d',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev2.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '02',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev2-alt1.mytestrun.com',
        'frodo-dev2-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert3: TestCertificate = {
    id: 'ccrt-e04aa493-b822-4765-8cb2-0e45d32a91d8',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev3.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '03',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev3-alt1.mytestrun.com',
        'frodo-dev3-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert4: TestCertificate = {
    id: 'esv-frodo-test-certificate4',
    certificate:
      '-----BEGIN CERTIFICATE-----\r\nMIIEWDCCA0CgAwIBAgIBBDANBgkqhkiG9w0BAQUFADCBgjEhMB8GA1UEAxMYZnJv\r\nZG8tZGV2NC5teXRlc3RydW4uY29tMQswCQYDVQQGEwJVUzEOMAwGA1UECBMFVGV4\r\nYXMxEzARBgNVBAcTCkdlb3JnZXRvd24xEzARBgNVBAoTClJvY2tjYXJ2ZXIxFjAU\r\nBgNVBAsTDUZyb2RvIExpYnJhcnkwHhcNMjQwODAxMjIwMTU0WhcNMjUwODAxMjIw\r\nMTU0WjCBgjEhMB8GA1UEAxMYZnJvZG8tZGV2NC5teXRlc3RydW4uY29tMQswCQYD\r\nVQQGEwJVUzEOMAwGA1UECBMFVGV4YXMxEzARBgNVBAcTCkdlb3JnZXRvd24xEzAR\r\nBgNVBAoTClJvY2tjYXJ2ZXIxFjAUBgNVBAsTDUZyb2RvIExpYnJhcnkwggEiMA0G\r\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCb+RhCddeVYR/1eSZ5KiVy4FZiSJ5J\r\nzJA7x4+rb74aZlIrLf4n0KUI+KA+r7LzJwUtL/O1AaLP/Ysq86UXO/eeZ/ENevbU\r\n2sxiipTJext/4xchaJ/2H1qR4dd46w3Kmd+dgdn0rtpxAZrn/IyzGbw+W8IHOd5A\r\n/CSwLeFfNLSjK7iNr4nn44wOoLLMs735Ph/MQ4hYHzc3KZfHmgmjXTHiOTym1vvq\r\ndkQsfPbC7RI9kdYw6nzE4Z3uHRAQiqppyEQABK9ICuk1bEDNXflqOMg5fITmi6O5\r\nZtXq3DS2cpezeieVG6Yf8t8RG/cLC76rjJhgsytWQIktHv6iHCqzdhQfAgMBAAGj\r\ngdYwgdMwDAYDVR0TBAUwAwEB/zALBgNVHQ8EBAMCAvQwOwYDVR0lBDQwMgYIKwYB\r\nBQUHAwEGCCsGAQUFBwMCBggrBgEFBQcDAwYIKwYBBQUHAwQGCCsGAQUFBwMIMBEG\r\nCWCGSAGG+EIBAQQEAwIA9zAdBgNVHQ4EFgQUuXDOI1fgV3fDMlLMmiUxcRaBkekw\r\nRwYDVR0RBEAwPoYdZnJvZG8tZGV2NC1hbHQxLm15dGVzdHJ1bi5jb22GHWZyb2Rv\r\nLWRldjQtYWx0Mi5teXRlc3RydW4uY29tMA0GCSqGSIb3DQEBBQUAA4IBAQBKopID\r\nQ8/TMCWD4ziFIl2nuYIpFDrKM8IdSLMCJjSbdqkMJFNqRPFUNwQL59jQ/RWJdlwD\r\ndacXa+1knkB5O9jHmDvmowN6z5GrjlCWnoObA1U3nvW1eJl9LB0DRpyqkE/Ubg15\r\nypDCvovKxiZHs9AoEX2HE2jzZMKQtwQCL87vxQS3IjG9G8OuRoFITaP8KDwk1crW\r\n6F0flDqH7drmC/fD13xUhlaqolC1Me4c9zyfMCBuDA5y84dcVkH4dQ74L1BXIAqm\r\nbJdNEfpa1QviYnefYr61gowZl4pjHW+rF33EgXj3HgOI8ZtYhgTxdmHh76j9ykL0\r\nvgs8Vqi6QXNdNkJd\r\n-----END CERTIFICATE-----\r\n',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev4.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '04',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev4-alt1.mytestrun.com',
        'frodo-dev4-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert5: TestCertificate = {
    id: 'esv-frodo-test-certificate5',
    certificate:
      '-----BEGIN CERTIFICATE-----\r\nMIIEWDCCA0CgAwIBAgIBBTANBgkqhkiG9w0BAQUFADCBgjEhMB8GA1UEAxMYZnJv\r\nZG8tZGV2NS5teXRlc3RydW4uY29tMQswCQYDVQQGEwJVUzEOMAwGA1UECBMFVGV4\r\nYXMxEzARBgNVBAcTCkdlb3JnZXRvd24xEzARBgNVBAoTClJvY2tjYXJ2ZXIxFjAU\r\nBgNVBAsTDUZyb2RvIExpYnJhcnkwHhcNMjQwODAxMjIwMTU0WhcNMjUwODAxMjIw\r\nMTU0WjCBgjEhMB8GA1UEAxMYZnJvZG8tZGV2NS5teXRlc3RydW4uY29tMQswCQYD\r\nVQQGEwJVUzEOMAwGA1UECBMFVGV4YXMxEzARBgNVBAcTCkdlb3JnZXRvd24xEzAR\r\nBgNVBAoTClJvY2tjYXJ2ZXIxFjAUBgNVBAsTDUZyb2RvIExpYnJhcnkwggEiMA0G\r\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCb+RhCddeVYR/1eSZ5KiVy4FZiSJ5J\r\nzJA7x4+rb74aZlIrLf4n0KUI+KA+r7LzJwUtL/O1AaLP/Ysq86UXO/eeZ/ENevbU\r\n2sxiipTJext/4xchaJ/2H1qR4dd46w3Kmd+dgdn0rtpxAZrn/IyzGbw+W8IHOd5A\r\n/CSwLeFfNLSjK7iNr4nn44wOoLLMs735Ph/MQ4hYHzc3KZfHmgmjXTHiOTym1vvq\r\ndkQsfPbC7RI9kdYw6nzE4Z3uHRAQiqppyEQABK9ICuk1bEDNXflqOMg5fITmi6O5\r\nZtXq3DS2cpezeieVG6Yf8t8RG/cLC76rjJhgsytWQIktHv6iHCqzdhQfAgMBAAGj\r\ngdYwgdMwDAYDVR0TBAUwAwEB/zALBgNVHQ8EBAMCAvQwOwYDVR0lBDQwMgYIKwYB\r\nBQUHAwEGCCsGAQUFBwMCBggrBgEFBQcDAwYIKwYBBQUHAwQGCCsGAQUFBwMIMBEG\r\nCWCGSAGG+EIBAQQEAwIA9zAdBgNVHQ4EFgQUuXDOI1fgV3fDMlLMmiUxcRaBkekw\r\nRwYDVR0RBEAwPoYdZnJvZG8tZGV2NS1hbHQxLm15dGVzdHJ1bi5jb22GHWZyb2Rv\r\nLWRldjUtYWx0Mi5teXRlc3RydW4uY29tMA0GCSqGSIb3DQEBBQUAA4IBAQBTPUkn\r\nXb74ApXmZXrPCRm36/Y1OApWF5CB4trarVMZqibjKL7IBb1YffAu8nxNoFYjpV05\r\nHBWYn+bDFyiWsSKkmN45Bki39/psZk7YM0LzbTjiew9eMIbFjrxIPiavVnxVuGJY\r\nl/Kjo2tqJeTnLg0VAq+jJ5jF2PdNJ6ygpicJ6Mt4Znl5QtD3KETRYpXlmZfWuXF3\r\npG3HY9GnPucvPrMRLqt2RJFv1dXOTJdKLK8M+RoQvqJprRyqSos6Hz9nwBNpzCDW\r\n8zsNw1vOjEQi3BCvqhyEm3B2018z1W//vgoIz1LYe1gxbddW+gnMY2RquWT85sKp\r\nZgFNqeQQTADYfAcT\r\n-----END CERTIFICATE-----\r\n',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev5.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '05',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev5-alt1.mytestrun.com',
        'frodo-dev5-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await Promise.allSettled([
        stageCertificate(cert1, true),
        stageCertificate(cert2, true),
        stageCertificate(cert3, true),
        stageCertificate(cert4, false),
        stageCertificate(cert5, false),
      ]);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await Promise.allSettled([
        stageCertificate(cert1, false),
        stageCertificate(cert2, false),
        stageCertificate(cert3, false),
        stageCertificate(cert4, false),
        stageCertificate(cert5, false),
      ]);

      console.debug(`\
*****************************************************************\n\
*** ATTENTION: UPDATE cert test objects before running tests! ***\n\
*****************************************************************\n\

cert1.id:          ${cert1._stagingId}\n\

cert2.id:          ${cert2._stagingId}\n\

cert3.id:          ${cert3._stagingId}\n\

cert4.certificate: ${stringify(cert4._stagingCertificate)}\n\

cert5.certificate: ${stringify(cert5._stagingCertificate)}\n\

*****************************************************************`);
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('getCertificates()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCertificatesApi.getCertificates).toBeDefined();
    });

    test('1: Get all certificates - success', async () => {
      const response = await EnvCertificatesApi.getCertificates({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getCertificate()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCertificatesApi.getCertificate).toBeDefined();
    });

    test(`1: Get existing certificate - success`, async () => {
      const response = await EnvCertificatesApi.getCertificate({
        certificateId: cert1._stagingId || cert1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing certificate - error', async () => {
      try {
        await EnvCertificatesApi.getCertificate({
          certificateId: 'esv-does-not-exist',
          state,
        });
        fail('request should have failed');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('createCertificate()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCertificatesApi.createCertificate).toBeDefined();
    });

    test(`1: Create new certificate (inactive) - success`, async () => {
      try {
        const response = await EnvCertificatesApi.createCertificate({
          active: cert4.active,
          certificate: cert4._stagingCertificate || cert4.certificate,
          privateKey: cert4.privateKey,
          state,
        });
        cert4._stagingId = response.id;
        expect(response).toMatchSnapshot();
      } catch (error) {
        printError(error);
        fail('request should have succeeded');
      }
    });

    test(`2: Create new certificate (active) - success`, async () => {
      try {
        const response = await EnvCertificatesApi.createCertificate({
          active: cert5.active,
          certificate: cert5._stagingCertificate || cert5.certificate,
          privateKey: cert5.privateKey,
          state,
        });
        cert5._stagingId = response.id;
        expect(response).toMatchSnapshot();
      } catch (error) {
        printError(error);
        fail('request should have succeeded');
      }
    });
  });

  describe('updateCertificate()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCertificatesApi.updateCertificate).toBeDefined();
    });

    test(`1: Activate existing certificate - success`, async () => {
      const response = await EnvCertificatesApi.updateCertificate({
        certificateId: cert2._stagingId || cert2.id,
        active: true,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Activate non-existing certificate - error', async () => {
      expect.assertions(1);
      try {
        await EnvCertificatesApi.updateCertificate({
          certificateId: 'certificate-does-not-exist',
          active: true,
          state,
        });
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deleteCertificate()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCertificatesApi.deleteCertificate).toBeDefined();
    });

    test(`1: Delete existing certificate - success`, async () => {
      const response = await EnvCertificatesApi.deleteCertificate({
        certificateId: cert3._stagingId || cert3.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test('2: Delete non-existing certificate - success', async () => {
      try {
        const response = await EnvCertificatesApi.deleteCertificate({
          certificateId: 'certificate-does-not-exist',
          state,
        });
        expect(response).toMatchSnapshot();
      } catch (error) {
        fail(
          'request should have succeeded - current API returns a 200OK when deleting non-existing resources'
        );
      }
    });
  });
});
