/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record EnvCSRsOps
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CSR test objects (csr1, csr2, csr3, etc)
 *
 *    After successful recording, look for the following console output:
 *
 *    ****************************************************************
 *    *** ATTENTION: UPDATE csr test objects before running tests! ***
 *    ****************************************************************
 *
 *    csr1.id:          0143d649-0995-49be-9133-ad1763c2ac93
 *
 *    csr2.id:          9b1c9774-1caa-4fc0-a640-fb40930f2f33
 *    csr2.certificate: "-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----\r\n"
 *
 *    csr3.id:          387204c1-0f9b-43bb-a832-e226001d7741
 *
 *    csr4:             leave as is
 *
 *    csr5.id:          a81e409a-e9ee-4d8e-b36a-3304d3c50b9b
 *
 *    csr6.id:          eacdbc4f-a826-480b-9793-4399125b85f4
 *
 *    csr7.id:          e13a0235-9c69-40ef-b2bc-c667f6bd60c7
 *
 *    ****************************************************************
 *
 *    Then find the test objects listed in the output in the code below and
 *    update the respective properties as indicated.
 *
 * 3. Test your changes
 *
 *    You are ready to run the tests in replay mode and make sure they
 *    all succeed as well:
 *
 *        npm run test:only EnvCSRsOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvCSRsApi from '../../api/cloud/EnvCSRsApi';
import * as EnvCSRsOps from './EnvCSRsOps';
import { autoSetupPolly } from '../../utils/AutoSetupPolly';
import { filterRecording } from '../../utils/PollyUtils';
import { state } from '../../index';
import { issueSelfSignedCertificate } from '../../test/utils/TestUtils';
import { stringify } from '../../utils/JsonUtils';

const ctx = autoSetupPolly();

type TestCSR = {
  id: string;
  _stagingId?: string;
  csr: EnvCSRsApi.CSR;
  certificate?: string;
  _stagingCertificate?: string;
};

async function stageCSR(csr: TestCSR, create = true, issue = false) {
  // delete if exists, then create
  try {
    if (csr._stagingId) {
      await EnvCSRsApi.getCSR({
        csrId: csr._stagingId,
        state,
      });
      await EnvCSRsApi.deleteCSR({
        csrId: csr._stagingId,
        state,
      });
    }
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      try {
        const newCsr = await EnvCSRsApi.createCSR({
          csr: csr.csr,
          state,
        });
        csr._stagingId = newCsr.id;
        // issue the certificate
        if (issue) {
          const certificate = issueSelfSignedCertificate(newCsr.request);
          csr._stagingCertificate = certificate;
        }
      } catch (error) {
        console.debug('error staging csr', error);
      }
    }
  }
}

