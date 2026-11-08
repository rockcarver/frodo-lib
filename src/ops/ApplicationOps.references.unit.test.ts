import { jest } from '@jest/globals';

/**
 * `readApplicationReferences` finds everything an application is made of: the
 * objects its record points to (owned by the application), and the scripts,
 * circles of trust and Identity Governance objects those use (shared). What
 * cannot be followed is returned as a problem and never makes the call fail.
 * `validateApplication(s)` turns the problems into findings, one per
 * reference, so that one unreadable object does not hide the others.
 * Mocked unit test: no recordings.
 */

const notFound = () =>
  Object.assign(new Error('Request failed with status code 404'), {
    response: { status: 404 },
  });
const serverError = () =>
  Object.assign(new Error('Request failed with status code 500'), {
    response: { status: 500 },
  });

const readManagedObject = jest.fn(async (_args?: any): Promise<any> => ({}));
const readManagedObjects = jest.fn(async (_args?: any): Promise<any> => []);
const queryManagedObjects = jest.fn(async (_args?: any): Promise<any> => []);
const unused = jest.fn(async (_args?: any): Promise<any> => ({}));

const getApplicationGlossary = jest.fn(async (_args?: any): Promise<any> => {
  throw notFound();
});
const getRequestFormAssignments = jest.fn(
  async (_args?: any): Promise<any> => []
);
const getScriptByName = jest.fn(async (_args?: any): Promise<any> => ({
  result: [],
}));
const readCirclesOfTrust = jest.fn(async (_args?: any): Promise<any> => []);
const readGlossarySchemas = jest.fn(async (_args?: any): Promise<any> => []);
const readRequestForm = jest.fn(async (_args?: any): Promise<any> => {
  throw notFound();
});
const readRequestType = jest.fn(async (_args?: any): Promise<any> => {
  throw notFound();
});
const readConnector = jest.fn(async (_args?: any): Promise<any> => ({}));
const readMappings = jest.fn(async (_args?: any): Promise<any> => []);
const readOAuth2Client = jest.fn(async (_args?: any): Promise<any> => ({}));
const getOAuth2ClientScriptReferences = jest.fn((_client?: any): any[] => []);
const readSaml2EntityIds = jest.fn(async (_args?: any): Promise<any> => []);
const readSaml2Provider = jest.fn(async (_args?: any): Promise<any> => ({}));
const getSaml2ProviderScriptReferences = jest.fn(
  (_provider?: any): any[] => []
);
const readScript = jest.fn(async (_args?: any): Promise<any> => {
  throw notFound();
});
const getLibraryScriptNames = jest.fn((_script?: any): string[] => []);

jest.unstable_mockModule('../api/cloud/iga/IgaGlossaryApi', () => ({
  deleteApplicationGlossary: unused,
  getApplicationGlossary,
  putApplicationGlossary: unused,
}));
jest.unstable_mockModule('../api/cloud/iga/IgaRequestFormApi', () => ({
  getRequestFormAssignments,
}));
jest.unstable_mockModule('../api/ScriptApi', () => ({ getScriptByName }));
jest.unstable_mockModule('../utils/Console', () => ({
  createProgressIndicator: jest.fn(() => 'progress-id'),
  curlirizeMessage: jest.fn(),
  debugMessage: jest.fn(),
  printError: jest.fn(),
  printMessage: jest.fn(),
  stopProgressIndicator: jest.fn(),
  updateProgressIndicator: jest.fn(),
  verboseMessage: jest.fn(),
}));
jest.unstable_mockModule('../utils/ExportImportUtils', () => ({
  getMetadata: jest.fn(() => ({ exportedBy: 'jest' })),
}));
jest.unstable_mockModule('./CirclesOfTrustOps', () => ({
  exportCirclesOfTrust: unused,
  importCirclesOfTrust: unused,
  readCirclesOfTrust,
  updateCircleOfTrust: unused,
}));
jest.unstable_mockModule('./cloud/iga/IgaGlossaryOps', () => ({
  deleteGlossarySchemaByNameAndObjectType: unused,
  exportGlossarySchemaByNameAndObjectType: unused,
  importGlossarySchemas: unused,
  readGlossarySchemas,
}));
jest.unstable_mockModule('./cloud/iga/IgaRequestFormOps', () => ({
  deleteOrphanedRequestFormAssignments: unused,
  deleteRequestForm: unused,
  exportRequestForm: unused,
  importRequestForms: unused,
  readRequestForm,
}));
jest.unstable_mockModule('./cloud/iga/IgaRequestTypeOps', () => ({
  deleteRequestType: unused,
  readRequestType,
}));
jest.unstable_mockModule('./ConnectorOps', () => ({
  deleteConnector: unused,
  exportConnector: unused,
  importConnector: unused,
  readConnector,
}));
jest.unstable_mockModule('./ManagedObjectOps', () => ({
  createManagedObject: unused,
  deleteManagedObject: unused,
  queryManagedObjects,
  readManagedObject,
  readManagedObjects,
  updateManagedObject: unused,
}));
jest.unstable_mockModule('./MappingOps', () => ({ readMappings }));
jest.unstable_mockModule('./OAuth2ClientOps', () => ({
  deleteOAuth2Client: unused,
  exportOAuth2Client: unused,
  getOAuth2ClientScriptReferences,
  importOAuth2Client: unused,
  readOAuth2Client,
}));
jest.unstable_mockModule('./Saml2Ops', () => ({
  deleteSaml2Provider: unused,
  exportSaml2Provider: unused,
  getSaml2ProviderScriptReferences,
  importSaml2Provider: unused,
  readSaml2EntityIds,
  readSaml2Provider,
}));
jest.unstable_mockModule('./ScriptOps', () => ({
  getLibraryScriptNames,
  readScript,
}));

