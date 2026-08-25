/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record_noauth
 *    script and override all the connection state variables supplied to the
 *    getTokens() function by the test to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=https://openam-frodo-dev.forgeblocks.com/am FRODO_USERNAME=volker.scheuber@forgerock.com FRODO_PASSWORD='S3cr3!S@uc3' npm run test:record_noauth AuthenticateOps
 *
 *    You must also do the same when testing a classic deployment. Additionally, 
 *    if recording any tests involving the Amster private key in the pkcs8.pem 
 *    file, you must add the corresponding public key from pkcs8.pub into your 
 *    authorized_keys file in /path/to/am/security/keys/amster/authorized_keys,
 *    otherwise the key will not be recognized by AM and you will get a 401 error.
 * 
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update AuthenticateOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only AuthenticateOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { FrodoError } from '../index';
import { isNotFoundError } from './FrodoError';
import { autoSetupPolly, setDefaultState } from '../utils/AutoSetupPolly';
import { defaultMatchRequestsBy, filterRecording } from '../utils/PollyUtils';
import path from 'path';
import { fileURLToPath } from 'url';
import axios, { AxiosError, AxiosHeaders } from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// need to modify the default matching rules to allow the mocking to work for an authentication flow.
const matchConfig = defaultMatchRequestsBy();
matchConfig.body = false; // oauth flows are tricky because of the PKCE challenge, which is different for each request
matchConfig.order = true; // since we instruct Polly not to match the body, we need to enable ordering of the requests

const ctx = autoSetupPolly(matchConfig);

// create AxiosErrors to be used in tests
const axiosConfig1 = { 
  url: 'https://api.example.com/data', 
  headers: new AxiosHeaders() 
};

const axiosRequest1 = { path: '/data' };

const axiosResponse1 = {
  status: 401,
  statusText: 'Unauthorized',
  config: axiosConfig1,
  headers: new AxiosHeaders({ 'content-type': 'application/json' }),
  data: {
    message: "Invalid credentials",
    error: "Access Denied",
    reason: "INSUFFICIENT_PERMISSIONS",
    detail: "User 'jdoe_99' does not have the 'REPORTS_EXPORT' scope enabled.",
    error_description: "The requested action requires administrative privileges. Please contact your workspace owner.",
  },
};

// Constructor: (message, code, config, request, response)
const axiosError1: AxiosError = new AxiosError(
  'Request failed with status code 401',
  AxiosError.ERR_BAD_REQUEST,
  axiosConfig1,
  axiosRequest1,
  axiosResponse1
);

const axiosConfig2 = { 
  url: 'https://api.example.com/api/users/98765', 
  headers: new AxiosHeaders() 
};

const axiosRequest2 = { path: '/api/users/98765' };

const axiosResponse2 = {
  status: 404,
  statusText: 'Not Found',
  config: axiosConfig2,
  headers: new AxiosHeaders({ 'content-type': 'application/json' }),
  data: {
    message: "The specified user does not exist.",
    error: "Resource Not Found",
    reason: "OBJECT_MISSING",
    detail: "No record found with ID: 'user_98765'.",
    error_description: "The requested user profile may have been deleted or the URL is incorrect.",
  },
};

// Constructor: (message, code, config, request, response)
const axiosError2: AxiosError = new AxiosError(
  'Request failed with status code 404',
  AxiosError.ERR_BAD_REQUEST,
  axiosConfig2,
  axiosRequest2,
  axiosResponse2
);

const axiosConfig3 = {
  url: 'https://api.example.com/data',
  headers: new AxiosHeaders(),
};

const axiosRequest3 = { path: '/data' };

const axiosResponse3 = {
  status: 500,
  statusText: 'Internal Server Error',
  config: axiosConfig3,
  headers: new AxiosHeaders({ 'content-type': 'application/json' }),
  data: {
    message: 'Something went wrong.',
  },
};

// Constructor: (message, code, config, request, response)
const axiosError500: AxiosError = new AxiosError(
  'Request failed with status code 500',
  AxiosError.ERR_BAD_REQUEST,
  axiosConfig3,
  axiosRequest3,
  axiosResponse3
);

