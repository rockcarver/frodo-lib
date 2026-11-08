import { jest } from '@jest/globals';
import { encode } from '../utils/Base64Utils';
import type {
  ApplicationOwnedKind,
  ApplicationSkeleton,
  ApplicationSsoEntities,
} from './ApplicationOps';

/**
 * Which application owns an object is read from the application records: `ssoEntities.oidcId` (the OAuth2 client),
 * `ssoEntities.idpPrivateId` and `ssoEntities.spPrivateId` (base64 SAML entity ids), `connectorId` and `mappingNames`.
 * The index is built from those records alone: it reads the applications once and nothing per object, and the pure
 * variant reads nothing, so records from files can be indexed without a tenant.
 * Mocked unit test: no recordings. Only `readManagedObjects` is replaced; every other module is the real one, so the
 * test does not depend on the export lists of the modules ApplicationOps imports.
 */

const actualManagedObjectOps = await import('./ManagedObjectOps');
const readManagedObjects = jest.fn(async (_args?: any): Promise<any[]> => []);
jest.unstable_mockModule('./ManagedObjectOps', () => ({
  ...actualManagedObjectOps,
  readManagedObjects,
}));

const {
  default: ApplicationOps,
  getApplicationOwners,
  getApplicationOwnership,
  getApplicationRecordReferences,
  readApplicationOwnership,
} = await import('./ApplicationOps');
const { FrodoError } = await import('./FrodoError');

/** A state that answers every getter with undefined, except for the ones given. */
function mockState(realm = '/alpha') {
  const answers: Record<string, unknown> = {
    getRealm: realm,
    getDeploymentType: 'cloud',
    getIsIGA: false,
    getUseRealmPrefixOnManagedObjects: false,
  };
  return new Proxy(
    {},
    {
      get: (_target, name: string) => () => answers[name],
    }
  ) as any;
}

/** The error at the bottom of a chain of FrodoErrors. */
function rootCause(error: any): any {
  let current = error;
  while (current?.originalErrors?.length) {
    current = current.originalErrors[0];
  }
  return current;
}

const idpEntityId = 'https://idp.example.com/matrix';
const spEntityId = 'https://sp.example.com/matrix';

/** A record with every field of the skeleton filled in, except what the test overrides. */
function application(
  overrides: Partial<ApplicationSkeleton>
): ApplicationSkeleton {
  return {
    _id: 'app-1',
    authoritative: false,
    connectorId: undefined,
    description: '',
    icon: '',
    mappingNames: [],
    name: 'matrix-app',
    templateName: 'template',
    templateVersion: '1.0',
    uiConfig: {},
    url: '',
    ...overrides,
  };
}

const oidcSso: ApplicationSsoEntities = {
  oidcId: 'matrix-client',
  idpLoginUrl: 'https://login.example.com/matrix',
};

const samlSso: ApplicationSsoEntities = {
  domain: 'example.com',
  idpLocation: 'idp-location',
  idpLoginUrl: 'https://login.example.com/matrix',
  idpPrivateId: encode(idpEntityId, false),
  key: 'signing-key',
  spLocation: 'sp-location',
  spPrivateId: encode(spEntityId, false),
};

const wsfedSso: ApplicationSsoEntities = {
  domain: 'example.com',
  idpLoginUrl: 'https://login.example.com/matrix',
  pfApcId: 'apc-1',
  pfIdpAdapterId: 'adapter-1',
  pfPolicyId: 'policy-1',
  pfSigningCertId: 'cert-1',
  pfSpConnectionId: 'connection-1',
};

describe('the references an application record holds itself', () => {
  test('an OIDC record names its OAuth2 client', () => {
    expect(
      getApplicationRecordReferences(
        application({ name: 'matrix-web', ssoEntities: oidcSso })
      )
    ).toEqual([
      {
        kind: 'oauth2Client',
        id: 'matrix-client',
        ownership: 'owned',
        from: 'ssoEntities.oidcId',
      },
    ]);
  });

  test('a SAML record names its identity provider and its service provider by the decoded entity id', () => {
    expect(
      getApplicationRecordReferences(application({ ssoEntities: samlSso }))
    ).toEqual([
      {
        kind: 'saml2Provider',
        id: idpEntityId,
        ownership: 'owned',
        from: 'ssoEntities.idpPrivateId',
      },
      {
        kind: 'saml2Provider',
        id: spEntityId,
        ownership: 'owned',
        from: 'ssoEntities.spPrivateId',
      },
    ]);
  });

  test('a provisioning record names its connector and its mappings', () => {
    expect(
      getApplicationRecordReferences(
        application({
          connectorId: 'matrix-csv',
          mappingNames: ['systemMatrixUser_managedAlpha_user'],
        })
      )
    ).toEqual([
      {
        kind: 'connector',
        id: 'matrix-csv',
        ownership: 'owned',
        from: 'connectorId',
      },
      {
        kind: 'mapping',
        id: 'systemMatrixUser_managedAlpha_user',
        ownership: 'owned',
        from: 'mappingNames',
      },
    ]);
  });
});