const {
  default: ApplicationOps,
  readApplicationReferences,
  readApplicationReferencesByName,
  validateApplication,
  validateApplicationByName,
  validateApplications,
} = await import('./ApplicationOps');
const { FrodoError } = await import('./FrodoError');

const state = (iga = false) =>
  ({
    getRealm: () => 'alpha',
    getDeploymentType: () => 'cloud',
    getUseRealmPrefixOnManagedObjects: () => false,
    getIsIGA: () => iga,
  }) as any;

const b64 = (text: string) =>
  Buffer.from(text).toString('base64').replace(/=+$/, '');

const bookmarkApp = { _id: 'app-bookmark', name: 'Bookmark' };
const oidcApp = {
  _id: 'app-oidc',
  name: 'Web App',
  ssoEntities: { oidcId: 'web-client' },
};
const samlApp = {
  _id: 'app-saml',
  name: 'SAML App',
  ssoEntities: {
    idpPrivateId: b64('idp-entity'),
    spPrivateId: b64('sp-entity'),
  },
};
const provisioningApp = {
  _id: 'app-prov',
  name: 'Directory',
  connectorId: 'Directory',
  mappingNames: [
    'systemDirectoryUser_managedAlpha_user',
    'systemDirectoryGroup_managedAlpha_role',
  ],
};

/** scripts known to the fake tenant, by id */
let scripts: Record<string, any>;
let applications: Record<string, any>;

const script = (id: string, name: string, extra: any = {}) => ({
  _id: id,
  name,
  default: false,
  script: 'ignored',
  ...extra,
});

/** a FrodoError chain as the ops layer throws it */
const wrapped = (cause: Error) =>
  new FrodoError('Error reading thing', new FrodoError('inner', cause));

