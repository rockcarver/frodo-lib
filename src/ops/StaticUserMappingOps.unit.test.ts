/**
 * Run tests
 *
 *        npm run test:only StaticUserMappingOps.unit
 *
 * The operations read the whole `authentication` config entity, change its list
 * of static user mappings and write the whole entity back. The tests use a fake
 * of the config operations: what matters is what is written, and that nothing
 * else in the entity, and no other mapping, is disturbed.
 */
import { jest } from '@jest/globals';

let stored: any;
const readConfigEntity = jest.fn(async (_args?: any): Promise<any> =>
  structuredClone(stored)
);
const updateConfigEntity = jest.fn(async (args?: any): Promise<any> => {
  stored = structuredClone(args.entityData);
  return args.entityData;
});

jest.unstable_mockModule('./IdmConfigOps', () => ({
  readConfigEntity,
  updateConfigEntity,
}));

jest.unstable_mockModule('../utils/Console', () => ({
  debugMessage: jest.fn(),
}));

const Ops = await import('./StaticUserMappingOps');
const { default: createOps } = Ops;

const state = {} as any;

/** The whole message a caller sees: the error and the causes it wraps */
async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as any).getCombinedMessage?.() ?? (error as Error).message;
  }
  throw new Error('expected the call to fail');
}

const admin = {
  subject: 'payment-api',
  localUser: 'internal/user/openidm-admin',
  userRoles: 'authzRoles/*',
  roles: ['internal/role/openidm-authorized', 'internal/role/openidm-admin'],
};

const rcs = {
  subject: 'rcs-custom-client',
  localUser: 'internal/user/idm-provisioning',
  roles: ['internal/role/platform-provisioning'],
  executeAugmentationScript: false,
};

function authentication(mappings?: any[]) {
  return {
    _id: 'authentication',
    rsFilter: {
      augmentSecurityContext: { type: 'text/javascript', source: 'x' },
      cache: { maxTimeout: '300 seconds' },
      scopes: ['fr:idm:*'],
      subjectMapping: [{ propertyMapping: { sub: 'userName' } }],
      ...(mappings ? { staticUserMapping: mappings } : {}),
    },
    another: 'kept',
  };
}

function written() {
  expect(updateConfigEntity).toHaveBeenCalledTimes(1);
  const args = updateConfigEntity.mock.calls[0][0] as any;
  expect(args.entityId).toBe('authentication');
  return args.entityData;
}

/** everything except the list of mappings, as written */
function restOf(entity: any) {
  const { staticUserMapping: _removed, ...rsFilter } = entity.rsFilter;
  return { ...entity, rsFilter };
}

const untouchedRest = restOf(authentication());

beforeEach(() => {
  jest.clearAllMocks();
  stored = authentication([structuredClone(admin), structuredClone(rcs)]);
});

describe('read', () => {
  it('returns the mappings', async () => {
    expect(await Ops.readStaticUserMappings({ state })).toEqual([admin, rcs]);
  });

  it('returns an empty list when there is no list or no rsFilter', async () => {
    stored = authentication();
    expect(await Ops.readStaticUserMappings({ state })).toEqual([]);
    stored = { _id: 'authentication' };
    expect(await Ops.readStaticUserMappings({ state })).toEqual([]);
  });

  it('returns the mapping of a subject and fails for an unknown one', async () => {
    expect(
      await Ops.readStaticUserMapping({ subject: 'payment-api', state })
    ).toEqual(admin);
    await expect(
      Ops.readStaticUserMapping({ subject: 'nobody', state })
    ).rejects.toThrow("Static user mapping 'nobody' not found");
  });

  it('returns copies: changing a result does not change the entity it was read from', async () => {
    // hand out the very object that is "stored", as a cache or a shared
    // response object would
    readConfigEntity.mockImplementation(async () => stored);
    const first = await Ops.readStaticUserMappings({ state });
    first[0].roles = [];
    first.pop();
    const one = await Ops.readStaticUserMapping({
      subject: 'rcs-custom-client',
      state,
    });
    one.roles = ['changed'];
    expect(stored.rsFilter.staticUserMapping).toEqual([admin, rcs]);
    readConfigEntity.mockImplementation(async () => structuredClone(stored));
  });

  it('is reachable through the factory', async () => {
    const ops = createOps(state);
    expect(await ops.readStaticUserMappings()).toEqual([admin, rcs]);
    expect(await ops.readStaticUserMapping('payment-api')).toEqual(admin);
  });
});

