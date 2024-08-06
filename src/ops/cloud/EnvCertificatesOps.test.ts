/**
 * To record and update snapshots, you must perform 4 steps in order:
 *
 * 1. Record API responses & create/update snapshots
 *
 *    This step breaks down into 4 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *    Phase 2: Record Group 1 of DESTRUCTIVE tests - Delete all inactive certs
 *    Phase 3: Record Group 2 of DESTRUCTIVE tests - Delete all active certs
 *    Phase 4: Record Group 3 of DESTRUCTIVE tests - Force delete all active certs
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    To record and create/update snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record EnvCertificatesOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE CERTIFICATES!!!
 *
 *        FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record EnvCertificatesOps
 *        FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record EnvCertificatesOps
 *        FRODO_RECORD_PHASE=4 FRODO_HOST=frodo-dev npm run test:record EnvCertificatesOps
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CSR test objects (cert1, cert2, cert3, etc)
 *
 *    After successful recording, look for the following console output from each phase:
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
 * 3. Update snapshots
 *
 *    After recording in all phases, only the snapshots from the last phase
 *    will still be there and you must manually create/update snapshots for
 *    all phases by running:
 *
 *        npm run test:update EnvCertificatesOps
 *
 * 4. Test your changes
 *
 *    If 1 and 3 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only EnvCertificatesOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvCertificatesApi from '../../api/cloud/EnvCertificatesApi';
import * as EnvCertificatesOps from './EnvCertificatesOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import {
  defaultMatchRequestsBy,
  filterRecording,
} from '../../utils/PollyUtils';
import { state } from '../../index';
import { stringify } from '../../utils/JsonUtils';
import {
  createSelfSignedCertificate,
  getPrivateKey,
  printError,
} from '../../test/utils/TestUtils';
import { CSR } from '../../api/cloud/EnvCSRsApi';

const matchRequestsBy = defaultMatchRequestsBy(true);
matchRequestsBy.order = true;
const ctx = autoSetupPolly(matchRequestsBy);

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
  console.debug(`staging cert ${cert.id}`);
  // delete if exists, then create
  try {
    if (cert._stagingId) {
      console.debug(`cleaning-up cert ${cert.id} start`);
      await EnvCertificatesApi.getCertificate({
        certificateId: cert._stagingId,
        state,
      });
      try {
        await EnvCertificatesOps.deleteCertificate({
          certificateId: cert._stagingId,
          force: true,
          // a bit hacky but appers to be working: record with default interval of 5000ms, run tests with interval of 10ms so tests run faster
          interval: process.env.FRODO_POLLY_MODE === 'record' ? 5000 : 10,
          state,
        });
      } catch (error) {
        console.debug(`error cleaning-up cert ${cert.id}`, error);
      }
      console.debug(`cleaning-up cert ${cert.id} end`);
    }
  } catch (error) {
    // ignore
  } finally {
    if (!cert._stagingCertificate)
      cert._stagingCertificate = createSelfSignedCertificate(cert.csr);
    if (create) {
      console.debug(`creating cert ${cert.id} start`);
      try {
        const certificate = await EnvCertificatesOps.createCertificate({
          active: cert.active,
          certificate: cert._stagingCertificate,
          privateKey: cert.privateKey,
          wait: true,
          // a bit hacky but appers to be working: record with default interval of 5000ms, run tests with interval of 10ms so tests run faster
          interval: process.env.FRODO_POLLY_MODE === 'record' ? 5000 : 10,
          state,
        });
        cert._stagingId = certificate.id;
      } catch (error) {
        console.debug(`error creating cert ${cert.id}`, error);
      }
      console.debug(`creating cert ${cert.id} end`);
    }
  }
}

describe('EnvCertificatesOps', () => {
  const cert1: TestCertificate = {
    id: 'ccrt-cfa8ea7d-3917-46a4-9b89-a05164b03233',
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
    id: 'ccrt-117a46d7-2504-4667-83ca-b11543c7909c',
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
    id: 'ccrt-d4a09ab8-c0ed-4310-9618-6cf3122386a2',
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
      '-----BEGIN CERTIFICATE-----\r\nMIIEWDCCA0CgAwIBAgIBBDANBgkqhkiG9w0BAQUFADCBgjEhMB8GA1UEAxMYZnJv\r\nZG8tZGV2NC5teXRlc3RydW4uY29tMQswCQYDVQQGEwJVUzEOMAwGA1UECBMFVGV4\r\nYXMxEzARBgNVBAcTCkdlb3JnZXRvd24xEzARBgNVBAoTClJvY2tjYXJ2ZXIxFjAU\r\nBgNVBAsTDUZyb2RvIExpYnJhcnkwHhcNMjQwODA2MDI0ODI3WhcNMjUwODA2MDI0\r\nODI3WjCBgjEhMB8GA1UEAxMYZnJvZG8tZGV2NC5teXRlc3RydW4uY29tMQswCQYD\r\nVQQGEwJVUzEOMAwGA1UECBMFVGV4YXMxEzARBgNVBAcTCkdlb3JnZXRvd24xEzAR\r\nBgNVBAoTClJvY2tjYXJ2ZXIxFjAUBgNVBAsTDUZyb2RvIExpYnJhcnkwggEiMA0G\r\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCb+RhCddeVYR/1eSZ5KiVy4FZiSJ5J\r\nzJA7x4+rb74aZlIrLf4n0KUI+KA+r7LzJwUtL/O1AaLP/Ysq86UXO/eeZ/ENevbU\r\n2sxiipTJext/4xchaJ/2H1qR4dd46w3Kmd+dgdn0rtpxAZrn/IyzGbw+W8IHOd5A\r\n/CSwLeFfNLSjK7iNr4nn44wOoLLMs735Ph/MQ4hYHzc3KZfHmgmjXTHiOTym1vvq\r\ndkQsfPbC7RI9kdYw6nzE4Z3uHRAQiqppyEQABK9ICuk1bEDNXflqOMg5fITmi6O5\r\nZtXq3DS2cpezeieVG6Yf8t8RG/cLC76rjJhgsytWQIktHv6iHCqzdhQfAgMBAAGj\r\ngdYwgdMwDAYDVR0TBAUwAwEB/zALBgNVHQ8EBAMCAvQwOwYDVR0lBDQwMgYIKwYB\r\nBQUHAwEGCCsGAQUFBwMCBggrBgEFBQcDAwYIKwYBBQUHAwQGCCsGAQUFBwMIMBEG\r\nCWCGSAGG+EIBAQQEAwIA9zAdBgNVHQ4EFgQUuXDOI1fgV3fDMlLMmiUxcRaBkekw\r\nRwYDVR0RBEAwPoYdZnJvZG8tZGV2NC1hbHQxLm15dGVzdHJ1bi5jb22GHWZyb2Rv\r\nLWRldjQtYWx0Mi5teXRlc3RydW4uY29tMA0GCSqGSIb3DQEBBQUAA4IBAQBRhsRV\r\nrl6oGto7JCjUYRfvgPqnDrme8JG68p8i8WkObxiR3fnyM6j5fVbQOiGW+/qpZkML\r\n3Y0Sd0Yi7yfwJ9LCXUEDfCPe3wVwplQsSl5hGk7lF4NbwAAmPaVUO4EYYphIjVWy\r\n2+XMcR6i4zf7jBnY1R48rq8/M+CaNllZRt53R8G6nwxA2fjGzEKkXnjplUuDJ2aI\r\nCwmQXbngx4h0P7gicphqBzzNW5nsa/d2nFM9nJJun+lBEDXvquMuQH0szbl7Y1hJ\r\nW4/vfNjh4LhapQ1denT9vv91gpnwTGuX0D3UNbgEQ9Pp049f95uY1gQEAD2LfteS\r\nC4PJRZmyt+B7UjmR\r\n-----END CERTIFICATE-----\r\n',
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
      '-----BEGIN CERTIFICATE-----\r\nMIIEWDCCA0CgAwIBAgIBBTANBgkqhkiG9w0BAQUFADCBgjEhMB8GA1UEAxMYZnJv\r\nZG8tZGV2NS5teXRlc3RydW4uY29tMQswCQYDVQQGEwJVUzEOMAwGA1UECBMFVGV4\r\nYXMxEzARBgNVBAcTCkdlb3JnZXRvd24xEzARBgNVBAoTClJvY2tjYXJ2ZXIxFjAU\r\nBgNVBAsTDUZyb2RvIExpYnJhcnkwHhcNMjQwODA2MDI0ODI3WhcNMjUwODA2MDI0\r\nODI3WjCBgjEhMB8GA1UEAxMYZnJvZG8tZGV2NS5teXRlc3RydW4uY29tMQswCQYD\r\nVQQGEwJVUzEOMAwGA1UECBMFVGV4YXMxEzARBgNVBAcTCkdlb3JnZXRvd24xEzAR\r\nBgNVBAoTClJvY2tjYXJ2ZXIxFjAUBgNVBAsTDUZyb2RvIExpYnJhcnkwggEiMA0G\r\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCb+RhCddeVYR/1eSZ5KiVy4FZiSJ5J\r\nzJA7x4+rb74aZlIrLf4n0KUI+KA+r7LzJwUtL/O1AaLP/Ysq86UXO/eeZ/ENevbU\r\n2sxiipTJext/4xchaJ/2H1qR4dd46w3Kmd+dgdn0rtpxAZrn/IyzGbw+W8IHOd5A\r\n/CSwLeFfNLSjK7iNr4nn44wOoLLMs735Ph/MQ4hYHzc3KZfHmgmjXTHiOTym1vvq\r\ndkQsfPbC7RI9kdYw6nzE4Z3uHRAQiqppyEQABK9ICuk1bEDNXflqOMg5fITmi6O5\r\nZtXq3DS2cpezeieVG6Yf8t8RG/cLC76rjJhgsytWQIktHv6iHCqzdhQfAgMBAAGj\r\ngdYwgdMwDAYDVR0TBAUwAwEB/zALBgNVHQ8EBAMCAvQwOwYDVR0lBDQwMgYIKwYB\r\nBQUHAwEGCCsGAQUFBwMCBggrBgEFBQcDAwYIKwYBBQUHAwQGCCsGAQUFBwMIMBEG\r\nCWCGSAGG+EIBAQQEAwIA9zAdBgNVHQ4EFgQUuXDOI1fgV3fDMlLMmiUxcRaBkekw\r\nRwYDVR0RBEAwPoYdZnJvZG8tZGV2NS1hbHQxLm15dGVzdHJ1bi5jb22GHWZyb2Rv\r\nLWRldjUtYWx0Mi5teXRlc3RydW4uY29tMA0GCSqGSIb3DQEBBQUAA4IBAQABJHxK\r\noNjMaEbKgXcL9fNhouvQis0GptN7nQfx/BSCWVgDpY+Izh41NZscHgmy+Caoqvpg\r\ngjb2x5zdczbVWyOiBpRs9Fw55mzhDEe0RohAzGsC4dll0AS7DdnMinnUF2w29+ke\r\nMpl5/hHcSaT0hA3wWFK49wnNlf+aOAge3I6m+2Hm1wW/H9vcq6t1f4lWNQdDt06b\r\nsArrCOveTbXbyh78bcNoC2ZJv4+17MyGfALRDUNRKzetA3MQCEGerQRMR40r+WMi\r\nu8n9JrshX8pbM14rO4aMPltl4PvpIzJGjKAqqW2ASBzQiRy7+QQyundsW/6mGPIP\r\nHsuU8Yx63mgwe9HA\r\n-----END CERTIFICATE-----\r\n',
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
  const cert6: TestCertificate = {
    id: 'ccrt-094b98be-e88d-4a47-b950-c8dccc420013',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev6.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '06',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev6-alt1.mytestrun.com',
        'frodo-dev6-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert7: TestCertificate = {
    id: 'ccrt-031423ec-ac94-42c4-a92c-c56792d61f3f',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev7.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '07',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev7-alt1.mytestrun.com',
        'frodo-dev7-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert8: TestCertificate = {
    id: 'ccrt-b3729622-714a-4e57-9630-7bf88b016678',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev8.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '08',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev8-alt1.mytestrun.com',
        'frodo-dev8-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert8a: TestCertificate = {
    id: 'ccrt-10b36a92-5257-4d5c-bed6-12fc78aa25a3',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev8a.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '081',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev8a-alt1.mytestrun.com',
        'frodo-dev8a-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert9: TestCertificate = {
    id: 'ccrt-33c74d96-e14e-4f8a-b928-3b7468afa959',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev9.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '09',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev9-alt1.mytestrun.com',
        'frodo-dev9-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert9a: TestCertificate = {
    id: 'ccrt-c0bc87aa-54eb-42be-bbf6-75d3b64a4755',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev9a.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '091',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev9a-alt1.mytestrun.com',
        'frodo-dev9a-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert10: TestCertificate = {
    id: 'ccrt-065f0531-2444-4e80-b1ed-9f6fdb2ccf8c',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev10.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '10',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev10-alt1.mytestrun.com',
        'frodo-dev10-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert10a: TestCertificate = {
    id: 'ccrt-755aa779-0715-4cf3-940c-e46e246898d2',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev10a.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '101',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev10a-alt1.mytestrun.com',
        'frodo-dev10a-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert11: TestCertificate = {
    id: 'ccrt-8181cca4-4f8d-48b0-a522-a2c1de4bc7f0',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev11.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '11',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev11-alt1.mytestrun.com',
        'frodo-dev11-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert11a: TestCertificate = {
    id: 'ccrt-b0bf8790-4333-401a-84b3-b54782fd0fe2',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev11a.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '111',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev11a-alt1.mytestrun.com',
        'frodo-dev11a-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert12: TestCertificate = {
    id: 'ccrt-8f0af0d3-b1f3-4b9c-82f8-ad078faf4ed4',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev12.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '12',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev12-alt1.mytestrun.com',
        'frodo-dev12-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert12a: TestCertificate = {
    id: 'ccrt-b3ad07f9-39a1-421d-8cb6-46d510dde6d8',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev12a.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '121',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev12a-alt1.mytestrun.com',
        'frodo-dev12a-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert12b: TestCertificate = {
    id: 'ccrt-4597115e-39d8-4fd8-802f-403c8b95985c',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev12b.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '122',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev12b-alt1.mytestrun.com',
        'frodo-dev12b-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: false,
  };
  const cert13: TestCertificate = {
    id: 'ccrt-932f4d98-ad86-4dd5-a922-44c06cd687a5',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev13.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '13',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev13-alt1.mytestrun.com',
        'frodo-dev13-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert13a: TestCertificate = {
    id: 'ccrt-d5061f23-e7c5-4861-9330-1657e7d34920',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev13a.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '131',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev13a-alt1.mytestrun.com',
        'frodo-dev13a-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert13b: TestCertificate = {
    id: 'ccrt-b011175b-6d5d-4c5f-8b8b-d2022d6e68b7',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev13b.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '132',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev13b-alt1.mytestrun.com',
        'frodo-dev13b-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert14: TestCertificate = {
    id: 'ccrt-19d21025-c2dc-446b-a1bb-2ed880247ce2',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev14.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '14',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev14-alt1.mytestrun.com',
        'frodo-dev14-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert14a: TestCertificate = {
    id: 'ccrt-d2d59cd6-9f31-46a9-84b0-90b077aa9b59',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev14a.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '141',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev14a-alt1.mytestrun.com',
        'frodo-dev14a-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  const cert14b: TestCertificate = {
    id: 'ccrt-536f4f4e-1ea0-459b-9656-a9fd57d0f9dc',
    certificate: '',
    csr: {
      algorithm: 'rsa',
      businessCategory: 'Unit Testing',
      city: 'Georgetown',
      commonName: 'frodo-dev14b.mytestrun.com',
      country: 'US',
      email: 'vscheuber@gmail.com',
      jurisdictionCity: 'Georgetown',
      jurisdictionCountry: 'US',
      jurisdictionState: 'Texas',
      organization: 'Rockcarver',
      organizationalUnit: 'Frodo Library',
      postalCode: '78626',
      serialNumber: '142',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev14b-alt1.mytestrun.com',
        'frodo-dev14b-alt2.mytestrun.com',
      ],
    },
    privateKey: getPrivateKey(),
    active: true,
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    // Phase 1 - non-destructive tests
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await Promise.allSettled([
        stageCertificate(cert1, true),
        stageCertificate(cert2, true),
        stageCertificate(cert3, true),
        stageCertificate(cert4, false),
        stageCertificate(cert5, false),
        stageCertificate(cert6, true),
        stageCertificate(cert7, true),
        stageCertificate(cert8, true),
        stageCertificate(cert8a, true),
        stageCertificate(cert9, true),
        stageCertificate(cert9a, true),
        stageCertificate(cert10, true),
        stageCertificate(cert10a, true),
        stageCertificate(cert11, true),
        stageCertificate(cert11a, true),
      ]);
    }
    // Phase 2 - destructive tests - delete all inactive
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await Promise.allSettled([
        stageCertificate(cert12, true),
        stageCertificate(cert12a, true),
        stageCertificate(cert12b, true),
      ]);
    }
    // Phase 3 - destructive tests - delete all active
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3'
    ) {
      await Promise.allSettled([
        stageCertificate(cert13, true),
        stageCertificate(cert13a, true),
        stageCertificate(cert13b, true),
      ]);
    }
    // Phase 4 - destructive tests - force delete all active
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4'
    ) {
      await Promise.allSettled([
        stageCertificate(cert14, true),
        stageCertificate(cert14a, true),
        stageCertificate(cert14b, true),
      ]);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    // Phase 1 clean up
    if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1'
    ) {
      await Promise.allSettled([
        stageCertificate(cert1, false),
        stageCertificate(cert2, false),
        stageCertificate(cert3, false),
        stageCertificate(cert4, false),
        stageCertificate(cert5, false),
        stageCertificate(cert6, false),
        stageCertificate(cert7, false),
        stageCertificate(cert8, false),
        stageCertificate(cert8a, false),
        stageCertificate(cert9, false),
        stageCertificate(cert9a, false),
        stageCertificate(cert10, false),
        stageCertificate(cert10a, false),
        stageCertificate(cert11, false),
        stageCertificate(cert11a, false),
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

cert6.id:          ${cert6._stagingId}\n\

cert7.id:          ${cert7._stagingId}\n\

cert8.id:          ${cert8._stagingId}\n\

cert8a.id:         ${cert8a._stagingId}\n\

cert9.id:          ${cert9._stagingId}\n\

cert9a.id:         ${cert9a._stagingId}\n\

cert10.id:         ${cert10._stagingId}\n\

cert10a.id:        ${cert10a._stagingId}\n\

cert11.id:         ${cert11._stagingId}\n\

cert11a.id:        ${cert11a._stagingId}\n\

*****************************************************************`);
    }
    // Phase 2 clean up
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '2'
    ) {
      await Promise.allSettled([
        stageCertificate(cert12, false),
        stageCertificate(cert12a, false),
        stageCertificate(cert12b, false),
      ]);

      console.debug(`\
*****************************************************************\n\
*** ATTENTION: UPDATE cert test objects before running tests! ***\n\
*****************************************************************\n\

cert12.id:          ${cert12._stagingId}\n\

cert12a.id:         ${cert12a._stagingId}\n\

cert12b.id:         ${cert12b._stagingId}\n\

*****************************************************************`);
    }
    // Phase 3 clean up
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '3'
    ) {
      await Promise.allSettled([
        stageCertificate(cert13, false),
        stageCertificate(cert13a, false),
        stageCertificate(cert13b, false),
      ]);

      console.debug(`\
*****************************************************************\n\
*** ATTENTION: UPDATE cert test objects before running tests! ***\n\
*****************************************************************\n\

cert13.id:          ${cert13._stagingId}\n\

cert13a.id:         ${cert13a._stagingId}\n\

cert13b.id:         ${cert13b._stagingId}\n\

*****************************************************************`);
    }
    // Phase 4 clean up
    else if (
      process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '4'
    ) {
      await Promise.allSettled([
        stageCertificate(cert14, false),
        stageCertificate(cert14a, false),
        stageCertificate(cert14b, false),
      ]);

      console.debug(`\
*****************************************************************\n\
*** ATTENTION: UPDATE cert test objects before running tests! ***\n\
*****************************************************************\n\

cert14.id:          ${cert14._stagingId}\n\

cert14a.id:         ${cert14a._stagingId}\n\

cert14b.id:         ${cert14b._stagingId}\n\

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

  // Phase 1
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '1')
  ) {
    describe('readCertificates()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.readCertificates).toBeDefined();
      });

      test('1: Read all certificates - success', async () => {
        const response = await EnvCertificatesOps.readCertificates({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('readCertificate()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.readCertificate).toBeDefined();
      });

      test(`1: Read existing certificate - success`, async () => {
        const response = await EnvCertificatesOps.readCertificate({
          certificateId: cert1._stagingId || cert1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Read non-existing certificate - error', async () => {
        try {
          await EnvCertificatesOps.readCertificate({
            certificateId: 'esv-does-not-exist',
            state,
          });
          fail('request should have failed');
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('createCertificate()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.createCertificate).toBeDefined();
      });

      test(`1: Create new certificate (inactive) - success`, async () => {
        try {
          const response = await EnvCertificatesOps.createCertificate({
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
          const response = await EnvCertificatesOps.createCertificate({
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
        expect(EnvCertificatesOps.updateCertificate).toBeDefined();
      });

      test(`1: Update existing certificate to active - success`, async () => {
        const response = await EnvCertificatesOps.updateCertificate({
          certificateId: cert2._stagingId || cert2.id,
          active: true,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Update non-existing certificate to active - error', async () => {
        try {
          await EnvCertificatesOps.updateCertificate({
            certificateId: 'certificate-does-not-exist',
            active: true,
            state,
          });
          fail('request should have failed');
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('activateCertificate()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.activateCertificate).toBeDefined();
      });

      test(`1: Activate existing certificate - success`, async () => {
        const response = await EnvCertificatesOps.activateCertificate({
          certificateId: cert8._stagingId || cert8.id,
          state,
        });
        expect(response.live).toBe(false);
        expect(response).toMatchSnapshot();
      });

      test(`2: Activate existing certificate and wait until live - success`, async () => {
        try {
          const response = await EnvCertificatesOps.activateCertificate({
            certificateId: cert8a._stagingId || cert8a.id,
            wait: true,
            // a bit hacky but appers to be working: record with default interval of 5000ms, run tests with interval of 10ms so tests run faster
            interval: process.env.FRODO_POLLY_MODE === 'record' ? 5000 : 10,
            state,
          });
          expect(response.live).toBe(true);
          expect(response).toMatchSnapshot();
        } catch (error) {
          printError(error);
          fail('request should have succeeded');
        }
      });

      test('3: Activate non-existing certificate - error', async () => {
        try {
          await EnvCertificatesOps.activateCertificate({
            certificateId: 'certificate-does-not-exist',
            state,
          });
          fail('request should have failed');
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('deactivateCertificate()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.deactivateCertificate).toBeDefined();
      });

      test(`1: Deactivate existing certificate - success`, async () => {
        const response = await EnvCertificatesOps.deactivateCertificate({
          certificateId: cert9._stagingId || cert9.id,
          state,
        });
        expect(response.live).toBe(true);
        expect(response).toMatchSnapshot();
      });

      test(`2: Deactivate existing certificate and wait until offline - success`, async () => {
        const response = await EnvCertificatesOps.deactivateCertificate({
          certificateId: cert9a._stagingId || cert9a.id,
          wait: true,
          // a bit hacky but appers to be working: record with default interval of 5000ms, run tests with interval of 10ms so tests run faster
          interval: process.env.FRODO_POLLY_MODE === 'record' ? 5000 : 10,
          state,
        });
        expect(response.live).toBe(false);
        expect(response).toMatchSnapshot();
      });

      test('3: Deactivate non-existing certificate - error', async () => {
        try {
          await EnvCertificatesOps.deactivateCertificate({
            certificateId: 'certificate-does-not-exist',
            state,
          });
          fail('request should have failed');
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('isCertificateActive()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.isCertificateActive).toBeDefined();
      });

      test(`1: Check if existing active certificate is active - success`, async () => {
        const response = await EnvCertificatesOps.isCertificateActive({
          certificateId: cert10._stagingId || cert10.id,
          state,
        });
        expect(response).toBe(true);
      });

      test(`2: Check if existing inactive certificate is active - success`, async () => {
        const response = await EnvCertificatesOps.isCertificateActive({
          certificateId: cert10a._stagingId || cert10a.id,
          state,
        });
        expect(response).toBe(false);
      });

      test('3: Check if non-existing certificate is active - error', async () => {
        try {
          await EnvCertificatesOps.isCertificateActive({
            certificateId: 'certificate-does-not-exist',
            state,
          });
          fail('request should have failed');
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('isCertificateLive()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.isCertificateLive).toBeDefined();
      });

      test(`1: Check if existing active certificate is already live - success`, async () => {
        const response = await EnvCertificatesOps.isCertificateLive({
          certificateId: cert11._stagingId || cert11.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`1: Check if existing inactive certificate is still live - success`, async () => {
        const response = await EnvCertificatesOps.isCertificateLive({
          certificateId: cert11a._stagingId || cert11a.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('2: Check if non-existing certificate is live - error', async () => {
        try {
          await EnvCertificatesOps.isCertificateLive({
            certificateId: 'certificate-does-not-exist',
            state,
          });
          fail('request should have failed');
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('deleteCertificate()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.deleteCertificate).toBeDefined();
      });

      test(`1: Delete existing inactive certificate - success`, async () => {
        const response = await EnvCertificatesOps.deleteCertificate({
          certificateId: cert3._stagingId || cert3.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Delete existing active and live certificate - error`, async () => {
        try {
          await EnvCertificatesOps.deleteCertificate({
            certificateId: cert6._stagingId || cert6.id,
            state,
          });
          fail('request should have failed');
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });

      test(`3: Force delete existing active and live certificate - success`, async () => {
        const response = await EnvCertificatesOps.deleteCertificate({
          certificateId: cert7._stagingId || cert7.id,
          force: true,
          // a bit hacky but appers to be working: record with default interval of 5000ms, run tests with interval of 10ms so tests run faster
          interval: process.env.FRODO_POLLY_MODE === 'record' ? 5000 : 10,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test('4: Delete non-existing certificate - error', async () => {
        try {
          await EnvCertificatesOps.deleteCertificate({
            certificateId: 'certificate-does-not-exist',
            state,
          });
          fail('request should have failed');
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });
  }

  // Phase 1/2/3/4
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      (process.env.FRODO_RECORD_PHASE === '1' ||
        process.env.FRODO_RECORD_PHASE === '2' ||
        process.env.FRODO_RECORD_PHASE === '3' ||
        process.env.FRODO_RECORD_PHASE === '4'))
  ) {
    describe('deleteCertificates()', () => {
      test('0: Method is implemented', async () => {
        expect(EnvCertificatesOps.deleteCertificates).toBeDefined();
      });

      // Phase 2
      if (
        !process.env.FRODO_POLLY_MODE ||
        (process.env.FRODO_POLLY_MODE === 'record' &&
          process.env.FRODO_RECORD_PHASE === '2')
      ) {
        test(`1: Delete all (inactive) certificates - success`, async () => {
          if (
            (cert12._stagingId || cert12.id) &&
            (cert12a._stagingId || cert12a.id) &&
            (cert12b._stagingId || cert12b.id)
          ) {
            const response = await EnvCertificatesOps.deleteCertificates({
              state,
            });
            expect(response).toMatchSnapshot();
          } else {
            fail('cert12, cert12a, cert12b not properly staged');
          }
        });
      }

      // Phase 3
      if (
        !process.env.FRODO_POLLY_MODE ||
        (process.env.FRODO_POLLY_MODE === 'record' &&
          process.env.FRODO_RECORD_PHASE === '3')
      ) {
        test(`2: Delete all (active and live) certificates - error`, async () => {
          if (
            (cert13._stagingId || cert13.id) &&
            (cert13a._stagingId || cert13a.id) &&
            (cert13b._stagingId || cert13b.id)
          ) {
            try {
              await EnvCertificatesOps.deleteCertificates({
                state,
              });
              fail('request should have failed');
            } catch (error) {
              expect(error).toMatchSnapshot();
            }
          } else {
            fail('cert13, cert13a, cert13b not properly staged');
          }
        });
      }

      // Phase 4
      if (
        !process.env.FRODO_POLLY_MODE ||
        (process.env.FRODO_POLLY_MODE === 'record' &&
          process.env.FRODO_RECORD_PHASE === '4')
      ) {
        test(`3: Force delete all (active and live) certificates - success`, async () => {
          if (
            (cert14._stagingId || cert14.id) &&
            (cert14a._stagingId || cert14a.id) &&
            (cert14b._stagingId || cert14b.id)
          ) {
            try {
              const response = await EnvCertificatesOps.deleteCertificates({
                force: true,
                // a bit hacky but appers to be working: record with default interval of 5000ms, run tests with interval of 10ms so tests run faster
                interval: process.env.FRODO_POLLY_MODE === 'record' ? 5000 : 10,
                state,
              });
              expect(response).toMatchSnapshot();
            } catch (error) {
              printError(error);
              fail('request should have succeeded');
            }
          } else {
            fail('cert14, cert14a, cert14b not properly staged');
          }
        });
      }
    });
  }
});
