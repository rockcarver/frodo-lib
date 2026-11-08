import { jest } from '@jest/globals';

/**
 * `exportSocialIdentityProviders` collects one error per provider whose
 * dependencies cannot be exported, and each error names the provider.
 * Mocked unit test: no recordings.
 */

const getSocialIdentityProviders = jest.fn(
  async (_args?: any): Promise<any> => ({ result: [] })
);

const actualApi = await import('../api/SocialIdentityProvidersApi');
jest.unstable_mockModule('../api/SocialIdentityProvidersApi', () => ({
  ...actualApi,
  getSocialIdentityProviders,
}));

const readScript = jest.fn(async (_args?: any): Promise<any> => ({}));
const actualScriptOps = await import('./ScriptOps');
jest.unstable_mockModule('./ScriptOps', () => ({
  ...actualScriptOps,
  readScript,
}));

const actualConsole = await import('../utils/Console');
jest.unstable_mockModule('../utils/Console', () => ({
  ...actualConsole,
  createProgressIndicator: jest.fn(() => 'progress-id'),
  debugMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
}));

const actualExportImportUtils = await import('../utils/ExportImportUtils');
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  ...actualExportImportUtils,
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));

const { exportSocialIdentityProviders } = await import('./IdpOps');

const state = {
  getRealm: () => 'alpha',
  getDeploymentType: () => 'cloud',
} as any;

/** The messages of an error and of everything nested in it. */
function messagesOf(error: any): string {
  return [error?.message, ...(error?.originalErrors ?? []).map(messagesOf)]
    .filter(Boolean)
    .join(' | ');
}

beforeEach(() => {
  jest.clearAllMocks();
  getSocialIdentityProviders.mockReset();
  getSocialIdentityProviders.mockImplementation(async () => ({
    result: [
      { _id: 'google', transform: 'script-google' },
      { _id: 'github', transform: 'script-github' },
    ],
  }));
  readScript.mockReset();
  readScript.mockImplementation(async ({ scriptId }: any) => ({
    _id: scriptId,
    script: Buffer.from('return 1;').toString('base64'),
  }));
});

describe('exportSocialIdentityProviders', () => {
  test('exports the providers with the scripts they use', async () => {
    const exported = await exportSocialIdentityProviders({ state });

    expect(Object.keys(exported.idp)).toEqual(['google', 'github']);
    expect(Object.keys(exported.script)).toEqual([
      'script-google',
      'script-github',
    ]);
  });

  test('a provider whose script cannot be read is named in its error', async () => {
    readScript.mockImplementation(async ({ scriptId }: any) => {
      if (scriptId === 'script-github') throw new Error('HTTP 404');
      return { _id: scriptId, script: Buffer.from('x').toString('base64') };
    });

    const error: any = await exportSocialIdentityProviders({ state }).catch(
      (e) => e
    );

    // providers -> dependencies -> one error per failed provider
    const dependencies = error.originalErrors[0];
    expect(dependencies.originalErrors).toHaveLength(1);
    expect(dependencies.originalErrors[0].message).toContain('provider github');
    expect(messagesOf(dependencies.originalErrors[0])).toContain('HTTP 404');
  });
});