beforeEach(() => {
  jest.clearAllMocks();
  scripts = {};
  applications = {
    [bookmarkApp._id]: bookmarkApp,
    [oidcApp._id]: oidcApp,
    [samlApp._id]: samlApp,
    [provisioningApp._id]: provisioningApp,
  };
  readManagedObject.mockReset();
  readManagedObject.mockImplementation(async ({ id }: any) => {
    if (!applications[id]) throw notFound();
    return applications[id];
  });
  queryManagedObjects.mockReset();
  queryManagedObjects.mockImplementation(async ({ filter }: any) =>
    Object.values(applications).filter(
      (a: any) => filter === `name eq '${a.name}'`
    )
  );
  readManagedObjects.mockReset();
  readManagedObjects.mockImplementation(async () =>
    Object.values(applications)
  );
  readOAuth2Client.mockReset();
  readOAuth2Client.mockImplementation(async ({ clientId }: any) => ({
    _id: clientId,
  }));
  getOAuth2ClientScriptReferences.mockReset();
  getOAuth2ClientScriptReferences.mockImplementation((client: any) =>
    Object.entries(client.scripts ?? {}).map(([key, scriptId]) => ({
      key,
      scriptId,
    }))
  );
  readSaml2EntityIds.mockReset();
  readSaml2EntityIds.mockImplementation(async () => [
    'idp-entity',
    'sp-entity',
  ]);
  readSaml2Provider.mockReset();
  readSaml2Provider.mockImplementation(async ({ entityId }: any) => ({
    entityId,
  }));
  getSaml2ProviderScriptReferences.mockReset();
  getSaml2ProviderScriptReferences.mockImplementation(
    (provider: any) => provider.scripts ?? []
  );
  readCirclesOfTrust.mockReset();
  readCirclesOfTrust.mockImplementation(async () => []);
  readConnector.mockReset();
  readConnector.mockImplementation(async ({ connectorId }: any) => ({
    _id: connectorId,
  }));
  readMappings.mockReset();
  readMappings.mockImplementation(async () =>
    provisioningApp.mappingNames.map((name) => ({ name }))
  );
  readScript.mockReset();
  readScript.mockImplementation(async ({ scriptId }: any) => {
    if (!scripts[scriptId]) throw wrapped(notFound());
    return scripts[scriptId];
  });
  getLibraryScriptNames.mockReset();
  getLibraryScriptNames.mockImplementation((s: any) => s.requires ?? []);
  getScriptByName.mockReset();
  getScriptByName.mockImplementation(async ({ scriptName }: any) => ({
    result: Object.values(scripts).filter((s: any) => s.name === scriptName),
  }));
  getApplicationGlossary.mockReset();
  getApplicationGlossary.mockImplementation(async () => {
    throw notFound();
  });
  getRequestFormAssignments.mockReset();
  getRequestFormAssignments.mockImplementation(async () => []);
  readGlossarySchemas.mockReset();
  readGlossarySchemas.mockImplementation(async () => []);
  readRequestForm.mockReset();
  readRequestForm.mockImplementation(async () => {
    throw notFound();
  });
  readRequestType.mockReset();
  readRequestType.mockImplementation(async () => {
    throw notFound();
  });
});

describe('readApplicationReferences: what the record points to', () => {
  test('a bookmark application refers to nothing', async () => {
    const result = await readApplicationReferences({
      applicationId: bookmarkApp._id,
      state: state(),
    });
    expect(result).toEqual({
      applicationId: 'app-bookmark',
      applicationName: 'Bookmark',
      references: [],
      problems: [],
    });
    expect(readOAuth2Client).not.toHaveBeenCalled();
    expect(readSaml2EntityIds).not.toHaveBeenCalled();
    expect(readConnector).not.toHaveBeenCalled();
    expect(readMappings).not.toHaveBeenCalled();
    expect(getApplicationGlossary).not.toHaveBeenCalled();
  });

  test('an OIDC application owns its OAuth2 client', async () => {
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(result.references).toEqual([
      {
        kind: 'oauth2Client',
        id: 'web-client',
        ownership: 'owned',
        from: 'ssoEntities.oidcId',
      },
    ]);
    expect(result.problems).toEqual([]);
    expect(readOAuth2Client).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'web-client' })
    );
  });

  test('a SAML application owns both entity providers and shares the circles of trust that list them', async () => {
    readCirclesOfTrust.mockResolvedValue([
      { _id: 'cot-a', trustedProviders: ['other|saml2', 'sp-entity|saml2'] },
      { _id: 'cot-b', trustedProviders: ['idp-entity|saml2'] },
    ]);
    const result = await readApplicationReferences({
      applicationId: samlApp._id,
      state: state(),
    });
    expect(result.references).toEqual([
      {
        kind: 'saml2Provider',
        id: 'idp-entity',
        ownership: 'owned',
        from: 'ssoEntities.idpPrivateId',
      },
      {
        kind: 'saml2Provider',
        id: 'sp-entity',
        ownership: 'owned',
        from: 'ssoEntities.spPrivateId',
      },
      {
        kind: 'circleOfTrust',
        id: 'cot-a',
        ownership: 'shared',
        from: 'trustedProviders',
        via: { kind: 'saml2Provider', id: 'sp-entity' },
      },
      {
        kind: 'circleOfTrust',
        id: 'cot-b',
        ownership: 'shared',
        from: 'trustedProviders',
        via: { kind: 'saml2Provider', id: 'idp-entity' },
      },
    ]);
    expect(result.problems).toEqual([]);
    expect(readCirclesOfTrust).toHaveBeenCalledWith(
      expect.objectContaining({ entityProviders: ['idp-entity', 'sp-entity'] })
    );
  });

  test('a provisioning application owns its connector and mappings', async () => {
    const result = await readApplicationReferences({
      applicationId: provisioningApp._id,
      state: state(),
    });
    expect(result.references).toEqual([
      {
        kind: 'connector',
        id: 'Directory',
        ownership: 'owned',
        from: 'connectorId',
      },
      {
        kind: 'mapping',
        id: 'systemDirectoryUser_managedAlpha_user',
        ownership: 'owned',
        from: 'mappingNames',
      },
      {
        kind: 'mapping',
        id: 'systemDirectoryGroup_managedAlpha_role',
        ownership: 'owned',
        from: 'mappingNames',
      },
    ]);
    expect(result.problems).toEqual([]);
  });

  test('reads by name', async () => {
    const result = await readApplicationReferencesByName({
      applicationName: 'Web App',
      state: state(),
    });
    expect(result.applicationId).toBe('app-oidc');
    expect(result.references.map((r) => r.id)).toEqual(['web-client']);
  });

  test('an application that cannot be read fails the call', async () => {
    await expect(
      readApplicationReferences({ applicationId: 'nope', state: state() })
    ).rejects.toThrow(/references of alpha realm application nope/);
  });
});

