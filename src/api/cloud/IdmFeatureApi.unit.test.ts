import { jest } from '@jest/globals';

/**
 * The api layer of the IDM feature endpoint passes the response body through
 * as it is: which fields it has depends on the action (validate sends
 * `success` and `failures`, install does not), and the ops layer states the
 * outcome. Mocked unit test: no recordings.
 */

const get = jest.fn(async (_url?: any): Promise<any> => ({ data: {} }));
const post = jest.fn(async (_url?: any, _body?: any): Promise<any> => ({
  data: {},
}));
const generateIdmApi = jest.fn((_args?: any) => ({ get, post }));

jest.unstable_mockModule('../BaseApi', () => ({ generateIdmApi }));
jest.unstable_mockModule('../../utils/ForgeRockUtils', () => ({
  getIdmBaseUrl: jest.fn(() => 'https://idm.example.com/openidm'),
}));

const { validateIdmFeature, installIdmFeature } =
  await import('./IdmFeatureApi');

const state = {} as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validateIdmFeature', () => {
  test('posts the validate action and returns the body as sent', async () => {
    const body = {
      status: 200,
      success: false,
      message: 'Validate complete. 1 failure(s).',
      failures: ['config/managed: /objects/-: value already present'],
    };
    post.mockResolvedValueOnce({ data: body });
    const response = await validateIdmFeature({ featureId: 'aiagent', state });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      'https://idm.example.com/openidm/feature/aiagent?_action=validate',
      {}
    );
    expect(response).toEqual(body);
  });
});

describe('installIdmFeature', () => {
  test('posts the install action and returns the body without adding fields', async () => {
    post.mockResolvedValueOnce({
      data: { status: 200, message: 'Install complete.' },
    });
    const response = await installIdmFeature({
      featureId: 'am/2fa/profiles',
      state,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      'https://idm.example.com/openidm/feature/am/2fa/profiles?_action=install',
      {}
    );
    expect(response).toEqual({ status: 200, message: 'Install complete.' });
    expect(response).not.toHaveProperty('success');
    expect(response).not.toHaveProperty('failures');
  });

  test('lets a failed request throw', async () => {
    post.mockRejectedValueOnce(
      new Error('Request failed with status code 500')
    );
    await expect(
      installIdmFeature({ featureId: 'groups', state })
    ).rejects.toThrow('Request failed with status code 500');
  });
});