describe('building the ownership index from records', () => {
  test('an OIDC application owns its OAuth2 client', () => {
    expect(
      getApplicationOwnership([
        application({
          _id: 'app-oidc',
          name: 'Matrix Web',
          ssoEntities: oidcSso,
        }),
      ])
    ).toEqual({
      entries: [
        {
          kind: 'oauth2Client',
          id: 'matrix-client',
          owners: [
            { applicationId: 'app-oidc', applicationName: 'Matrix Web' },
          ],
        },
      ],
    });
  });

  test('a SAML application owns its identity provider and its service provider, keyed by the decoded entity id', () => {
    const { entries } = getApplicationOwnership([
      application({
        _id: 'app-saml',
        name: 'Matrix SAML',
        ssoEntities: samlSso,
      }),
    ]);
    const owner = { applicationId: 'app-saml', applicationName: 'Matrix SAML' };
    expect(entries).toEqual([
      { kind: 'saml2Provider', id: idpEntityId, owners: [owner] },
      { kind: 'saml2Provider', id: spEntityId, owners: [owner] },
    ]);
  });

  test('a provisioning application owns its connector and its mappings', () => {
    const { entries } = getApplicationOwnership([
      application({
        _id: 'app-csv',
        name: 'Matrix CSV',
        connectorId: 'matrix-csv',
        mappingNames: [
          'systemMatrixUser_managedAlpha_user',
          'managedAlpha_user_systemMatrixUser',
        ],
      }),
    ]);
    const owner = { applicationId: 'app-csv', applicationName: 'Matrix CSV' };
    expect(entries).toEqual([
      { kind: 'connector', id: 'matrix-csv', owners: [owner] },
      {
        kind: 'mapping',
        id: 'managedAlpha_user_systemMatrixUser',
        owners: [owner],
      },
      {
        kind: 'mapping',
        id: 'systemMatrixUser_managedAlpha_user',
        owners: [owner],
      },
    ]);
  });

  test('an application that names nothing owns nothing, and no records give an empty index', () => {
    expect(
      getApplicationOwnership([
        application({ name: 'Matrix bookmark' }),
        application({
          _id: 'app-wsfed',
          name: 'Matrix WS-Fed',
          ssoEntities: wsfedSso,
        }),
      ])
    ).toEqual({ entries: [] });
    expect(getApplicationOwnership([])).toEqual({ entries: [] });
  });

  test('an object that two applications name lists both of them, ordered by name and not by id', () => {
    const { entries } = getApplicationOwnership([
      application({
        _id: 'app-a',
        name: 'Zion CSV',
        connectorId: 'shared-csv',
        mappingNames: ['sharedMapping'],
      }),
      application({
        _id: 'app-b',
        name: 'Matrix CSV',
        connectorId: 'shared-csv',
        mappingNames: ['sharedMapping'],
      }),
    ]);
    const owners = [
      { applicationId: 'app-b', applicationName: 'Matrix CSV' },
      { applicationId: 'app-a', applicationName: 'Zion CSV' },
    ];
    expect(entries).toEqual([
      { kind: 'connector', id: 'shared-csv', owners },
      { kind: 'mapping', id: 'sharedMapping', owners },
    ]);
  });

  test('two records with the same name are two owners, ordered by id', () => {
    const { entries } = getApplicationOwnership([
      application({ _id: 'id-2', name: 'Same', connectorId: 'shared-csv' }),
      application({ _id: 'id-1', name: 'Same', connectorId: 'shared-csv' }),
    ]);
    expect(entries[0].owners).toEqual([
      { applicationId: 'id-1', applicationName: 'Same' },
      { applicationId: 'id-2', applicationName: 'Same' },
    ]);
  });

  test('an application that names an object twice is listed once', () => {
    const { entries } = getApplicationOwnership([
      application({
        _id: 'app-csv',
        name: 'Matrix CSV',
        mappingNames: ['twice', 'twice'],
      }),
    ]);
    expect(entries).toEqual([
      {
        kind: 'mapping',
        id: 'twice',
        owners: [{ applicationId: 'app-csv', applicationName: 'Matrix CSV' }],
      },
    ]);
  });

  test('only the owned kinds are indexed, even for an application that has every kind of record entry', () => {
    const { entries } = getApplicationOwnership([
      application({
        _id: 'app-all',
        name: 'Matrix everything',
        connectorId: 'matrix-csv',
        mappingNames: ['matrixMapping'],
        ssoEntities: { ...oidcSso, ...samlSso, ...wsfedSso },
      }),
    ]);
    const kinds = new Set(entries.map((entry) => entry.kind));
    expect([...kinds].sort()).toEqual([
      'connector',
      'mapping',
      'oauth2Client',
      'saml2Provider',
    ]);
  });

  test('the entries are ordered by kind, then id, whatever the order of the records', () => {
    const records = [
      application({ _id: 'a', name: 'A', mappingNames: ['m2', 'm1'] }),
      application({
        _id: 'b',
        name: 'B',
        connectorId: 'c1',
        ssoEntities: oidcSso,
      }),
    ];
    const order = (r: ApplicationSkeleton[]) =>
      getApplicationOwnership(r).entries.map((e) => `${e.kind}:${e.id}`);
    expect(order(records)).toEqual([
      'oauth2Client:matrix-client',
      'connector:c1',
      'mapping:m1',
      'mapping:m2',
    ]);
    expect(order([...records].reverse())).toEqual(order(records));
  });

  test('a record without an _id, such as one read from a file, is indexed by its name', () => {
    const fromFile = application({
      name: 'Matrix CSV',
      connectorId: 'matrix-csv',
    });
    delete (fromFile as any)._id;
    // strict: an owner without an id has no `applicationId` key at all, not one that is undefined
    expect(getApplicationOwnership([fromFile]).entries).toStrictEqual([
      {
        kind: 'connector',
        id: 'matrix-csv',
        owners: [{ applicationName: 'Matrix CSV' }],
      },
    ]);
  });
});