describe('readApplicationReferences: the scripts', () => {
  test('the scripts of an OAuth2 client are shared, with the key that refers to them', async () => {
    scripts = {
      'script-token': script('script-token', 'Token modifier', {
        default: true,
      }),
      'script-scopes': script('script-scopes', 'Scope validator'),
    };
    readOAuth2Client.mockResolvedValue({
      _id: 'web-client',
      scripts: {
        accessTokenModificationScript: 'script-token',
        validateScopesScript: 'script-scopes',
      },
    });
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(result.references.slice(1)).toEqual([
      {
        kind: 'script',
        id: 'script-token',
        name: 'Token modifier',
        isDefault: true,
        ownership: 'shared',
        from: 'overrideOAuth2ClientConfig.accessTokenModificationScript',
        via: { kind: 'oauth2Client', id: 'web-client' },
      },
      {
        kind: 'script',
        id: 'script-scopes',
        name: 'Scope validator',
        isDefault: false,
        ownership: 'shared',
        from: 'overrideOAuth2ClientConfig.validateScopesScript',
        via: { kind: 'oauth2Client', id: 'web-client' },
      },
    ]);
    expect(result.problems).toEqual([]);
  });

  test('the scripts of a SAML provider are shared, with the field that refers to them', async () => {
    scripts = { 'script-map': script('script-map', 'Attribute mapper') };
    readSaml2Provider.mockImplementation(async ({ entityId }: any) =>
      entityId === 'idp-entity'
        ? {
            scripts: [
              {
                field:
                  'identityProvider.assertionProcessing.attributeMapper.attributeMapperScript',
                label: 'attribute mapper script',
                scriptId: 'script-map',
              },
            ],
          }
        : {}
    );
    const result = await readApplicationReferences({
      applicationId: samlApp._id,
      state: state(),
    });
    expect(result.references.filter((r) => r.kind === 'script')).toEqual([
      {
        kind: 'script',
        id: 'script-map',
        name: 'Attribute mapper',
        isDefault: false,
        ownership: 'shared',
        from: 'identityProvider.assertionProcessing.attributeMapper.attributeMapperScript',
        via: { kind: 'saml2Provider', id: 'idp-entity' },
      },
    ]);
  });

  test('library scripts are followed through the scripts that require them, and a cycle ends', async () => {
    scripts = {
      'script-main': script('script-main', 'Main', { requires: ['LibA'] }),
      'script-a': script('script-a', 'LibA', { requires: ['LibB', 'LibB'] }),
      'script-b': script('script-b', 'LibB', { requires: ['LibA'] }),
    };
    readOAuth2Client.mockResolvedValue({
      scripts: { accessTokenModificationScript: 'script-main' },
    });
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(),
    });
    const found = result.references.filter((r) => r.kind === 'script');
    expect(found.map((r) => [r.id, r.name, r.from, r.via?.id])).toEqual([
      [
        'script-main',
        'Main',
        'overrideOAuth2ClientConfig.accessTokenModificationScript',
        'web-client',
      ],
      ['script-a', 'LibA', 'require', 'script-main'],
      ['script-b', 'LibB', 'require', 'script-a'],
    ]);
    expect(found.every((r) => r.ownership === 'shared')).toBe(true);
    expect(result.problems).toEqual([]);
    // every library script is looked up once, also when it is required twice or by a cycle
    expect(getScriptByName).toHaveBeenCalledTimes(2);
  });

  test('a script that two objects refer to is listed once', async () => {
    scripts = { 'script-x': script('script-x', 'Shared script') };
    readOAuth2Client.mockResolvedValue({
      scripts: { a: 'script-x', b: 'script-x' },
    });
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(result.references.filter((r) => r.kind === 'script')).toHaveLength(
      1
    );
    expect(readScript).toHaveBeenCalledTimes(1);
  });
});