describe('EnvCSRsOps', () => {
  const csr1: TestCSR = {
    _stagingId: undefined,
    id: '0f33f533-eb6b-4dd8-a4bb-fd5626526daa',
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
  };
  const csr2: TestCSR = {
    _stagingId: undefined,
    id: 'f5bdc59a-1326-4c74-a3c4-b5ba0148ebd5',
    certificate:
      '-----BEGIN CERTIFICATE-----\r\nMIIFQDCCBCigAwIBAgIBAjANBgkqhkiG9w0BAQUFADCCASwxCzAJBgNVBAYTAlVT\r\nMQ4wDAYDVQQIEwVUZXhhczETMBEGA1UEBxMKR2VvcmdldG93bjEWMBQGA1UECRMN\r\nMSBNYWluIFN0cmVldDETMBEGA1UEChMKUm9ja2NhcnZlcjEWMBQGA1UECxMNRnJv\r\nZG8gTGlicmFyeTEhMB8GA1UEAxMYZnJvZG8tZGV2Mi5teXRlc3RydW4uY29tMQsw\r\nCQYDVQQFEwIwMjEiMCAGCSqGSIb3DQEJARYTdnNjaGV1YmVyQGdtYWlsLmNvbTEV\r\nMBMGA1UEDxMMVW5pdCBUZXN0aW5nMRMwEQYLKwYBBAGCNzwCAQMTAlVTMRswGQYL\r\nKwYBBAGCNzwCAQETCkdlb3JnZXRvd24xFjAUBgsrBgEEAYI3PAIBAhMFVGV4YXMw\r\nHhcNMjQwNzMxMDMzNzI0WhcNMjUwNzMxMDMzNzI0WjCCASwxCzAJBgNVBAYTAlVT\r\nMQ4wDAYDVQQIEwVUZXhhczETMBEGA1UEBxMKR2VvcmdldG93bjEWMBQGA1UECRMN\r\nMSBNYWluIFN0cmVldDETMBEGA1UEChMKUm9ja2NhcnZlcjEWMBQGA1UECxMNRnJv\r\nZG8gTGlicmFyeTEhMB8GA1UEAxMYZnJvZG8tZGV2Mi5teXRlc3RydW4uY29tMQsw\r\nCQYDVQQFEwIwMjEiMCAGCSqGSIb3DQEJARYTdnNjaGV1YmVyQGdtYWlsLmNvbTEV\r\nMBMGA1UEDxMMVW5pdCBUZXN0aW5nMRMwEQYLKwYBBAGCNzwCAQMTAlVTMRswGQYL\r\nKwYBBAGCNzwCAQETCkdlb3JnZXRvd24xFjAUBgsrBgEEAYI3PAIBAhMFVGV4YXMw\r\nggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDNu0B3GRcha3JwRdO8Yus+\r\nBwQFx/MlhUrUNzs62K70ScG3u8sD8PsBUUTjIXoifrifWskaXovnEUDjwlE1FN56\r\nPBHtu0yHPv/tji/xjHeBrto9wPD+3yi/QMEiAiFs3DSg/4dYHMzSHM7VXkcY1niM\r\n0xZ67ZdtCuXKtVqxnrzvfO6dKB/J1+rICakDqhEY+9voI0mziUWPYeulG67pyeI/\r\ndyGjs8boKYO8dfe/g0wkzG2BipQlmWrrtAUK5hTAt7lark/lOm9G/oHLtpM1m6+S\r\nNysX+8+8AKmGpbtt9HPRS9vDgbrkesXME/GNNfzwu25mkX/HBzQdHEGgF0gpeqGB\r\nAgMBAAGjaTBnMEoGA1UdEQEB/wRAMD6CHWZyb2RvLWRldjItYWx0MS5teXRlc3Ry\r\ndW4uY29tgh1mcm9kby1kZXYyLWFsdDIubXl0ZXN0cnVuLmNvbTAMBgNVHRMEBTAD\r\nAQH/MAsGA1UdDwQEAwIC9DANBgkqhkiG9w0BAQUFAAOCAQEAdxW7HMwGMhpHPv8V\r\nP+IRzmTykpiT5JG3l9DNBBBjy2uXxdcmA5bjPsWgO/ER3YsH74pEIKI50ldYkEZo\r\nk2TBQfImvhIqU4MjFdqoDkShmPUA04ZZpoPa27bYGcrOrH4pFny6ge1/kl1Q+6W0\r\nscMq7YuHZOJbKiZoOFZjXiH50jUaQmODqCX7VGIz0+oq1w1Cju3XEsic5S1j/y9w\r\nfvtYsgTSDIV7NzX29B5vlXVJvpVOW7wtu6ofq+3/mWRuEB9ZjEnZJ2sXltFR6l4C\r\nTTUa+C+0tyXNKkOwLZGucStjlH/Zt1y/mGNb9VdnLZabQtJ2hnYBoXib6UfH8icB\r\njuUBPQ==\r\n-----END CERTIFICATE-----\r\n',
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
  };
  const csr3: TestCSR = {
    _stagingId: undefined,
    id: 'e673782f-53f2-4775-940f-c4eb868deb3f',
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
  };
  const csr4: TestCSR = {
    _stagingId: undefined,
    id: 'leave as is',
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
  };
  const csr5: TestCSR = {
    _stagingId: undefined,
    id: 'a81e409a-e9ee-4d8e-b36a-3304d3c50b9b',
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
      serialNumber: '05',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev5-alt1.mytestrun.com',
        'frodo-dev5-alt2.mytestrun.com',
      ],
    },
  };
  const csr6: TestCSR = {
    _stagingId: undefined,
    id: 'eacdbc4f-a826-480b-9793-4399125b85f4',
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
      serialNumber: '06',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev6-alt1.mytestrun.com',
        'frodo-dev6-alt2.mytestrun.com',
      ],
    },
  };
  const csr7: TestCSR = {
    _stagingId: undefined,
    id: 'e13a0235-9c69-40ef-b2bc-c667f6bd60c7',
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
      serialNumber: '07',
      state: 'Texas',
      streetAddress: '1 Main Street',
      subjectAlternativeNames: [
        'frodo-dev7-alt1.mytestrun.com',
        'frodo-dev7-alt2.mytestrun.com',
      ],
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageCSR(csr1, true);
      await stageCSR(csr2, true, true);
      await stageCSR(csr3, true);
      await stageCSR(csr4, false);
      await stageCSR(csr5, true);
      await stageCSR(csr6, true);
      await stageCSR(csr7, true);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageCSR(csr1, false);
      await stageCSR(csr2, false);
      await stageCSR(csr3, false);
      await stageCSR(csr4, false);
      await stageCSR(csr5, false);
      await stageCSR(csr6, false);
      await stageCSR(csr7, false);

      console.debug(`\
****************************************************************\n\
*** ATTENTION: UPDATE csr test objects before running tests! ***\n\
****************************************************************\n\

csr1.id:          ${csr1._stagingId}\n\

csr2.id:          ${csr2._stagingId}\n\
csr2.certificate: ${stringify(csr2._stagingCertificate)}\n\

csr3.id:          ${csr3._stagingId}\n\

csr4:             leave as is\n\

csr5.id:          ${csr5._stagingId}\n\

csr6.id:          ${csr6._stagingId}\n\

csr7.id:          ${csr7._stagingId}\n\

****************************************************************`);
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('readCSRs()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsOps.readCSRs).toBeDefined();
    });

    test('1: Read all CSRs - success', async () => {
      const response = await EnvCSRsOps.readCSRs({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readCSR()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsOps.readCSR).toBeDefined();
    });

    test(`1: Read existing CSR - success`, async () => {
      if (csr1._stagingId || csr1.id) {
        const response = await EnvCSRsOps.readCSR({
          csrId: csr1._stagingId || csr1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      } else {
        fail('csr1 not properly staged');
      }
    });

    test('2: Read non-existing CSR - error', async () => {
      try {
        await EnvCSRsOps.readCSR({
          csrId: 'esv-does-not-exist',
          state,
        });
        fail('request should have failed');
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('createCSR()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsOps.createCSR).toBeDefined();
    });

    test(`1: Create new CSR - success`, async () => {
      const response = await EnvCSRsOps.createCSR({
        csr: csr4.csr,
        state,
      });
      expect(response).toMatchSnapshot({
        id: expect.any(String),
      });
    });
  });

  describe('updateCSR()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsOps.updateCSR).toBeDefined();
    });

    test(`1: Update existing CSR - success`, async () => {
      if (
        (csr2._stagingId && csr2._stagingCertificate) ||
        (csr2.id && csr2.certificate)
      ) {
        const response = await EnvCSRsOps.updateCSR({
          csrId: csr2._stagingId || csr2.id,
          certificate: csr2._stagingCertificate || (csr2.certificate as string),
          state,
        });
        expect(response).toMatchSnapshot();
      } else {
        fail('csr2 not properly staged');
      }
    });

    test('2: Update non-existing CSR - error', async () => {
      try {
        await EnvCSRsOps.updateCSR({
          csrId: 'csr-does-not-exist',
          certificate: 'no-certificate',
          state,
        });
        fail('request should have failed');
      } catch (error) {
        expect(error).toMatchSnapshot();
      }
    });
  });

  describe('deleteCSR()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsOps.deleteCSR).toBeDefined();
    });

    test(`1: Delete existing CSR - success`, async () => {
      if (csr3._stagingId || csr3.id) {
        const response = await EnvCSRsOps.deleteCSR({
          csrId: csr3._stagingId || csr3.id,
          state,
        });
        expect(response).toMatchSnapshot();
      } else {
        fail('csr3 not properly staged');
      }
    });

    test('2: Delete non-existing CSR - success', async () => {
      try {
        const response = await EnvCSRsOps.deleteCSR({
          csrId: 'csr-does-not-exist',
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

  describe('deleteCSRs()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsOps.deleteCSRs).toBeDefined();
    });

    test(`1: Delete all CSRs - success`, async () => {
      if (
        (csr5._stagingId || csr5.id) &&
        (csr6._stagingId || csr6.id) &&
        (csr7._stagingId || csr7.id)
      ) {
        const response = await EnvCSRsOps.deleteCSRs({
          state,
        });
        expect(response).toMatchSnapshot();
      } else {
        fail('csr5, csr6, csr7 not properly staged');
      }
    });
  });
});