describe('finding the owners of an object', () => {
  const ownership = getApplicationOwnership([
    application({ _id: 'app-oidc', name: 'Matrix Web', ssoEntities: oidcSso }),
  ]);

  test('an owned object gives its owners', () => {
    expect(
      getApplicationOwners(ownership, 'oauth2Client', 'matrix-client')
    ).toEqual([{ applicationId: 'app-oidc', applicationName: 'Matrix Web' }]);
  });

  test('an object that no application names, and a kind that is not owned, give no owner', () => {
    expect(
      getApplicationOwners(ownership, 'oauth2Client', 'other-client')
    ).toEqual([]);
    expect(
      getApplicationOwners(ownership, 'connector', 'matrix-client')
    ).toEqual([]);
    expect(
      getApplicationOwners(
        ownership,
        'circleOfTrust' as unknown as ApplicationOwnedKind,
        'matrix-client'
      )
    ).toEqual([]);
  });

  test('the result is a copy: changing it does not change the index', () => {
    getApplicationOwners(
      ownership,
      'oauth2Client',
      'matrix-client'
    )[0].applicationName = 'changed';
    expect(
      getApplicationOwners(ownership, 'oauth2Client', 'matrix-client')[0]
        .applicationName
    ).toBe('Matrix Web');
  });
});

describe('reading the ownership of the applications of a realm', () => {
  beforeEach(() => {
    readManagedObjects.mockReset();
  });

  test('reads the applications once, from the realm application type, and indexes them', async () => {
    readManagedObjects.mockResolvedValue([
      application({
        _id: 'app-oidc',
        name: 'Matrix Web',
        ssoEntities: oidcSso,
      }),
      application({
        _id: 'app-csv',
        name: 'Matrix CSV',
        connectorId: 'matrix-csv',
        mappingNames: ['matrixMapping'],
      }),
    ]);
    const ownership = await readApplicationOwnership({ state: mockState() });
    expect(readManagedObjects).toHaveBeenCalledTimes(1);
    expect(readManagedObjects.mock.calls[0][0]).toMatchObject({
      type: 'alpha_application',
    });
    expect(ownership.entries.map((e) => `${e.kind}:${e.id}`)).toEqual([
      'oauth2Client:matrix-client',
      'connector:matrix-csv',
      'mapping:matrixMapping',
    ]);
  });

  test('the facade method reads through the state it was made with', async () => {
    readManagedObjects.mockResolvedValue([
      application({
        _id: 'app-oidc',
        name: 'Matrix Web',
        ssoEntities: oidcSso,
      }),
    ]);
    const app = ApplicationOps(mockState());
    const ownership = await app.readApplicationOwnership();
    expect(
      app.getApplicationOwners(ownership, 'oauth2Client', 'matrix-client')
    ).toEqual([{ applicationId: 'app-oidc', applicationName: 'Matrix Web' }]);
    expect(
      app.getApplicationOwnership([application({ connectorId: 'matrix-csv' })])
        .entries
    ).toHaveLength(1);
    expect(
      app.getApplicationRecordReferences(application({ ssoEntities: oidcSso }))
    ).toHaveLength(1);
  });

  test('the root realm of a Cloud tenant has no applications and is not read', async () => {
    const ownership = await readApplicationOwnership({ state: mockState('/') });
    expect(ownership).toEqual({ entries: [] });
    expect(readManagedObjects).not.toHaveBeenCalled();
  });

  test('a failed read of the applications is a FrodoError that names the realm and keeps the cause', async () => {
    const cause = new Error('Request failed with status code 500');
    readManagedObjects.mockRejectedValue(cause);
    const error: any = await readApplicationOwnership({
      state: mockState(),
    }).catch((e) => e);
    expect(error).toBeInstanceOf(FrodoError);
    expect(error.message).toContain('alpha realm');
    expect(error.message).toContain('ownership');
    expect(rootCause(error)).toBe(cause);
  });
});