describe('readApplicationReferences: what cannot be followed', () => {
  test('an OAuth2 client that does not exist is a missing reference, and its scripts are unknown', async () => {
    readOAuth2Client.mockRejectedValue(wrapped(notFound()));
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(result.references).toHaveLength(1);
    expect(result.problems).toEqual([
      {
        reference: result.references[0],
        kind: 'oauth2Client',
        reason: 'missing',
      },
    ]);
  });

  test('an OAuth2 client that cannot be read is unreadable, not missing', async () => {
    readOAuth2Client.mockRejectedValue(wrapped(serverError()));
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({
      kind: 'oauth2Client',
      reason: 'unreadable',
    });
    expect(result.problems[0].error).toBeInstanceOf(FrodoError);
  });

  test('a SAML provider that is not in the list of entity ids is missing and is not read', async () => {
    readSaml2EntityIds.mockResolvedValue(['idp-entity']);
    const result = await readApplicationReferences({
      applicationId: samlApp._id,
      state: state(),
    });
    expect(
      result.problems.map((p) => [p.kind, p.reason, p.reference?.id])
    ).toEqual([['saml2Provider', 'missing', 'sp-entity']]);
    expect(readSaml2Provider).toHaveBeenCalledTimes(1);
  });

  test('when the entity ids cannot be listed, both providers are unreadable', async () => {
    readSaml2EntityIds.mockRejectedValue(serverError());
    const result = await readApplicationReferences({
      applicationId: samlApp._id,
      state: state(),
    });
    expect(result.problems.map((p) => [p.reason, p.reference?.id])).toEqual([
      ['unreadable', 'idp-entity'],
      ['unreadable', 'sp-entity'],
    ]);
    expect(readCirclesOfTrust).not.toHaveBeenCalled();
  });

  test('circles of trust that cannot be listed are one problem without a reference', async () => {
    readCirclesOfTrust.mockRejectedValue(serverError());
    const result = await readApplicationReferences({
      applicationId: samlApp._id,
      state: state(),
    });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({
      kind: 'circleOfTrust',
      reason: 'unreadable',
    });
    expect(result.problems[0].reference).toBeUndefined();
  });

  test('a connector that does not exist and mappings that do not exist are missing', async () => {
    readConnector.mockRejectedValue(wrapped(notFound()));
    readMappings.mockResolvedValue([
      { name: 'systemDirectoryUser_managedAlpha_user' },
    ]);
    const result = await readApplicationReferences({
      applicationId: provisioningApp._id,
      state: state(),
    });
    expect(
      result.problems.map((p) => [p.kind, p.reason, p.reference?.id])
    ).toEqual([
      ['connector', 'missing', 'Directory'],
      ['mapping', 'missing', 'systemDirectoryGroup_managedAlpha_role'],
    ]);
  });

  test('mappings that cannot be listed are unreadable', async () => {
    readMappings.mockRejectedValue(serverError());
    const result = await readApplicationReferences({
      applicationId: provisioningApp._id,
      state: state(),
    });
    expect(result.problems.map((p) => [p.kind, p.reason])).toEqual([
      ['mapping', 'unreadable'],
      ['mapping', 'unreadable'],
    ]);
  });

  test('a script that does not exist is missing, a library script that does not exist is missing by name', async () => {
    scripts = {
      'script-main': script('script-main', 'Main', {
        requires: ['NoSuchLibrary'],
      }),
    };
    readOAuth2Client.mockResolvedValue({
      scripts: { a: 'script-main', b: 'script-gone' },
    });
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(
      result.problems.map((p) => [
        p.kind,
        p.reason,
        p.reference?.id,
        p.reference?.from,
      ])
    ).toEqual([
      // depth first: the library script of the first script comes before the second script
      ['script', 'missing', 'NoSuchLibrary', 'require'],
      ['script', 'missing', 'script-gone', 'overrideOAuth2ClientConfig.b'],
    ]);
  });

  test('two scripts with the name of a library script are unreadable', async () => {
    scripts = {
      'script-main': script('script-main', 'Main', { requires: ['Twin'] }),
      'twin-1': script('twin-1', 'Twin'),
      'twin-2': script('twin-2', 'Twin'),
    };
    readOAuth2Client.mockResolvedValue({ scripts: { a: 'script-main' } });
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({
      kind: 'script',
      reason: 'unreadable',
      reference: { id: 'Twin', from: 'require' },
    });
  });
});

