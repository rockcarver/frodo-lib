/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record EnvCSRsApi
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
 *        npm run test:only EnvCSRsApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as EnvCSRsApi from './EnvCSRsApi';
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

describe('EnvCSRsApi', () => {
  const csr1: TestCSR = {
    _stagingId: undefined,
    id: '0143d649-0995-49be-9133-ad1763c2ac93',
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
    id: '9b1c9774-1caa-4fc0-a640-fb40930f2f33',
    certificate:
      '-----BEGIN CERTIFICATE-----\r\nMIIFQDCCBCigAwIBAgIBAjANBgkqhkiG9w0BAQUFADCCASwxCzAJBgNVBAYTAlVT\r\nMQ4wDAYDVQQIEwVUZXhhczETMBEGA1UEBxMKR2VvcmdldG93bjEWMBQGA1UECRMN\r\nMSBNYWluIFN0cmVldDETMBEGA1UEChMKUm9ja2NhcnZlcjEWMBQGA1UECxMNRnJv\r\nZG8gTGlicmFyeTEhMB8GA1UEAxMYZnJvZG8tZGV2Mi5teXRlc3RydW4uY29tMQsw\r\nCQYDVQQFEwIwMjEiMCAGCSqGSIb3DQEJARYTdnNjaGV1YmVyQGdtYWlsLmNvbTEV\r\nMBMGA1UEDxMMVW5pdCBUZXN0aW5nMRMwEQYLKwYBBAGCNzwCAQMTAlVTMRswGQYL\r\nKwYBBAGCNzwCAQETCkdlb3JnZXRvd24xFjAUBgsrBgEEAYI3PAIBAhMFVGV4YXMw\r\nHhcNMjQwNzMxMDI0MjA0WhcNMjUwNzMxMDI0MjA0WjCCASwxCzAJBgNVBAYTAlVT\r\nMQ4wDAYDVQQIEwVUZXhhczETMBEGA1UEBxMKR2VvcmdldG93bjEWMBQGA1UECRMN\r\nMSBNYWluIFN0cmVldDETMBEGA1UEChMKUm9ja2NhcnZlcjEWMBQGA1UECxMNRnJv\r\nZG8gTGlicmFyeTEhMB8GA1UEAxMYZnJvZG8tZGV2Mi5teXRlc3RydW4uY29tMQsw\r\nCQYDVQQFEwIwMjEiMCAGCSqGSIb3DQEJARYTdnNjaGV1YmVyQGdtYWlsLmNvbTEV\r\nMBMGA1UEDxMMVW5pdCBUZXN0aW5nMRMwEQYLKwYBBAGCNzwCAQMTAlVTMRswGQYL\r\nKwYBBAGCNzwCAQETCkdlb3JnZXRvd24xFjAUBgsrBgEEAYI3PAIBAhMFVGV4YXMw\r\nggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDTUUpdtIrwc3cAkkcqRJN5\r\nGiZjyxVF3U4nz7aamumlPdTukfUVS/KbsX2IT0heZaYtya4l1xtE3NkupQFziDjd\r\nxW9Ah9wq+YmD3ucZKTkJz+Yfksq+rGUmCxUDcJNXMQjrj3FoQcimmWCQ7wDK3MYL\r\nClFnF0Wsp8WnyGcGa/DNG47U48pfIbz7IkHcAYFNeTQtdgYuIH7pHYaQ9Huj6W5V\r\nei2gn1b2wXP751+5Kv2gCQMGw0SpLNx7AM3JnVAjYHgn22u0E++RKmlWppP3SzHC\r\nx5f/taEUkuSrgP6IAqlenrLJ0v7P7PpiM6frxG825J5OADyndYWohbCLndNCngc7\r\nAgMBAAGjaTBnMEoGA1UdEQEB/wRAMD6CHWZyb2RvLWRldjItYWx0MS5teXRlc3Ry\r\ndW4uY29tgh1mcm9kby1kZXYyLWFsdDIubXl0ZXN0cnVuLmNvbTAMBgNVHRMEBTAD\r\nAQH/MAsGA1UdDwQEAwIC9DANBgkqhkiG9w0BAQUFAAOCAQEAi+/++5Ax6B9nK6jr\r\nkocBq2sEfLYYm1pltK977wntrAPgsDSm5u+cPf1fCsL4iZtDRfMuSlKr9x/KVxu2\r\ncA1+R5AjS52qd7Z1ReehmvAGqqjjmR4H5uqkeHYsWH9ma0z60T/XCnft7MK0En/J\r\nJ1e/6kQMY5EEzy2N1rsmuvJwPMqh0YZJ+ZwpRaD3gXb9zePmMqoqGs7byv/d+8+F\r\nc4mUoQtkIqcliTmEHSjFhItUlxLjzVdG7Tt1Sl8MALIf/u2dLwUZuAJX6DNQYL8T\r\neswJcbP3QAfXBl1VDOh/jX476ZkFn1HJ0tixD+2Xqldb11vVau3fYHTHBzN2NKGh\r\nz1N75Q==\r\n-----END CERTIFICATE-----\r\n',
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
    id: '387204c1-0f9b-43bb-a832-e226001d7741',
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
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageCSR(csr1, true);
      await stageCSR(csr2, true, true);
      await stageCSR(csr3, true);
      await stageCSR(csr4, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageCSR(csr1, false);
      await stageCSR(csr2, false);
      await stageCSR(csr3, false);
      await stageCSR(csr4, false);

      console.debug(`\
****************************************************************\n\
*** ATTENTION: UPDATE csr test objects before running tests! ***\n\
****************************************************************\n\

csr1.id:          ${csr1._stagingId}\n\

csr2.id:          ${csr2._stagingId}\n\
csr2.certificate: ${stringify(csr2._stagingCertificate)}\n\

csr3.id:          ${csr3._stagingId}\n\

csr4:             leave as is\n\

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

  describe('getCSRs()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsApi.getCSRs).toBeDefined();
    });

    test('1: Get all CSRs - success', async () => {
      const response = await EnvCSRsApi.getCSRs({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getCSR()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsApi.getCSR).toBeDefined();
    });

    test(`1: Get existing CSR - success`, async () => {
      if (csr1._stagingId || csr1.id) {
        const response = await EnvCSRsApi.getCSR({
          csrId: csr1._stagingId || csr1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      } else {
        fail('csr1 not properly staged');
      }
    });

    test('2: Get non-existing CSR - error', async () => {
      try {
        await EnvCSRsApi.getCSR({
          csrId: 'esv-does-not-exist',
          state,
        });
        fail('request should have failed');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('createCSR()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsApi.createCSR).toBeDefined();
    });

    test(`1: Create new CSR - success`, async () => {
      const response = await EnvCSRsApi.createCSR({
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
      expect(EnvCSRsApi.updateCSR).toBeDefined();
    });

    test(`1: Update existing CSR - success`, async () => {
      if (
        (csr2._stagingId && csr2._stagingCertificate) ||
        (csr2.id && csr2.certificate)
      ) {
        const response = await EnvCSRsApi.updateCSR({
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
        await EnvCSRsApi.updateCSR({
          csrId: 'csr-does-not-exist',
          certificate: 'no-certificate',
          state,
        });
        fail('request should have failed');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deleteCSR()', () => {
    test('0: Method is implemented', async () => {
      expect(EnvCSRsApi.deleteCSR).toBeDefined();
    });

    test(`1: Delete existing CSR - success`, async () => {
      if (csr3._stagingId || csr3.id) {
        const response = await EnvCSRsApi.deleteCSR({
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
        const response = await EnvCSRsApi.deleteCSR({
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
});