describe('create', () => {
  const added = {
    subject: 'frodo-remote-proxy',
    localUser: 'internal/user/openidm-admin',
    userRoles: 'authzRoles/*',
    roles: ['internal/role/openidm-authorized', 'internal/role/openidm-admin'],
  };

  it('adds the mapping, keeps the others in order and the rest of the entity as it was', async () => {
    const result = await Ops.createStaticUserMapping({ mapping: added, state });
    expect(result).toEqual(added);
    const entity = written();
    expect(entity.rsFilter.staticUserMapping).toEqual([admin, rcs, added]);
    expect(restOf(entity)).toEqual(untouchedRest);
  });

  it('creates the list when the entity has none yet', async () => {
    stored = authentication();
    await Ops.createStaticUserMapping({ mapping: added, state });
    expect(written().rsFilter.staticUserMapping).toEqual([added]);
  });

  it('fails for an existing subject and writes nothing', async () => {
    expect(
      await failureOf(
        Ops.createStaticUserMapping({
          mapping: { ...added, subject: 'payment-api' },
          state,
        })
      )
    ).toContain("Static user mapping 'payment-api' already exists");
    expect(updateConfigEntity).not.toHaveBeenCalled();
  });

  it('does not write into an entity that has no rsFilter', async () => {
    stored = { _id: 'authentication' };
    expect(
      await failureOf(Ops.createStaticUserMapping({ mapping: added, state }))
    ).toContain('has no rsFilter');
    expect(updateConfigEntity).not.toHaveBeenCalled();
  });

  it.each([
    ['no subject', { ...added, subject: '' }, /needs a subject/],
    ['no localUser', { ...added, localUser: '' }, /needs a localUser/],
    [
      'roles that are not an array',
      { ...added, roles: 'admin' },
      /array of role names/,
    ],
    ['an empty role', { ...added, roles: [''] }, /array of role names/],
    ['empty userRoles', { ...added, userRoles: '' }, /userRoles/],
  ])(
    'refuses %s before it reads or writes anything',
    async (_name, mapping, message) => {
      await expect(
        Ops.createStaticUserMapping({ mapping: mapping as any, state })
      ).rejects.toThrow(message);
      expect(readConfigEntity).not.toHaveBeenCalled();
      expect(updateConfigEntity).not.toHaveBeenCalled();
    }
  );
});

describe('update', () => {
  it('replaces the mapping of the subject as given and keeps the others', async () => {
    const replacement = {
      subject: 'payment-api',
      localUser: 'internal/user/idm-provisioning',
      roles: ['internal/role/platform-provisioning'],
    };
    await Ops.updateStaticUserMapping({ mapping: replacement, state });
    const entity = written();
    expect(entity.rsFilter.staticUserMapping).toEqual([replacement, rcs]);
    expect(restOf(entity)).toEqual(untouchedRest);
  });

  it('creates the mapping of an unknown subject', async () => {
    const mapping = {
      subject: 'new',
      localUser: 'internal/user/openidm-admin',
    };
    await Ops.updateStaticUserMapping({ mapping, state });
    expect(written().rsFilter.staticUserMapping).toEqual([admin, rcs, mapping]);
  });
});