describe('readApplicationReferences: Identity Governance', () => {
  test('is not asked on a tenant that is not an Identity Governance tenant', async () => {
    await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(false),
    });
    expect(getApplicationGlossary).not.toHaveBeenCalled();
    expect(getRequestFormAssignments).not.toHaveBeenCalled();
    expect(readGlossarySchemas).not.toHaveBeenCalled();
  });

  test('an application without glossary or request forms has no extra references', async () => {
    const result = await readApplicationReferences({
      applicationId: bookmarkApp._id,
      state: state(true),
    });
    expect(result.references).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(readGlossarySchemas).not.toHaveBeenCalled();
  });

  test('glossary schemas, request forms and request types are shared', async () => {
    getApplicationGlossary.mockResolvedValue({ costCenter: 'x', owner: 'y' });
    readGlossarySchemas.mockResolvedValue([
      { name: 'costCenter', objectType: '/openidm/managed/application' },
      { name: 'owner', objectType: '/openidm/managed/application' },
      { name: 'riskLevel', objectType: '/openidm/managed/role' },
    ]);
    getRequestFormAssignments.mockImplementation(
      async ({ applicationId, formId }: any) =>
        applicationId
          ? [{ formId: 'form-1', objectId: 'application/x/user/create' }]
          : formId === 'form-1'
            ? [
                { formId: 'form-1', objectId: 'requestType/type-1' },
                { formId: 'form-1', objectId: 'requestType/type-1' },
              ]
            : []
    );
    readRequestForm.mockResolvedValue({
      id: 'form-1',
      name: 'Access request',
      type: 'request',
    });
    readRequestType.mockResolvedValue({ id: 'type-1' });
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(true),
    });
    expect(result.references.slice(1)).toEqual([
      {
        kind: 'glossarySchema',
        id: 'costCenter',
        ownership: 'shared',
        from: 'glossary',
      },
      {
        kind: 'glossarySchema',
        id: 'owner',
        ownership: 'shared',
        from: 'glossary',
      },
      {
        kind: 'requestForm',
        id: 'form-1',
        name: 'Access request',
        ownership: 'shared',
        from: 'requestFormAssignments',
      },
      {
        kind: 'requestType',
        id: 'type-1',
        ownership: 'shared',
        from: 'requestFormAssignments',
        via: { kind: 'requestForm', id: 'form-1' },
      },
    ]);
    expect(result.problems).toEqual([]);
    expect(readRequestType).toHaveBeenCalledTimes(1);
  });

  test('a glossary schema of another object type does not define the key', async () => {
    getApplicationGlossary.mockResolvedValue({ riskLevel: 'high' });
    readGlossarySchemas.mockResolvedValue([
      { name: 'riskLevel', objectType: '/openidm/managed/role' },
    ]);
    const result = await readApplicationReferences({
      applicationId: bookmarkApp._id,
      state: state(true),
    });
    expect(
      result.problems.map((p) => [p.kind, p.reason, p.reference?.id])
    ).toEqual([['glossarySchema', 'missing', 'riskLevel']]);
  });

  test('only a request form of type request has request types', async () => {
    getRequestFormAssignments.mockImplementation(
      async ({ applicationId }: any) =>
        applicationId
          ? [{ formId: 'form-1', objectId: 'application/x/user/create' }]
          : []
    );
    readRequestForm.mockResolvedValue({
      id: 'form-1',
      name: 'Create',
      type: 'application',
    });
    const result = await readApplicationReferences({
      applicationId: oidcApp._id,
      state: state(true),
    });
    expect(result.references.map((r) => r.kind)).toEqual([
      'oauth2Client',
      'requestForm',
    ]);
    expect(getRequestFormAssignments).toHaveBeenCalledTimes(1);
  });

  test('a glossary key without a schema, a missing form and a missing type are missing', async () => {
    getApplicationGlossary.mockResolvedValue({ gone: 'x' });
    readGlossarySchemas.mockResolvedValue([]);
    getRequestFormAssignments.mockImplementation(
      async ({ applicationId, formId }: any) =>
        applicationId
          ? [
              { formId: 'form-ok', objectId: 'application/x/user/create' },
              { formId: 'form-gone', objectId: 'application/x/user/delete' },
            ]
          : formId === 'form-ok'
            ? [{ formId: 'form-ok', objectId: 'requestType/type-gone' }]
            : []
    );
    readRequestForm.mockImplementation(async ({ formId }: any) => {
      if (formId === 'form-ok')
        return { id: 'form-ok', name: 'Ok', type: 'request' };
      throw wrapped(notFound());
    });
    readRequestType.mockRejectedValue(wrapped(notFound()));
    const result = await readApplicationReferences({
      applicationId: bookmarkApp._id,
      state: state(true),
    });
    expect(
      result.problems.map((p) => [p.kind, p.reason, p.reference?.id])
    ).toEqual([
      ['glossarySchema', 'missing', 'gone'],
      // depth first: the request type of the first form comes before the second form
      ['requestType', 'missing', 'type-gone'],
      ['requestForm', 'missing', 'form-gone'],
    ]);
  });

  test('a glossary that cannot be read is one unreadable problem, the request forms are still read', async () => {
    getApplicationGlossary.mockRejectedValue(serverError());
    getRequestFormAssignments.mockImplementation(
      async ({ applicationId }: any) =>
        applicationId
          ? [{ formId: 'form-1', objectId: 'application/x/user/create' }]
          : []
    );
    readRequestForm.mockResolvedValue({
      id: 'form-1',
      name: 'Create',
      type: 'application',
    });
    const result = await readApplicationReferences({
      applicationId: bookmarkApp._id,
      state: state(true),
    });
    expect(result.problems.map((p) => [p.kind, p.reason, p.reference])).toEqual(
      [['glossarySchema', 'unreadable', undefined]]
    );
    expect(result.references.map((r) => r.id)).toEqual(['form-1']);
  });
});