// A network/timeout failure never reaches the server, so it has no
// `response` at all (unlike a 4xx/5xx, which does).
const axiosTimeoutError: AxiosError = new AxiosError(
  'timeout of 5000ms exceeded',
  AxiosError.ECONNABORTED,
  axiosConfig1,
  axiosRequest1,
  undefined
);

describe('FrodoError', () => {
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('Single Error', () => {
    test('0: Single FrodoError', async () => {
      const error = new FrodoError('error0');
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('error0');
      expect(error.toString()).toEqual('error0');
    });

    test('1: Single FrodoError (thrown and caught)', async () => {
      try {
        throw new FrodoError('error0');
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.getCombinedMessage()).toEqual('error0');
        expect(error.toString()).toEqual('error0');
      }
    });
  });

  describe('Wrapped Error', () => {
    test('0: Wrapped FrodoError', async () => {
      const error = new FrodoError('error1', new FrodoError('error0'));
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('error1\n  error0');
      expect(error.toString()).toEqual('error1\n  error0');
    });

    test('1: Wrapped FrodoError (thrown and caught)', async () => {
      try {
        throw new FrodoError('error1', new FrodoError('error0'));
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.getCombinedMessage()).toEqual('error1\n  error0');
        expect(error.toString()).toEqual('error1\n  error0');
      }
    });

    test('2: Wrapped Error', async () => {
      const error = new FrodoError('error1', new Error('error0'));
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('error1\n  error0');
      expect(error.toString()).toEqual('error1\n  error0');
    });

    test('3: Wrapped Error (thrown and caught)', async () => {
      try {
        throw new FrodoError('error1', new Error('error0'));
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.getCombinedMessage()).toEqual('error1\n  error0');
        expect(error.toString()).toEqual('error1\n  error0');
      }
    });

    test('4: Wrapped AxiosError', async () => {
      const wrappedError = new FrodoError('error1', axiosError1);
      expect(wrappedError).toBeTruthy();
      expect(wrappedError.getCombinedMessage()).toEqual('\
error1\n\
  Network error:\n\
    URL: https://api.example.com/data\n\
    Status: 401\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Access Denied\n\
    Reason: INSUFFICIENT_PERMISSIONS\n\
    Message: Invalid credentials\n\
    Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
    Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
      expect(wrappedError.toString()).toEqual('\
error1\n\
  Network error:\n\
    URL: https://api.example.com/data\n\
    Status: 401\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Access Denied\n\
    Reason: INSUFFICIENT_PERMISSIONS\n\
    Message: Invalid credentials\n\
    Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
    Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
    });

    test('5: Wrapped AxiosError (thrown and caught)', async () => {
      try {
        throw new FrodoError('error1', axiosError1);
      } catch (wrappedError) {
        expect(wrappedError).toBeTruthy();
      expect(wrappedError.getCombinedMessage()).toEqual('\
error1\n\
  Network error:\n\
    URL: https://api.example.com/data\n\
    Status: 401\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Access Denied\n\
    Reason: INSUFFICIENT_PERMISSIONS\n\
    Message: Invalid credentials\n\
    Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
    Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
      expect(wrappedError.toString()).toEqual('\
error1\n\
  Network error:\n\
    URL: https://api.example.com/data\n\
    Status: 401\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Access Denied\n\
    Reason: INSUFFICIENT_PERMISSIONS\n\
    Message: Invalid credentials\n\
    Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
    Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
      }
    });

    test('6: Wrapped array of AxiosErrors', async () => {
      const wrappedError = new FrodoError('error1', [axiosError1, axiosError2]);
      expect(wrappedError).toBeTruthy();
      expect(wrappedError.getCombinedMessage()).toEqual('\
error1\n\
  Network error:\n\
    URL: https://api.example.com/data\n\
    Status: 401\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Access Denied\n\
    Reason: INSUFFICIENT_PERMISSIONS\n\
    Message: Invalid credentials\n\
    Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
    Description: The requested action requires administrative privileges. Please contact your workspace owner.\n\
  Network error:\n\
    URL: https://api.example.com/api/users/98765\n\
    Status: 404\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Resource Not Found\n\
    Reason: OBJECT_MISSING\n\
    Message: The specified user does not exist.\n\
    Detail: No record found with ID: \'user_98765\'.\n\
    Description: The requested user profile may have been deleted or the URL is incorrect.\
');
      expect(wrappedError.toString()).toEqual('\
error1\n\
  Network error:\n\
    URL: https://api.example.com/data\n\
    Status: 401\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Access Denied\n\
    Reason: INSUFFICIENT_PERMISSIONS\n\
    Message: Invalid credentials\n\
    Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
    Description: The requested action requires administrative privileges. Please contact your workspace owner.\n\
  Network error:\n\
    URL: https://api.example.com/api/users/98765\n\
    Status: 404\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Resource Not Found\n\
    Reason: OBJECT_MISSING\n\
    Message: The specified user does not exist.\n\
    Detail: No record found with ID: \'user_98765\'.\n\
    Description: The requested user profile may have been deleted or the URL is incorrect.\
');
    });

    test('7: Wrapped array of AxiosErrors (thrown and caught)', async () => {
      try {
        throw new FrodoError('error1', [axiosError1, axiosError2]);
      } catch (wrappedError) {
        expect(wrappedError).toBeTruthy();
      expect(wrappedError.getCombinedMessage()).toEqual('\
error1\n\
  Network error:\n\
    URL: https://api.example.com/data\n\
    Status: 401\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Access Denied\n\
    Reason: INSUFFICIENT_PERMISSIONS\n\
    Message: Invalid credentials\n\
    Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
    Description: The requested action requires administrative privileges. Please contact your workspace owner.\n\
  Network error:\n\
    URL: https://api.example.com/api/users/98765\n\
    Status: 404\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Resource Not Found\n\
    Reason: OBJECT_MISSING\n\
    Message: The specified user does not exist.\n\
    Detail: No record found with ID: \'user_98765\'.\n\
    Description: The requested user profile may have been deleted or the URL is incorrect.\
');
      expect(wrappedError.toString()).toEqual('\
error1\n\
  Network error:\n\
    URL: https://api.example.com/data\n\
    Status: 401\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Access Denied\n\
    Reason: INSUFFICIENT_PERMISSIONS\n\
    Message: Invalid credentials\n\
    Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
    Description: The requested action requires administrative privileges. Please contact your workspace owner.\n\
  Network error:\n\
    URL: https://api.example.com/api/users/98765\n\
    Status: 404\n\
    Code: ERR_BAD_REQUEST\n\
    Error: Resource Not Found\n\
    Reason: OBJECT_MISSING\n\
    Message: The specified user does not exist.\n\
    Detail: No record found with ID: \'user_98765\'.\n\
    Description: The requested user profile may have been deleted or the URL is incorrect.\
');
      }
    });
  });

  describe('Double Wrapped Error', () => {

    test('0: Double Wrapped FrodoError', async () => {
      const error = new FrodoError('error2', new FrodoError('error1', new FrodoError('error0')));
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('error2\n  error1\n    error0');
      expect(error.toString()).toEqual('error2\n  error1\n    error0');
    });

    test('1: Double Wrapped FrodoError (thrown and caught)', async () => {
      try {
        throw new FrodoError('error2', new FrodoError('error1', new FrodoError('error0')));
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.getCombinedMessage()).toEqual('error2\n  error1\n    error0');
        expect(error.toString()).toEqual('error2\n  error1\n    error0');
      }
    });

    test('2: Double Wrapped Error', async () => {
      const error = new FrodoError('error2', new FrodoError('error1', new Error('error0')));
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('error2\n  error1\n    error0');
      expect(error.toString()).toEqual('error2\n  error1\n    error0');
    });

    test('3: Double Wrapped Error (thrown and caught)', async () => {
      try {
        throw new FrodoError('error2', new FrodoError('error1', new Error('error0')));
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.getCombinedMessage()).toEqual('error2\n  error1\n    error0');
        expect(error.toString()).toEqual('error2\n  error1\n    error0');
      }
    });

    test('4: Double Wrapped AxiosError', async () => {
      const error = new FrodoError('error2', new FrodoError('error1', axiosError1));
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('\
error2\n\
  error1\n\
    Network error:\n\
      URL: https://api.example.com/data\n\
      Status: 401\n\
      Code: ERR_BAD_REQUEST\n\
      Error: Access Denied\n\
      Reason: INSUFFICIENT_PERMISSIONS\n\
      Message: Invalid credentials\n\
      Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
      Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
      expect(error.toString()).toEqual('\
error2\n\
  error1\n\
    Network error:\n\
      URL: https://api.example.com/data\n\
      Status: 401\n\
      Code: ERR_BAD_REQUEST\n\
      Error: Access Denied\n\
      Reason: INSUFFICIENT_PERMISSIONS\n\
      Message: Invalid credentials\n\
      Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
      Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
    });

    test('5: Double Wrapped AxiosError (thrown and caught)', async () => {
      try {
        throw new FrodoError('error2', new FrodoError('error1', axiosError1));
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.getCombinedMessage()).toEqual('\
error2\n\
  error1\n\
    Network error:\n\
      URL: https://api.example.com/data\n\
      Status: 401\n\
      Code: ERR_BAD_REQUEST\n\
      Error: Access Denied\n\
      Reason: INSUFFICIENT_PERMISSIONS\n\
      Message: Invalid credentials\n\
      Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
      Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
        expect(error.toString()).toEqual('\
error2\n\
  error1\n\
    Network error:\n\
      URL: https://api.example.com/data\n\
      Status: 401\n\
      Code: ERR_BAD_REQUEST\n\
      Error: Access Denied\n\
      Reason: INSUFFICIENT_PERMISSIONS\n\
      Message: Invalid credentials\n\
      Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
      Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
      }
    });
  });

  describe('Triple Wrapped Error', () => {

    test('0: Triple Wrapped FrodoError', async () => {
      const error = new FrodoError('error3', new FrodoError('error2', new FrodoError('error1', new FrodoError('error0'))));
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('error3\n  error2\n    error1\n      error0');
      expect(error.toString()).toEqual('error3\n  error2\n    error1\n      error0');
    });

    test('1: Triple Wrapped FrodoError (thrown and caught)', async () => {
      try {
        throw new FrodoError('error3', new FrodoError('error2', new FrodoError('error1', new FrodoError('error0'))));
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.getCombinedMessage()).toEqual('error3\n  error2\n    error1\n      error0');
        expect(error.toString()).toEqual('error3\n  error2\n    error1\n      error0');
      }
    });

    test('2: Triple Wrapped Error', async () => {
      const error = new FrodoError('error3', new FrodoError('error2', new FrodoError('error1', new Error('error0'))));
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('error3\n  error2\n    error1\n      error0');
      expect(error.toString()).toEqual('error3\n  error2\n    error1\n      error0');
    });

    test('3: Triple Wrapped Error (thrown and caught)', async () => {
      try {
        throw new FrodoError('error3', new FrodoError('error2', new FrodoError('error1', new Error('error0'))));
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.getCombinedMessage()).toEqual('error3\n  error2\n    error1\n      error0');
        expect(error.toString()).toEqual('error3\n  error2\n    error1\n      error0');
      }
    });

    test('4: Triple Wrapped AxiosError', async () => {
      const error = new FrodoError('error3', new FrodoError('error2', new FrodoError('error1', axiosError1)));
      expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('\
error3\n\
  error2\n\
    error1\n\
      Network error:\n\
        URL: https://api.example.com/data\n\
        Status: 401\n\
        Code: ERR_BAD_REQUEST\n\
        Error: Access Denied\n\
        Reason: INSUFFICIENT_PERMISSIONS\n\
        Message: Invalid credentials\n\
        Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
        Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
      expect(error.toString()).toEqual('\
error3\n\
  error2\n\
    error1\n\
      Network error:\n\
        URL: https://api.example.com/data\n\
        Status: 401\n\
        Code: ERR_BAD_REQUEST\n\
        Error: Access Denied\n\
        Reason: INSUFFICIENT_PERMISSIONS\n\
        Message: Invalid credentials\n\
        Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
        Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
    });

    test('5: Triple Wrapped AxiosError (thrown and caught)', async () => {
      try {
        throw new FrodoError('error3', new FrodoError('error2', new FrodoError('error1', axiosError1)));
      } catch (error) {
        expect(error).toBeTruthy();
      expect(error.getCombinedMessage()).toEqual('\
error3\n\
  error2\n\
    error1\n\
      Network error:\n\
        URL: https://api.example.com/data\n\
        Status: 401\n\
        Code: ERR_BAD_REQUEST\n\
        Error: Access Denied\n\
        Reason: INSUFFICIENT_PERMISSIONS\n\
        Message: Invalid credentials\n\
        Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
        Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
      expect(error.toString()).toEqual('\
error3\n\
  error2\n\
    error1\n\
      Network error:\n\
        URL: https://api.example.com/data\n\
        Status: 401\n\
        Code: ERR_BAD_REQUEST\n\
        Error: Access Denied\n\
        Reason: INSUFFICIENT_PERMISSIONS\n\
        Message: Invalid credentials\n\
        Detail: User \'jdoe_99\' does not have the \'REPORTS_EXPORT\' scope enabled.\n\
        Description: The requested action requires administrative privileges. Please contact your workspace owner.\
');
      }
    });
  });
});

describe('isNotFoundError', () => {
  test('false for a plain FrodoError with no wrapped cause', () => {
    expect(isNotFoundError(new FrodoError('error0'))).toBe(false);
  });

  test('false for a non-FrodoError value', () => {
    expect(isNotFoundError(new Error('error0'))).toBe(false);
    expect(isNotFoundError('error0')).toBe(false);
    expect(isNotFoundError(undefined)).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });

  test('true for a FrodoError directly wrapping a 404 AxiosError', () => {
    expect(isNotFoundError(new FrodoError('error1', axiosError2))).toBe(true);
  });

  test('false for a FrodoError directly wrapping a 401 AxiosError', () => {
    expect(isNotFoundError(new FrodoError('error1', axiosError1))).toBe(false);
  });

  test('false for a FrodoError directly wrapping a 500 AxiosError', () => {
    expect(isNotFoundError(new FrodoError('error1', axiosError500))).toBe(
      false
    );
  });

  test('false for a FrodoError wrapping a network/timeout error with no response', () => {
    expect(
      isNotFoundError(new FrodoError('error1', axiosTimeoutError))
    ).toBe(false);
  });

  test('true for a double-wrapped 404 (recurses through a nested FrodoError with its own null httpStatus)', () => {
    const inner = new FrodoError('error1', axiosError2);
    const outer = new FrodoError('error2', inner);
    // The outer wrap's own httpStatus is null (a FrodoError has no
    // `.response` for the constructor to read a status off of) -- the
    // recursion into originalErrors is what makes this true.
    expect(outer.httpStatus).toBeNull();
    expect(isNotFoundError(outer)).toBe(true);
  });

  test('true for a triple-wrapped 404', () => {
    const error = new FrodoError(
      'error3',
      new FrodoError('error2', new FrodoError('error1', axiosError2))
    );
    expect(isNotFoundError(error)).toBe(true);
  });

  test('false for a double-wrapped 401 (never a false positive just from nesting)', () => {
    const error = new FrodoError('error2', new FrodoError('error1', axiosError1));
    expect(isNotFoundError(error)).toBe(false);
  });

  test('false for a FrodoError wrapping a plain Error (no response at all)', () => {
    expect(isNotFoundError(new FrodoError('error1', new Error('boom')))).toBe(
      false
    );
  });

  test('true if any one error in a wrapped array is a 404, even if others are not', () => {
    const error = new FrodoError('error1', [axiosError1, axiosError2]);
    expect(isNotFoundError(error)).toBe(true);
  });

  test('false if a wrapped array has no 404 among several other failures', () => {
    const error = new FrodoError('error1', [axiosError1, axiosError500]);
    expect(isNotFoundError(error)).toBe(false);
  });
});
