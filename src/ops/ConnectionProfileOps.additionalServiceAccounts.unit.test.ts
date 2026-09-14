/**
 * Run tests
 *
 *        npm run test:only ConnectionProfileOps.additionalServiceAccounts
 *
 * Regression coverage for named, independently-addressable additional
 * service accounts on a connection profile — built for the MCP HTTP
 * transport's claim-to-credential mapping ("shared mode"): an operator
 * pre-provisions one or more named service accounts with different
 * privilege levels, and a claim in an external caller's token selects
 * which one a session should use, by name.
 *
 * Real, isolated file I/O round trips (no mocking), matching
 * ConnectionProfileOps.browserLogin.unit.test.ts's pattern.
 */
import fs from 'fs';
import { resolve } from 'path';

// Forces the full, correctly-ordered module graph (via the package barrel)
// to initialize before touching ConnectionProfileOps.ts directly below —
// see ConnectionProfileOps.test.ts's identical import order.
import '../index';
import {
  addAdditionalServiceAccount,
  getAdditionalServiceAccount,
  listAdditionalServiceAccounts,
  removeAdditionalServiceAccount,
  saveConnectionProfile,
} from './ConnectionProfileOps';
import StateImpl from '../shared/State';
import { FrodoError } from './FrodoError';

const TMP_DIR = resolve(
  '.',
  'test',
  'fs_tmp',
  'ConnectionProfileOps.additionalServiceAccounts'
);

function freshState(host: string, connectionProfilesPath: string) {
  const state = StateImpl({ host });
  state.setConnectionProfilesPath(connectionProfilesPath);
  state.setMasterKeyPath(resolve(TMP_DIR, 'masterkey.key'));
  return state;
}

async function getUnderlyingError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    let current = error;
    while (
      current instanceof FrodoError &&
      current.originalErrors.length > 0
    ) {
      current = current.originalErrors[0];
    }
    return current as Error;
  }
  throw new Error('Expected promise to reject, but it resolved.');
}

