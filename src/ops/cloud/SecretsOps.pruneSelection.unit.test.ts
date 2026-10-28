import { jest } from '@jest/globals';

const getSecret = jest.fn(async (_args?: any): Promise<any> => ({}));
const getSecretVersions = jest.fn(async (_args?: any): Promise<any> => []);
const deleteVersionOfSecret = jest.fn(async (args?: any): Promise<any> => ({
  version: args?.version,
  status: 'DESTROYED',
}));

jest.unstable_mockModule('../../api/cloud/SecretsApi', () => ({
  createNewVersionOfSecret: jest.fn(),
  deleteSecret: jest.fn(),
  deleteVersionOfSecret,
  getSecret,
  getSecrets: jest.fn(),
  getSecretVersions,
  getVersionOfSecret: jest.fn(),
  putSecret: jest.fn(),
  setSecretDescription: jest.fn(),
  setStatusOfVersionOfSecret: jest.fn(),
}));

const { findVersionsToPrune, pruneVersionsOfSecret, selectVersionsToPrune } =
  await import('./SecretsOps');

function mockState() {
  return {
    getDebugHandler: () => undefined,
    getCreateProgressHandler: () => undefined,
    getUpdateProgressHandler: () => undefined,
    getStopProgressHandler: () => undefined,
  } as any;
}

const version = (
  v: string,
  status: 'ENABLED' | 'DISABLED' | 'DESTROYED',
  loaded = false
): any => ({ version: v, status, loaded });

// 1 destroyed, 2 deactivated, 3 enabled and loaded, 4 enabled, 5 active
const secret = { activeVersion: '5', loadedVersion: '3' };
const versions = [
  version('1', 'DESTROYED'),
  version('2', 'DISABLED'),
  version('3', 'ENABLED', true),
  version('4', 'ENABLED'),
  version('5', 'ENABLED'),
];
const numbers = (list: { version: string }[]) => list.map((v) => v.version);

describe('selectVersionsToPrune', () => {
  test('prunes everything but the active and the destroyed versions by default', () => {
    expect(numbers(selectVersionsToPrune({ secret, versions }))).toEqual([
      '2',
      '3',
      '4',
    ]);
  });

  test('keepLoaded keeps the loaded version', () => {
    expect(
      numbers(selectVersionsToPrune({ secret, versions, keepLoaded: true }))
    ).toEqual(['2', '4']);
  });

  test('keepLoaded also honours the loadedVersion of the secret when the version carries no flag', () => {
    const unflagged = [version('3', 'ENABLED'), version('4', 'ENABLED')];
    expect(
      numbers(
        selectVersionsToPrune({
          secret: { activeVersion: '5', loadedVersion: '3' },
          versions: unflagged,
          keepLoaded: true,
        })
      )
    ).toEqual(['4']);
  });

  test('keepLoaded also honours the loaded flag on a version', () => {
    const flagged = [version('3', 'ENABLED', true), version('4', 'ENABLED')];
    expect(
      numbers(
        selectVersionsToPrune({
          secret: { activeVersion: '5' },
          versions: flagged,
          keepLoaded: true,
        })
      )
    ).toEqual(['4']);
  });

  test('keepDeactivated keeps the deactivated version', () => {
    expect(
      numbers(
        selectVersionsToPrune({ secret, versions, keepDeactivated: true })
      )
    ).toEqual(['3', '4']);
  });

  test('keepLoaded and keepDeactivated together keep both', () => {
    expect(
      numbers(
        selectVersionsToPrune({
          secret,
          versions,
          keepLoaded: true,
          keepDeactivated: true,
        })
      )
    ).toEqual(['4']);
  });

  test('never selects the active version, even when it is also loaded or deactivated', () => {
    const odd = [version('5', 'DISABLED', true)];
    expect(selectVersionsToPrune({ secret, versions: odd })).toEqual([]);
    expect(
      selectVersionsToPrune({
        secret,
        versions: odd,
        keepLoaded: true,
        keepDeactivated: true,
      })
    ).toEqual([]);
  });

  test('does not modify its input', () => {
    const copy = JSON.parse(JSON.stringify(versions));
    selectVersionsToPrune({ secret, versions });
    expect(versions).toEqual(copy);
  });
});

describe('findVersionsToPrune', () => {
  beforeEach(() => {
    getSecret.mockReset();
    getSecret.mockResolvedValue(secret);
    getSecretVersions.mockReset();
    getSecretVersions.mockResolvedValue(versions);
    deleteVersionOfSecret.mockClear();
  });

  test('returns the versions pruning would delete and deletes nothing', async () => {
    const found = await findVersionsToPrune({
      secretId: 'esv-test',
      state: mockState(),
    });
    expect(numbers(found)).toEqual(['2', '3', '4']);
    expect(deleteVersionOfSecret).not.toHaveBeenCalled();
  });

  test('passes keepLoaded and keepDeactivated through', async () => {
    const found = await findVersionsToPrune({
      secretId: 'esv-test',
      keepLoaded: true,
      keepDeactivated: true,
      state: mockState(),
    });
    expect(numbers(found)).toEqual(['4']);
  });

  test('prune deletes exactly the versions find reports, for every flag combination', async () => {
    for (const keepLoaded of [false, true]) {
      for (const keepDeactivated of [false, true]) {
        deleteVersionOfSecret.mockClear();
        const found = await findVersionsToPrune({
          secretId: 'esv-test',
          keepLoaded,
          keepDeactivated,
          state: mockState(),
        });
        await pruneVersionsOfSecret({
          secretId: 'esv-test',
          keepLoaded,
          keepDeactivated,
          state: mockState(),
        });
        const deleted = deleteVersionOfSecret.mock.calls.map(
          ([args]: any[]) => args.version
        );
        expect(deleted).toEqual(numbers(found));
      }
    }
  });

  test('fails with a FrodoError that names the secret when a read fails', async () => {
    getSecretVersions.mockRejectedValue(new Error('boom'));
    await expect(
      findVersionsToPrune({ secretId: 'esv-test', state: mockState() })
    ).rejects.toThrow(/versions of secret esv-test to prune/);
    expect(deleteVersionOfSecret).not.toHaveBeenCalled();
  });
});