describe('validateApplication', () => {
  test('returns no findings when every reference resolves', async () => {
    for (const app of [oidcApp, samlApp, provisioningApp, bookmarkApp]) {
      expect(
        await validateApplication({ applicationId: app._id, state: state() })
      ).toEqual([]);
    }
  });

  test('names the application, the reference and where it comes from', async () => {
    readSaml2EntityIds.mockResolvedValue(['idp-entity']);
    const findings = await validateApplication({
      applicationId: samlApp._id,
      state: state(),
    });
    expect(findings).toEqual([
      {
        code: 'MISSING_SAML2_PROVIDER',
        severity: 'error',
        applicationId: 'app-saml',
        applicationName: 'SAML App',
        message:
          "alpha realm application 'SAML App' refers to SAML entity provider 'sp-entity' (ssoEntities.spPrivateId), which does not exist",
        referenceKind: 'saml2Provider',
        referenceId: 'sp-entity',
        from: 'ssoEntities.spPrivateId',
      },
    ]);
  });

  test('has a code for every kind of missing reference', async () => {
    scripts = {};
    readOAuth2Client.mockRejectedValue(wrapped(notFound()));
    const oidc = await validateApplication({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(oidc.map((f) => f.code)).toEqual(['MISSING_OAUTH2_CLIENT']);

    readConnector.mockRejectedValue(wrapped(notFound()));
    readMappings.mockResolvedValue([]);
    const prov = await validateApplication({
      applicationId: provisioningApp._id,
      state: state(),
    });
    expect(prov.map((f) => f.code)).toEqual([
      'MISSING_CONNECTOR',
      'MISSING_MAPPING',
      'MISSING_MAPPING',
    ]);

    readOAuth2Client.mockResolvedValue({ scripts: { a: 'script-gone' } });
    const script = await validateApplication({
      applicationId: oidcApp._id,
      state: state(),
    });
    expect(script.map((f) => f.code)).toEqual(['MISSING_SCRIPT']);

    getApplicationGlossary.mockResolvedValue({ gone: 1 });
    getRequestFormAssignments.mockImplementation(
      async ({ applicationId, formId }: any) =>
        applicationId
          ? [
              { formId: 'form-ok', objectId: 'application/x/user/create' },
              { formId: 'form-gone', objectId: 'application/x/user/delete' },
            ]
          : formId === 'form-ok'
            ? [{ formId: 'form-ok', objectId: 'requestType/type-gone' }]
            : []
    );
    readRequestForm.mockImplementation(async ({ formId }: any) => {
      if (formId === 'form-ok')
        return { id: 'form-ok', name: 'Ok', type: 'request' };
      throw wrapped(notFound());
    });
    readRequestType.mockRejectedValue(wrapped(notFound()));
    const iga = await validateApplication({
      applicationId: bookmarkApp._id,
      state: state(true),
    });
    expect(iga.map((f) => f.code)).toEqual([
      'MISSING_GLOSSARY_SCHEMA',
      'MISSING_REQUEST_TYPE',
      'MISSING_REQUEST_FORM',
    ]);
  });

  test('an unreadable reference is a finding with the reason, and does not hide the others', async () => {
    readOAuth2Client.mockRejectedValue(wrapped(serverError()));
    readSaml2EntityIds.mockResolvedValue([]);
    const app = {
      _id: 'app-both',
      name: 'Both',
      ssoEntities: {
        oidcId: 'web-client',
        idpPrivateId: b64('idp-entity'),
      },
    };
    applications[app._id] = app;
    const findings = await validateApplication({
      applicationId: app._id,
      state: state(),
    });
    expect(
      findings.map((f) => [f.code, f.referenceKind, f.referenceId])
    ).toEqual([
      ['UNREADABLE_REFERENCE', 'oauth2Client', 'web-client'],
      ['MISSING_SAML2_PROVIDER', 'saml2Provider', 'idp-entity'],
    ]);
    expect(findings[0].message).toBe(
      "alpha realm application 'Both': unable to check OAuth2 client 'web-client' (ssoEntities.oidcId): Request failed with status code 500"
    );
    expect(findings.every((f) => f.severity === 'error')).toBe(true);
  });

  test('a list that cannot be read is one finding without a reference', async () => {
    readCirclesOfTrust.mockRejectedValue(serverError());
    const findings = await validateApplication({
      applicationId: samlApp._id,
      state: state(),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: 'UNREADABLE_REFERENCE',
      referenceKind: 'circleOfTrust',
      referenceId: undefined,
    });
    expect(findings[0].message).toContain(
      'unable to read its circle of trust references'
    );
  });

  test('by name', async () => {
    readConnector.mockRejectedValue(wrapped(notFound()));
    const findings = await validateApplicationByName({
      applicationName: 'Directory',
      state: state(),
    });
    expect(findings.map((f) => f.code)).toEqual(['MISSING_CONNECTOR']);
  });

  test('an application that cannot be read fails the call', async () => {
    await expect(
      validateApplication({ applicationId: 'nope', state: state() })
    ).rejects.toThrow(/validating alpha realm application nope/);
  });
});

describe('validateApplications', () => {
  test('validates every application and reports each finding with its application', async () => {
    readConnector.mockRejectedValue(wrapped(notFound()));
    readSaml2EntityIds.mockResolvedValue(['idp-entity']);
    const findings = await validateApplications({ state: state() });
    expect(findings.map((f) => [f.applicationName, f.code])).toEqual([
      ['SAML App', 'MISSING_SAML2_PROVIDER'],
      ['Directory', 'MISSING_CONNECTOR'],
    ]);
  });

  test('an application that cannot be validated at all does not hide the findings of the others', async () => {
    applications['app-broken'] = {
      _id: 'app-broken',
      name: 'Broken',
      mappingNames: 42,
    };
    readConnector.mockRejectedValue(wrapped(notFound()));
    const findings = await validateApplications({ state: state() });
    expect(
      findings.map((f) => [f.applicationName, f.code, f.referenceKind])
    ).toEqual([
      ['Directory', 'MISSING_CONNECTOR', 'connector'],
      ['Broken', 'UNREADABLE_REFERENCE', undefined],
    ]);
    expect(findings[1].message).toContain(
      "application 'Broken': unable to validate"
    );
  });

  test('the list of applications that cannot be read fails the call', async () => {
    readManagedObjects.mockRejectedValue(serverError());
    await expect(validateApplications({ state: state() })).rejects.toThrow(
      /validating alpha realm applications/
    );
  });

  test('reads the applications once and nothing when there are none', async () => {
    applications = {};
    expect(await validateApplications({ state: state() })).toEqual([]);
    expect(readManagedObjects).toHaveBeenCalledTimes(1);
    expect(readOAuth2Client).not.toHaveBeenCalled();
  });
});

describe('facade', () => {
  test('passes the arguments through', async () => {
    const api = ApplicationOps(state());
    expect(
      (await api.readApplicationReferences('app-oidc')).references
    ).toHaveLength(1);
    expect(
      (await api.readApplicationReferencesByName('Web App')).applicationId
    ).toBe('app-oidc');
    expect(await api.validateApplication('app-oidc')).toEqual([]);
    expect(await api.validateApplicationByName('Web App')).toEqual([]);
    expect(await api.validateApplications()).toEqual([]);
  });
});