describe('Additional service accounts on a connection profile', () => {
  beforeAll(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    // A stable, pre-existing master key avoids DataProtection's own
    // async auto-generate-on-first-use path racing with afterAll's cleanup.
    fs.writeFileSync(resolve(TMP_DIR, 'masterkey.key'), 'test-master-key');
  });

  afterAll(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  function newProfilePath(name: string) {
    return resolve(TMP_DIR, `${name}.connections.json`);
  }

  async function seedProfile(host: string, connectionProfilesPath: string) {
    const state = freshState(host, connectionProfilesPath);
    state.setDeploymentType('cloud');
    await saveConnectionProfile({ host, state });
    return state;
  }

  test('1: add, then list (no secrets) and get (decrypted) round trip correctly', async () => {
    const host = 'https://openam-asa1.example.com/am';
    const connectionProfilesPath = newProfilePath('asa1');
    const state = await seedProfile(host, connectionProfilesPath);

    await addAdditionalServiceAccount({
      host,
      name: 'readonly-sa',
      svcacctId: 'sa-id-1',
      svcacctJwk: { kty: 'RSA', kid: 'k1' } as any,
      svcacctScope: 'fr:idm:read',
      state,
    });

    const listed = listAdditionalServiceAccounts({ host, state });
    expect(listed).toEqual([
      { name: 'readonly-sa', svcacctId: 'sa-id-1', svcacctScope: 'fr:idm:read' },
    ]);
    // list() never decrypts/exposes the JWK.
    expect(listed[0]).not.toHaveProperty('svcacctJwk');

    const fetched = await getAdditionalServiceAccount({
      host,
      name: 'readonly-sa',
      state,
    });
    expect(fetched).toEqual({
      name: 'readonly-sa',
      svcacctId: 'sa-id-1',
      svcacctJwk: { kty: 'RSA', kid: 'k1' },
      svcacctScope: 'fr:idm:read',
    });
  });

  test('2: a second, differently-named entry coexists with the first', async () => {
    const host = 'https://openam-asa2.example.com/am';
    const connectionProfilesPath = newProfilePath('asa2');
    const state = await seedProfile(host, connectionProfilesPath);

    await addAdditionalServiceAccount({
      host,
      name: 'readonly-sa',
      svcacctId: 'sa-id-1',
      svcacctJwk: { kty: 'RSA', kid: 'k1' } as any,
      state,
    });
    await addAdditionalServiceAccount({
      host,
      name: 'admin-sa',
      svcacctId: 'sa-id-2',
      svcacctJwk: { kty: 'RSA', kid: 'k2' } as any,
      state,
    });

    const listed = listAdditionalServiceAccounts({ host, state });
    expect(listed.map((sa) => sa.name).sort()).toEqual([
      'admin-sa',
      'readonly-sa',
    ]);
  });

  test('3: adding a duplicate name throws a clear error', async () => {
    const host = 'https://openam-asa3.example.com/am';
    const connectionProfilesPath = newProfilePath('asa3');
    const state = await seedProfile(host, connectionProfilesPath);

    await addAdditionalServiceAccount({
      host,
      name: 'readonly-sa',
      svcacctId: 'sa-id-1',
      svcacctJwk: { kty: 'RSA', kid: 'k1' } as any,
      state,
    });

    const error = await getUnderlyingError(
      addAdditionalServiceAccount({
        host,
        name: 'readonly-sa',
        svcacctId: 'sa-id-2',
        svcacctJwk: { kty: 'RSA', kid: 'k2' } as any,
        state,
      })
    );
    expect(error.message).toMatch(/already exists/);
  });

  test('4: remove deletes exactly the named entry, leaving others intact', async () => {
    const host = 'https://openam-asa4.example.com/am';
    const connectionProfilesPath = newProfilePath('asa4');
    const state = await seedProfile(host, connectionProfilesPath);

    await addAdditionalServiceAccount({
      host,
      name: 'readonly-sa',
      svcacctId: 'sa-id-1',
      svcacctJwk: { kty: 'RSA', kid: 'k1' } as any,
      state,
    });
    await addAdditionalServiceAccount({
      host,
      name: 'admin-sa',
      svcacctId: 'sa-id-2',
      svcacctJwk: { kty: 'RSA', kid: 'k2' } as any,
      state,
    });

    removeAdditionalServiceAccount({ host, name: 'readonly-sa', state });

    const listed = listAdditionalServiceAccounts({ host, state });
    expect(listed.map((sa) => sa.name)).toEqual(['admin-sa']);
  });

  test('5: removing or getting an unknown name throws a clear error', async () => {
    const host = 'https://openam-asa5.example.com/am';
    const connectionProfilesPath = newProfilePath('asa5');
    const state = await seedProfile(host, connectionProfilesPath);

    expect(() =>
      removeAdditionalServiceAccount({ host, name: 'nope', state })
    ).toThrow(/No additional service account named 'nope'/);

    const error = await getUnderlyingError(
      getAdditionalServiceAccount({ host, name: 'nope', state })
    );
    expect(error.message).toMatch(/No additional service account named 'nope'/);
  });

  test('6: an unrelated later saveConnectionProfile() call never clobbers previously-added additional service accounts', async () => {
    const host = 'https://openam-asa6.example.com/am';
    const connectionProfilesPath = newProfilePath('asa6');
    const state = await seedProfile(host, connectionProfilesPath);

    await addAdditionalServiceAccount({
      host,
      name: 'readonly-sa',
      svcacctId: 'sa-id-1',
      svcacctJwk: { kty: 'RSA', kid: 'k1' } as any,
      state,
    });

    // An entirely unrelated later save (e.g. setting a plain username, as
    // `frodo login --save` would) must not wipe out what was just added.
    state.setUsername('jdoe');
    state.setPassword('s3cr3t');
    await saveConnectionProfile({ host, state });

    const listed = listAdditionalServiceAccounts({ host, state });
    expect(listed.map((sa) => sa.name)).toEqual(['readonly-sa']);
  });
});