describe('ensure', () => {
  const wanted = {
    subject: 'frodo-remote-proxy',
    localUser: 'internal/user/openidm-admin',
    userRoles: 'authzRoles/*',
    roles: ['internal/role/openidm-authorized', 'internal/role/openidm-admin'],
  };

  it('creates a missing mapping', async () => {
    const result = await Ops.ensureStaticUserMapping({
      mapping: wanted,
      state,
    });
    expect(result).toEqual({ mapping: wanted, outcome: 'created' });
    expect(written().rsFilter.staticUserMapping).toEqual([admin, rcs, wanted]);
  });

  it('changes nothing and writes nothing when the mapping has everything', async () => {
    const result = await Ops.ensureStaticUserMapping({
      mapping: { ...wanted, subject: 'payment-api' },
      state,
    });
    expect(result.outcome).toBe('unchanged');
    expect(result.mapping).toEqual(admin);
    expect(updateConfigEntity).not.toHaveBeenCalled();
  });

  it('is idempotent: a second call after the first writes nothing', async () => {
    await Ops.ensureStaticUserMapping({ mapping: wanted, state });
    updateConfigEntity.mockClear();
    const again = await Ops.ensureStaticUserMapping({ mapping: wanted, state });
    expect(again.outcome).toBe('unchanged');
    expect(updateConfigEntity).not.toHaveBeenCalled();
  });

  it('merges roles: keeps the existing roles and their order, adds the missing ones, keeps other properties and other mappings', async () => {
    const result = await Ops.ensureStaticUserMapping({
      mapping: {
        subject: 'rcs-custom-client',
        localUser: 'internal/user/idm-provisioning',
        roles: [
          'internal/role/openidm-authorized',
          'internal/role/platform-provisioning',
        ],
      },
      state,
    });
    expect(result.outcome).toBe('updated');
    const entity = written();
    expect(entity.rsFilter.staticUserMapping).toEqual([
      admin,
      {
        ...rcs,
        roles: [
          'internal/role/platform-provisioning',
          'internal/role/openidm-authorized',
        ],
      },
    ]);
    expect(entity.rsFilter.staticUserMapping[1].executeAugmentationScript).toBe(
      false
    );
    expect(restOf(entity)).toEqual(untouchedRest);
  });

  it('adds userRoles when the existing mapping has none', async () => {
    const result = await Ops.ensureStaticUserMapping({
      mapping: { ...rcs, userRoles: 'authzRoles/*' },
      state,
    });
    expect(result.outcome).toBe('updated');
    expect(written().rsFilter.staticUserMapping[1].userRoles).toBe(
      'authzRoles/*'
    );
  });

  it('gives a mapping without roles the requested roles', async () => {
    stored = authentication([{ subject: 'a', localUser: 'internal/user/x' }]);
    const result = await Ops.ensureStaticUserMapping({
      mapping: { subject: 'a', localUser: 'internal/user/x', roles: ['r1'] },
      state,
    });
    expect(result.outcome).toBe('updated');
    expect(written().rsFilter.staticUserMapping).toEqual([
      { subject: 'a', localUser: 'internal/user/x', roles: ['r1'] },
    ]);
  });

  it('does not write for a request without roles on a mapping that exists', async () => {
    stored = authentication([{ subject: 'a', localUser: 'internal/user/x' }]);
    const result = await Ops.ensureStaticUserMapping({
      mapping: { subject: 'a', localUser: 'internal/user/x', roles: [] },
      state,
    });
    expect(result.outcome).toBe('unchanged');
    expect(updateConfigEntity).not.toHaveBeenCalled();
  });

  it('refuses to point an existing subject at another local user', async () => {
    expect(
      await failureOf(
        Ops.ensureStaticUserMapping({
          mapping: { ...admin, localUser: 'internal/user/idm-provisioning' },
          state,
        })
      )
    ).toMatch(/maps to 'internal\/user\/openidm-admin'.*refusing/);
    expect(updateConfigEntity).not.toHaveBeenCalled();
  });

  it('refuses to change where the roles of an existing mapping come from', async () => {
    expect(
      await failureOf(
        Ops.ensureStaticUserMapping({
          mapping: { ...admin, userRoles: 'managed/user/x' },
          state,
        })
      )
    ).toMatch(/userRoles 'authzRoles\/\*'.*refusing/);
    expect(updateConfigEntity).not.toHaveBeenCalled();
  });

  it('refuses an invalid mapping before it reads anything', async () => {
    await expect(
      Ops.ensureStaticUserMapping({
        mapping: { subject: '', localUser: 'x' },
        state,
      })
    ).rejects.toThrow('needs a subject');
    expect(readConfigEntity).not.toHaveBeenCalled();
  });
});

describe('delete', () => {
  it('removes only the mapping of the subject and returns it', async () => {
    const deleted = await Ops.deleteStaticUserMapping({
      subject: 'payment-api',
      state,
    });
    expect(deleted).toEqual(admin);
    const entity = written();
    expect(entity.rsFilter.staticUserMapping).toEqual([rcs]);
    expect(restOf(entity)).toEqual(untouchedRest);
  });

  it('fails for an unknown subject and writes nothing', async () => {
    expect(
      await failureOf(Ops.deleteStaticUserMapping({ subject: 'nobody', state }))
    ).toContain("Static user mapping 'nobody' not found");
    expect(updateConfigEntity).not.toHaveBeenCalled();
  });

  it('refuses an empty subject before it reads anything', async () => {
    await expect(
      Ops.deleteStaticUserMapping({ subject: '', state })
    ).rejects.toThrow('needs a subject');
    expect(readConfigEntity).not.toHaveBeenCalled();
  });

  it('leaves an empty list, not a missing one, when the last mapping goes', async () => {
    stored = authentication([structuredClone(admin)]);
    await Ops.deleteStaticUserMapping({ subject: 'payment-api', state });
    expect(written().rsFilter.staticUserMapping).toEqual([]);
  });
});

describe('through the factory', () => {
  it('creates, ensures, updates and deletes', async () => {
    const ops = createOps(state);
    const mapping = {
      subject: 'z',
      localUser: 'internal/user/openidm-admin',
      roles: ['r'],
    };
    await ops.createStaticUserMapping(mapping);
    expect(await ops.readStaticUserMapping('z')).toEqual(mapping);
    expect(
      (await ops.ensureStaticUserMapping({ ...mapping, roles: ['r', 's'] }))
        .outcome
    ).toBe('updated');
    await ops.updateStaticUserMapping({ ...mapping, roles: ['only'] });
    expect((await ops.readStaticUserMapping('z')).roles).toEqual(['only']);
    expect(await ops.deleteStaticUserMapping('z')).toEqual({
      ...mapping,
      roles: ['only'],
    });
    expect((await ops.readStaticUserMappings()).map((m) => m.subject)).toEqual([
      'payment-api',
      'rcs-custom-client',
    ]);
  });
});
