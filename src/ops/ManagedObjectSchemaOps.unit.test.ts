import { jest } from '@jest/globals';

const getManagedObjectSchemaApi = jest.fn(
  async (_args?: any): Promise<any> => ({ properties: {} })
);
const getManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const putManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);
const deleteManagedObjectSchemaPropertyApi = jest.fn(
  async (_args?: any): Promise<any> => ({})
);

jest.unstable_mockModule('../api/ManagedObjectApi', () => ({
  deleteManagedObjectSchemaProperty: deleteManagedObjectSchemaPropertyApi,
  getManagedObjectSchema: getManagedObjectSchemaApi,
  getManagedObjectSchemaProperty: getManagedObjectSchemaPropertyApi,
  putManagedObjectSchemaProperty: putManagedObjectSchemaPropertyApi,
}));

const getConfigEntityApi = jest.fn(async (_args?: any): Promise<any> => ({}));
const putConfigEntityApi = jest.fn(async (_args?: any): Promise<any> => ({}));

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigEntity: getConfigEntityApi,
  putConfigEntity: putConfigEntityApi,
  getConfigEntities: jest.fn(async (): Promise<any> => []),
  getConfigEntitiesByType: jest.fn(async (): Promise<any> => []),
  getConfigStubs: jest.fn(async (): Promise<any> => ({ configurations: [] })),
  deleteConfigEntity: jest.fn(async (): Promise<any> => ({})),
}));

const {
  readManagedObjectSchema,
  readManagedObjectSchemaProperty,
  updateManagedObjectSchemaProperty,
  removeManagedObjectSchemaProperty,
  buildManagedObjectSchemaPropertyPayload,
  extractManagedObjectSchemaPropertyFields,
  createManagedObjectSchemaFlatProperty,
  updateManagedObjectSchemaFlatProperty,
  removeManagedObjectSchemaFlatProperty,
  buildManagedObjectTypeSchema,
  createManagedObjectType,
  updateManagedObjectType,
  removeManagedObjectType,
  buildManagedObjectSchemaRelationshipPropertyPayload,
  extractManagedObjectSchemaRelationshipPropertyFields,
  toManagedObjectSchemaRelationshipReverseFields,
  inferManagedObjectSchemaRelationshipReverseIdentity,
  readManagedObjectSchemaRelationshipPropertyOrNull,
  createManagedObjectSchemaRelationshipProperty,
  updateManagedObjectSchemaRelationshipProperty,
  removeManagedObjectSchemaRelationshipProperty,
} = await import('./ManagedObjectSchemaOps');

function mockStateWithDebug(deploymentType: string) {
  return {
    getDeploymentType: () => deploymentType,
    getDebugHandler: () => undefined,
  } as any;
}

function mockConfigState() {
  return {
    getDeploymentType: () => 'cloud',
    getDebugHandler: () => undefined,
    getEnvs: () => ({}),
    getHost: () => 'https://openam-frodo-dev.forgeblocks.com/am',
    getAmVersion: () => '7.3.0',
    getUsername: () => 'frodo-test',
    getFrodoVersion: () => '1.0.0',
  } as any;
}

/** Sets up getConfigEntityApi to return a `managed` config entity with a single object type carrying the given schema. */
function mockManagedConfig(type: string, schema: Record<string, unknown>) {
  getConfigEntityApi.mockResolvedValue({
    _id: 'managed',
    objects: [{ name: type, schema }],
  });
}

describe('managed object schema property CRUD (v2 schema API, any IDM deployment)', () => {
  beforeEach(() => {
    getManagedObjectSchemaPropertyApi.mockReset();
    getManagedObjectSchemaPropertyApi.mockResolvedValue({
      type: 'string',
    });
    putManagedObjectSchemaPropertyApi.mockReset();
    putManagedObjectSchemaPropertyApi.mockResolvedValue({ type: 'string' });
    deleteManagedObjectSchemaPropertyApi.mockReset();
    deleteManagedObjectSchemaPropertyApi.mockResolvedValue({
      type: 'string',
    });
    getManagedObjectSchemaApi.mockReset();
  });

  test.each(['cloud', 'forgeops'])(
    'readManagedObjectSchemaProperty calls the v2 API on %s',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      const result = await readManagedObjectSchemaProperty({
        type: 'alpha_user',
        propertyName: 'custom_merchantId',
        state,
      });
      expect(result).toEqual({ type: 'string' });
      expect(getManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'alpha_user',
          propertyName: 'custom_merchantId',
        })
      );
    }
  );

  test('readManagedObjectSchemaProperty refuses on classic without calling the API', async () => {
    const state = mockStateWithDebug('classic');
    await expect(
      readManagedObjectSchemaProperty({
        type: 'alpha_user',
        propertyName: 'custom_merchantId',
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({ message: expect.stringMatching(/IDM/) }),
      ],
    });
    expect(getManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
  });

  test.each(['cloud', 'forgeops'])(
    'updateManagedObjectSchemaProperty writes on %s and invalidates the schema cache',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      const type = `alpha_user_update_cache_test_${deploymentType}`;
      getManagedObjectSchemaApi.mockResolvedValueOnce({
        properties: { custom_merchantId: { type: 'string', version: 1 } },
      });
      const before = await readManagedObjectSchema({ type, state });
      expect(before.properties['custom_merchantId']).toEqual({
        type: 'string',
        version: 1,
      });

      await updateManagedObjectSchemaProperty({
        type,
        propertyName: 'custom_merchantId',
        propertyData: { type: 'string' },
        state,
      });
      expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          propertyName: 'custom_merchantId',
          propertyData: { type: 'string' },
        })
      );

      // Cache must be invalidated: a subsequent readManagedObjectSchema call
      // re-fetches instead of returning the pre-update cached value.
      getManagedObjectSchemaApi.mockResolvedValueOnce({
        properties: { custom_merchantId: { type: 'string', version: 2 } },
      });
      const after = await readManagedObjectSchema({
        type,
        refreshCache: false,
        state,
      });
      expect(after.properties['custom_merchantId']).toEqual({
        type: 'string',
        version: 2,
      });
      expect(getManagedObjectSchemaApi).toHaveBeenCalledTimes(2);
    }
  );

  test('updateManagedObjectSchemaProperty refuses on classic without calling the API', async () => {
    const state = mockStateWithDebug('classic');
    await expect(
      updateManagedObjectSchemaProperty({
        type: 'alpha_user',
        propertyName: 'custom_merchantId',
        propertyData: { type: 'string' },
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({ message: expect.stringMatching(/IDM/) }),
      ],
    });
    expect(putManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
  });

  test.each(['cloud', 'forgeops'])(
    'removeManagedObjectSchemaProperty writes on %s and invalidates the schema cache',
    async (deploymentType) => {
      const state = mockStateWithDebug(deploymentType);
      const type = `alpha_user_remove_cache_test_${deploymentType}`;
      getManagedObjectSchemaApi.mockResolvedValueOnce({
        properties: { custom_merchantId: { type: 'string', version: 1 } },
      });
      await readManagedObjectSchema({ type, state });

      await removeManagedObjectSchemaProperty({
        type,
        propertyName: 'custom_merchantId',
        state,
      });
      expect(deleteManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          propertyName: 'custom_merchantId',
        })
      );

      getManagedObjectSchemaApi.mockResolvedValueOnce({ properties: {} });
      await readManagedObjectSchema({ type, state });
      expect(getManagedObjectSchemaApi).toHaveBeenCalledTimes(2);
    }
  );

  test('removeManagedObjectSchemaProperty refuses on classic without calling the API', async () => {
    const state = mockStateWithDebug('classic');
    await expect(
      removeManagedObjectSchemaProperty({
        type: 'alpha_user',
        propertyName: 'custom_merchantId',
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({ message: expect.stringMatching(/IDM/) }),
      ],
    });
    expect(deleteManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
  });
});

describe('buildManagedObjectSchemaPropertyPayload', () => {
  test('rejects an invalid property type', () => {
    expect(() =>
      buildManagedObjectSchemaPropertyPayload('custom_count', {
        type: 'integer' as any,
      })
    ).toThrow(/Invalid property type "integer"/);
  });

  test('rejects mismatched enumValues/enumTitles lengths', () => {
    expect(() =>
      buildManagedObjectSchemaPropertyPayload('custom_status', {
        type: 'string',
        enumValues: ['active', 'retired'],
        enumTitles: ['Active'],
      })
    ).toThrow(/enumTitles must have the same number of entries/);
  });

  test('collapses date/time/datetime/duration into type:string plus format', () => {
    for (const type of ['date', 'time', 'datetime', 'duration'] as const) {
      const payload = buildManagedObjectSchemaPropertyPayload('custom_field', {
        type,
      });
      expect(payload.type).toBe('string');
      expect(payload.format).toBe(type);
    }
  });

  test('wraps the leaf type under items when array is set', () => {
    const payload = buildManagedObjectSchemaPropertyPayload(
      'custom_callSigns',
      { type: 'string', array: true, title: 'Call Signs' }
    );
    expect(payload.type).toBe('array');
    expect(payload.items).toEqual({ type: 'string' });
    expect(payload.title).toBe('Call Signs');
  });

  test('defaults the title from the property name when not given', () => {
    const payload = buildManagedObjectSchemaPropertyPayload(
      'custom_availableFactors',
      { type: 'string' }
    );
    expect(payload.title).toBe('Custom Available Factors');
  });

  test('builds a script-derived virtual property from onRetrieveScript', () => {
    const payload = buildManagedObjectSchemaPropertyPayload(
      'custom_isFlightworthy',
      { type: 'boolean', onRetrieveScript: 'return true;' }
    );
    expect(payload.isVirtual).toBe(true);
    expect(payload.onRetrieve).toEqual({
      type: 'text/javascript',
      globals: {},
      source: 'return true;',
    });
    expect(payload.queryConfig).toBeUndefined();
  });

  test('builds an RDVP from deriveFromRelationship', () => {
    const payload = buildManagedObjectSchemaPropertyPayload(
      'custom_crewNames',
      {
        type: 'string',
        array: true,
        deriveFromRelationship: ['memberOfOrg'],
        deriveFields: ['sn'],
        flatten: true,
      }
    );
    expect(payload.isVirtual).toBe(true);
    expect(payload.queryConfig).toEqual({
      flattenProperties: true,
      referencedObjectFields: ['sn'],
      referencedRelationshipFields: ['memberOfOrg'],
    });
    expect(payload.onRetrieve).toBeUndefined();
  });
});

describe('extractManagedObjectSchemaPropertyFields', () => {
  test('round-trips a leaf property built by buildManagedObjectSchemaPropertyPayload', () => {
    const built = buildManagedObjectSchemaPropertyPayload('custom_status', {
      type: 'string',
      title: 'Status',
      enumValues: ['active', 'retired'],
      enumTitles: ['Active', 'Retired'],
      defaultValue: 'active',
      required: true,
      searchable: true,
    });
    const extracted = extractManagedObjectSchemaPropertyFields(built);
    expect(extracted.type).toBe('string');
    expect(extracted.array).toBe(false);
    expect(extracted.title).toBe('Status');
    expect(extracted.enumValues).toEqual(['active', 'retired']);
    expect(extracted.enumTitles).toEqual(['Active', 'Retired']);
    expect(extracted.defaultValue).toBe('active');
    expect(extracted.required).toBe(true);
    expect(extracted.searchable).toBe(true);
  });

  test('unwraps a date-format property back to type "date"', () => {
    const built = buildManagedObjectSchemaPropertyPayload('custom_hireDate', {
      type: 'date',
    });
    expect(extractManagedObjectSchemaPropertyFields(built).type).toBe('date');
  });

  test('unwraps an array property from items', () => {
    const built = buildManagedObjectSchemaPropertyPayload('custom_callSigns', {
      type: 'string',
      array: true,
    });
    const extracted = extractManagedObjectSchemaPropertyFields(built);
    expect(extracted.array).toBe(true);
    expect(extracted.type).toBe('string');
  });
});

describe('createManagedObjectSchemaFlatProperty / updateManagedObjectSchemaFlatProperty / removeManagedObjectSchemaFlatProperty', () => {
  beforeEach(() => {
    getConfigEntityApi.mockReset();
    putConfigEntityApi.mockReset();
    putConfigEntityApi.mockResolvedValue({});
  });

  test('creates a flat property and writes the updated type definition', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', { properties: {} });
    const result = await createManagedObjectSchemaFlatProperty({
      type: 'alpha_user',
      propertyName: 'custom_merchantId',
      fields: { type: 'string', title: 'Merchant ID' },
      state,
    });
    expect(result).toEqual(
      expect.objectContaining({ type: 'string', title: 'Merchant ID' })
    );
    expect(putConfigEntityApi).toHaveBeenCalledTimes(1);
    const written = (putConfigEntityApi.mock.calls[0][0] as any).entityData;
    expect(written.objects[0].schema.properties.custom_merchantId).toEqual(
      expect.objectContaining({ type: 'string' })
    );
  });

  test('refuses to create a property that already exists', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', {
      properties: { custom_merchantId: { type: 'string' } },
    });
    await expect(
      createManagedObjectSchemaFlatProperty({
        type: 'alpha_user',
        propertyName: 'custom_merchantId',
        fields: { type: 'string' },
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(/already exists/),
        }),
      ],
    });
    expect(putConfigEntityApi).not.toHaveBeenCalled();
  });

  test('refuses to create a property deriving from a relationship that does not exist', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', { properties: {} });
    await expect(
      createManagedObjectSchemaFlatProperty({
        type: 'alpha_user',
        propertyName: 'custom_crewNames',
        fields: {
          type: 'string',
          array: true,
          deriveFromRelationship: ['memberOfOrg'],
        },
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(/not a relationship property/),
        }),
      ],
    });
    expect(putConfigEntityApi).not.toHaveBeenCalled();
  });

  test('refuses to create a property deriving from a non-relationship sibling property', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', {
      properties: { memberOfOrg: { type: 'string' } },
    });
    await expect(
      createManagedObjectSchemaFlatProperty({
        type: 'alpha_user',
        propertyName: 'custom_crewNames',
        fields: {
          type: 'string',
          array: true,
          deriveFromRelationship: ['memberOfOrg'],
        },
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(/not a relationship property/),
        }),
      ],
    });
  });

  test('creates a relationship-derived virtual property when the relationship exists', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', {
      properties: { memberOfOrg: { type: 'relationship' } },
    });
    const result = await createManagedObjectSchemaFlatProperty({
      type: 'alpha_user',
      propertyName: 'memberOfOrgIDs',
      fields: {
        type: 'string',
        array: true,
        deriveFromRelationship: ['memberOfOrg'],
        deriveFields: ['_id'],
        flatten: true,
      },
      state,
    });
    expect(result.isVirtual).toBe(true);
    expect(putConfigEntityApi).toHaveBeenCalledTimes(1);
  });

  test('creates a nested property via subProperty, requiring the parent to be type object', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', {
      properties: { profile: { type: 'object', properties: {} } },
    });
    const result = await createManagedObjectSchemaFlatProperty({
      type: 'alpha_user',
      propertyName: 'profile',
      fields: { type: 'number', title: 'Seat Count' },
      subProperty: 'seatCount',
      state,
    });
    expect(result).toEqual(
      expect.objectContaining({ type: 'number', title: 'Seat Count' })
    );
    const written = (putConfigEntityApi.mock.calls[0][0] as any).entityData;
    expect(
      written.objects[0].schema.properties.profile.properties.seatCount
    ).toEqual(expect.objectContaining({ type: 'number' }));
  });

  test('updates only the explicitly-changed fields, leaving the rest as-is', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', {
      properties: {
        custom_status: {
          type: 'string',
          title: 'Status',
          searchable: true,
          enum: ['active', 'retired'],
        },
      },
    });
    const { current, propertyData } =
      await updateManagedObjectSchemaFlatProperty({
        type: 'alpha_user',
        propertyName: 'custom_status',
        changedFields: { title: 'Account Status' },
        state,
      });
    expect(current.title).toBe('Status');
    expect(propertyData.title).toBe('Account Status');
    // untouched fields survive the merge
    expect(propertyData.searchable).toBe(true);
    expect(propertyData.enum).toEqual(['active', 'retired']);
    expect(putConfigEntityApi).toHaveBeenCalledTimes(1);
  });

  test('refuses to update a property that does not exist', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', { properties: {} });
    await expect(
      updateManagedObjectSchemaFlatProperty({
        type: 'alpha_user',
        propertyName: 'custom_missing',
        changedFields: { title: 'Whatever' },
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(/not found/),
        }),
      ],
    });
    expect(putConfigEntityApi).not.toHaveBeenCalled();
  });

  test('removes an existing property and returns its prior definition', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', {
      properties: { custom_status: { type: 'string', title: 'Status' } },
      required: ['custom_status'],
      order: ['custom_status'],
    });
    const removed = await removeManagedObjectSchemaFlatProperty({
      type: 'alpha_user',
      propertyName: 'custom_status',
      state,
    });
    expect(removed).toEqual(
      expect.objectContaining({ type: 'string', title: 'Status' })
    );
    const written = (putConfigEntityApi.mock.calls[0][0] as any).entityData;
    expect(written.objects[0].schema.properties.custom_status).toBeUndefined();
    expect(written.objects[0].schema.required).not.toContain('custom_status');
    expect(written.objects[0].schema.order).not.toContain('custom_status');
  });

  test('refuses to remove a property that does not exist', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_user', { properties: {} });
    await expect(
      removeManagedObjectSchemaFlatProperty({
        type: 'alpha_user',
        propertyName: 'custom_missing',
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(/not found/),
        }),
      ],
    });
    expect(putConfigEntityApi).not.toHaveBeenCalled();
  });
});

describe('buildManagedObjectTypeSchema', () => {
  test('seeds a minimal type schema with a populated order array and a default icon', () => {
    const typeConfig = buildManagedObjectTypeSchema('alpha_widget', {
      title: 'Widget',
    });
    expect(typeConfig.name).toBe('alpha_widget');
    expect(typeConfig.schema).toEqual(
      expect.objectContaining({
        title: 'Widget',
        'mat-icon': 'widgets',
        type: 'object',
        properties: { _id: { type: 'string', title: 'Id' } },
        order: ['_id'],
        required: [],
      })
    );
    expect((typeConfig.schema as any).description).toBeUndefined();
  });

  test('uses the given icon and description when passed', () => {
    const typeConfig = buildManagedObjectTypeSchema('alpha_widget', {
      title: 'Widget',
      icon: 'directions_boat',
      description: 'A hovercraft owned by the fleet',
    });
    expect(typeConfig.schema['mat-icon']).toBe('directions_boat');
    expect((typeConfig.schema as any).description).toBe(
      'A hovercraft owned by the fleet'
    );
  });
});

describe('createManagedObjectType / updateManagedObjectType / removeManagedObjectType', () => {
  beforeEach(() => {
    getConfigEntityApi.mockReset();
    putConfigEntityApi.mockReset();
    putConfigEntityApi.mockResolvedValue({});
  });

  test('creates a new managed object type and writes its seeded schema', async () => {
    const state = mockConfigState();
    getConfigEntityApi.mockResolvedValue({ _id: 'managed', objects: [] });
    const written = await createManagedObjectType({
      type: 'alpha_widget',
      fields: { title: 'Widget', icon: 'directions_boat' },
      state,
    });
    expect(written).toEqual(
      expect.objectContaining({
        title: 'Widget',
        'mat-icon': 'directions_boat',
      })
    );
    expect(putConfigEntityApi).toHaveBeenCalledTimes(1);
    const writtenEntity = (putConfigEntityApi.mock.calls[0][0] as any)
      .entityData;
    expect(
      writtenEntity.objects.some((o: any) => o.name === 'alpha_widget')
    ).toBe(true);
  });

  test('refuses to create a type that already exists', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_widget', { title: 'Widget' });
    await expect(
      createManagedObjectType({
        type: 'alpha_widget',
        fields: { title: 'Widget' },
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(/already exists/),
        }),
      ],
    });
    expect(putConfigEntityApi).not.toHaveBeenCalled();
  });

  test('updates only the explicitly-changed fields, leaving the rest as-is', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_widget', {
      title: 'Widget',
      'mat-icon': 'widgets',
      description: 'Original description',
    });
    const { current, proposed } = await updateManagedObjectType({
      type: 'alpha_widget',
      changedFields: { title: 'Widget (Updated)' },
      state,
    });
    expect(current).toEqual({
      title: 'Widget',
      icon: 'widgets',
      description: 'Original description',
    });
    expect(proposed).toEqual({
      title: 'Widget (Updated)',
      icon: 'widgets',
      description: 'Original description',
    });
    expect(putConfigEntityApi).toHaveBeenCalledTimes(1);
    const writtenEntity = (putConfigEntityApi.mock.calls[0][0] as any)
      .entityData;
    const writtenType = writtenEntity.objects.find(
      (o: any) => o.name === 'alpha_widget'
    );
    expect(writtenType.schema.title).toBe('Widget (Updated)');
    expect(writtenType.schema['mat-icon']).toBe('widgets');
  });

  test('refuses to update a type that does not exist', async () => {
    const state = mockConfigState();
    getConfigEntityApi.mockResolvedValue({ _id: 'managed', objects: [] });
    await expect(
      updateManagedObjectType({
        type: 'alpha_missing',
        changedFields: { title: 'Whatever' },
        state,
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Error updating managed object type/),
    });
    expect(putConfigEntityApi).not.toHaveBeenCalled();
  });

  test('removes an existing managed object type', async () => {
    const state = mockConfigState();
    mockManagedConfig('alpha_widget', { title: 'Widget' });
    await removeManagedObjectType({ type: 'alpha_widget', state });
    expect(putConfigEntityApi).toHaveBeenCalledTimes(1);
    const writtenEntity = (putConfigEntityApi.mock.calls[0][0] as any)
      .entityData;
    expect(
      writtenEntity.objects.some((o: any) => o.name === 'alpha_widget')
    ).toBe(false);
  });

  test('refuses to remove a type that does not exist', async () => {
    const state = mockConfigState();
    getConfigEntityApi.mockResolvedValue({ _id: 'managed', objects: [] });
    await expect(
      removeManagedObjectType({ type: 'alpha_missing', state })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Error removing managed object type/),
    });
    expect(putConfigEntityApi).not.toHaveBeenCalled();
  });
});

/** A one-sided (no reverse configured) relationship property, as the v2 API would return it. */
function oneSidedRelationshipProperty(): Record<string, unknown> {
  return {
    id: 'agent',
    type: 'relationship',
    title: 'Agent',
    viewable: true,
    userEditable: false,
    returnByDefault: false,
    resourceCollection: [
      {
        label: 'Agent',
        notify: false,
        path: 'managed/alpha_aiagent',
        query: { fields: ['_id'], queryFilter: 'true' },
      },
    ],
    reverseRelationship: false,
    validate: true,
    notifySelf: false,
  };
}

/** The forward side of a bidirectional pair, referencing 'privileges' on 'alpha_aiagentprivilege'. */
function forwardRelationshipProperty(): Record<string, unknown> {
  return {
    ...oneSidedRelationshipProperty(),
    reverseRelationship: true,
    reversePropertyName: 'privileges',
  };
}

/** The reverse (to-many) side of that same bidirectional pair, on 'alpha_aiagent', pointing back at 'alpha_aiagentprivilege'. */
function reverseRelationshipProperty(): Record<string, unknown> {
  return {
    type: 'array',
    title: 'Privileges',
    viewable: true,
    userEditable: false,
    returnByDefault: false,
    items: {
      id: 'privileges',
      type: 'relationship',
      resourceCollection: [
        {
          label: 'Privileges',
          notify: false,
          path: 'managed/alpha_aiagentprivilege',
          query: { fields: [], queryFilter: 'true' },
        },
      ],
      reverseRelationship: true,
      reversePropertyName: 'agent',
      validate: true,
      notifySelf: false,
    },
  };
}

describe('buildManagedObjectSchemaRelationshipPropertyPayload', () => {
  test('builds a single (non-many) relationship', () => {
    const payload = buildManagedObjectSchemaRelationshipPropertyPayload(
      'agent',
      { targetObject: 'alpha_aiagent', queryFields: ['_id'] }
    );
    expect(payload.type).toBe('relationship');
    expect(payload.title).toBe('Agent');
    expect(payload.viewable).toBe(true);
    expect((payload.resourceCollection as any[])[0]).toEqual(
      expect.objectContaining({ path: 'managed/alpha_aiagent' })
    );
  });

  test('wraps a many relationship under items with an "Items" title', () => {
    const payload = buildManagedObjectSchemaRelationshipPropertyPayload(
      'privileges',
      { targetObject: 'alpha_aiagentprivilege', many: true, queryFields: [] }
    );
    expect(payload.type).toBe('array');
    expect(payload.title).toBe('Privileges');
    expect((payload.items as any).title).toBe('Privileges Items');
    expect((payload.items as any).type).toBe('relationship');
  });

  test('embeds a reverse-property descriptor when reverse is given', () => {
    const payload = buildManagedObjectSchemaRelationshipPropertyPayload(
      'agent',
      { targetObject: 'alpha_aiagentprivilege', queryFields: ['_id'] },
      { propertyName: 'privileges', many: true, queryFields: [] }
    );
    const resourceCollection = (payload.resourceCollection as any[])[0];
    expect(resourceCollection.reverseProperty).toEqual(
      expect.objectContaining({ type: 'array' })
    );
  });
});

describe('extractManagedObjectSchemaRelationshipPropertyFields', () => {
  test('round-trips a single relationship property', () => {
    const extracted = extractManagedObjectSchemaRelationshipPropertyFields(
      oneSidedRelationshipProperty()
    );
    expect(extracted.targetObject).toBe('alpha_aiagent');
    expect(extracted.many).toBe(false);
    expect(extracted.title).toBe('Agent');
    expect(extracted.reversePropertyName).toBeUndefined();
  });

  test('round-trips a many (array) relationship property', () => {
    const extracted = extractManagedObjectSchemaRelationshipPropertyFields(
      reverseRelationshipProperty()
    );
    expect(extracted.many).toBe(true);
    expect(extracted.targetObject).toBe('alpha_aiagentprivilege');
    expect(extracted.reversePropertyName).toBe('agent');
  });
});

describe('toManagedObjectSchemaRelationshipReverseFields', () => {
  test('maps extracted fields into the reverse-descriptor shape', () => {
    const fields = extractManagedObjectSchemaRelationshipPropertyFields(
      forwardRelationshipProperty()
    );
    const reverse = toManagedObjectSchemaRelationshipReverseFields(
      'agent',
      fields
    );
    expect(reverse).toEqual({
      propertyName: 'agent',
      many: false,
      queryFields: ['_id'],
      title: 'Agent',
      description: undefined,
    });
  });
});

describe('inferManagedObjectSchemaRelationshipReverseIdentity', () => {
  test('returns null when no reverse is configured', () => {
    expect(
      inferManagedObjectSchemaRelationshipReverseIdentity(
        oneSidedRelationshipProperty()
      )
    ).toBeNull();
  });

  test('infers the reverse type/property name from a configured reverse', () => {
    expect(
      inferManagedObjectSchemaRelationshipReverseIdentity(
        forwardRelationshipProperty()
      )
    ).toEqual({ type: 'alpha_aiagent', propertyName: 'privileges' });
  });
});

describe('readManagedObjectSchemaRelationshipPropertyOrNull', () => {
  beforeEach(() => {
    getManagedObjectSchemaPropertyApi.mockReset();
  });

  test('returns the property when found', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockResolvedValue(
      oneSidedRelationshipProperty()
    );
    const result = await readManagedObjectSchemaRelationshipPropertyOrNull({
      type: 'alpha_aiagentprivilege',
      propertyName: 'agent',
      state,
    });
    expect(result).toEqual(oneSidedRelationshipProperty());
  });

  test('returns null on a 404', async () => {
    const state = mockConfigState();
    const notFound: any = new Error('not found');
    notFound.response = { status: 404 };
    getManagedObjectSchemaPropertyApi.mockRejectedValue(notFound);
    const result = await readManagedObjectSchemaRelationshipPropertyOrNull({
      type: 'alpha_aiagentprivilege',
      propertyName: 'missing',
      state,
    });
    expect(result).toBeNull();
  });

  test('propagates a non-404 failure', async () => {
    const state = mockConfigState();
    const serverError: any = new Error('server error');
    serverError.response = { status: 500 };
    getManagedObjectSchemaPropertyApi.mockRejectedValue(serverError);
    await expect(
      readManagedObjectSchemaRelationshipPropertyOrNull({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        state,
      })
    ).rejects.toThrow();
  });
});

describe('createManagedObjectSchemaRelationshipProperty / updateManagedObjectSchemaRelationshipProperty / removeManagedObjectSchemaRelationshipProperty', () => {
  beforeEach(() => {
    getManagedObjectSchemaPropertyApi.mockReset();
    putManagedObjectSchemaPropertyApi.mockReset();
    putManagedObjectSchemaPropertyApi.mockResolvedValue({});
    deleteManagedObjectSchemaPropertyApi.mockReset();
    deleteManagedObjectSchemaPropertyApi.mockResolvedValue({});
  });

  function notFoundError(): any {
    const error: any = new Error('not found');
    error.response = { status: 404 };
    return error;
  }

  test('creates a one-sided relationship with no reverse', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockRejectedValue(notFoundError());
    const written = await createManagedObjectSchemaRelationshipProperty({
      type: 'alpha_aiagentprivilege',
      propertyName: 'agent',
      fields: { targetObject: 'alpha_aiagent', queryFields: ['_id'] },
      state,
    });
    expect(written).toEqual(
      expect.objectContaining({ type: 'relationship', title: 'Agent' })
    );
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledTimes(1);
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
      })
    );
  });

  test('refuses to create a relationship that already exists', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockResolvedValue(
      oneSidedRelationshipProperty()
    );
    await expect(
      createManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        fields: { targetObject: 'alpha_aiagent', queryFields: ['_id'] },
        state,
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Error creating relationship/),
    });
    expect(putManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
  });

  test('refuses to create with a reverse property that already exists', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockImplementation(async (args: any) => {
      if (args.propertyName === 'privileges') {
        return reverseRelationshipProperty();
      }
      throw notFoundError();
    });
    await expect(
      createManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        fields: { targetObject: 'alpha_aiagent', queryFields: ['_id'] },
        reverse: { propertyName: 'privileges', many: true, queryFields: [] },
        state,
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Error creating relationship/),
    });
    expect(putManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
  });

  test('creates a bidirectional relationship, embedding the reverse descriptor in the forward write only', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockRejectedValue(notFoundError());
    const written = await createManagedObjectSchemaRelationshipProperty({
      type: 'alpha_aiagentprivilege',
      propertyName: 'agent',
      fields: { targetObject: 'alpha_aiagent', queryFields: ['_id'] },
      reverse: { propertyName: 'privileges', many: true, queryFields: [] },
      state,
    });
    expect(written.reverseRelationship).toBe(true);
    expect(written.reversePropertyName).toBe('privileges');
    const resourceCollection = (written.resourceCollection as any[])[0];
    expect(resourceCollection.reverseProperty).toBeDefined();
    // The server auto-creates the reverse side -- only one write happens here.
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledTimes(1);
  });

  test('updates only the explicitly-changed fields on a one-sided relationship', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockResolvedValue(
      oneSidedRelationshipProperty()
    );
    const { forward, reverse } =
      await updateManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        changedFields: { title: 'Agent (Updated)' },
        state,
      });
    expect(forward.title).toBe('Agent (Updated)');
    expect(reverse).toBeUndefined();
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledTimes(1);
  });

  test('refuses to update a relationship that does not exist', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockRejectedValue(notFoundError());
    await expect(
      updateManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'missing',
        changedFields: { title: 'Whatever' },
        state,
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Error updating relationship/),
    });
    expect(putManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
  });

  test('re-supplies the reverse descriptor on a bidirectional property even without withReverse', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockImplementation(async (args: any) => {
      if (args.propertyName === 'agent') return forwardRelationshipProperty();
      if (args.propertyName === 'privileges')
        return reverseRelationshipProperty();
      throw notFoundError();
    });
    const { forward, reverse } =
      await updateManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        changedFields: { title: 'Agent (Updated)' },
        state,
      });
    expect(forward.title).toBe('Agent (Updated)');
    const resourceCollection = (forward.resourceCollection as any[])[0];
    expect(resourceCollection.reverseProperty).toBeDefined();
    // withReverse wasn't passed -- only the forward side is written.
    expect(reverse).toBeUndefined();
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledTimes(1);
  });

  test('refuses --with-reverse when no reverse is configured', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockResolvedValue(
      oneSidedRelationshipProperty()
    );
    await expect(
      updateManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        changedFields: { title: 'Whatever' },
        withReverse: true,
        state,
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Error updating relationship/),
    });
    expect(putManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
  });

  test('withReverse updates both sides', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockImplementation(async (args: any) => {
      if (args.propertyName === 'agent') return forwardRelationshipProperty();
      if (args.propertyName === 'privileges')
        return reverseRelationshipProperty();
      throw notFoundError();
    });
    const { forward, reverse } =
      await updateManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        changedFields: { title: 'Agent (Updated)' },
        withReverse: true,
        state,
      });
    expect(forward.title).toBe('Agent (Updated)');
    expect(reverse?.type).toBe('alpha_aiagent');
    expect(reverse?.propertyName).toBe('privileges');
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledTimes(2);
  });

  test('reports a partial failure when the forward write succeeds but the reverse write fails', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockImplementation(async (args: any) => {
      if (args.propertyName === 'agent') return forwardRelationshipProperty();
      if (args.propertyName === 'privileges')
        return reverseRelationshipProperty();
      throw notFoundError();
    });
    putManagedObjectSchemaPropertyApi.mockImplementation(async (args: any) => {
      if (args.propertyName === 'privileges') {
        throw new Error('reverse write failed');
      }
      return {};
    });
    await expect(
      updateManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        changedFields: { title: 'Agent (Updated)' },
        withReverse: true,
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(
            /but failed to update its reverse relationship/
          ),
        }),
      ],
    });
    // The forward write was attempted (and succeeded) before the reverse failure.
    expect(putManagedObjectSchemaPropertyApi).toHaveBeenCalledWith(
      expect.objectContaining({ propertyName: 'agent' })
    );
  });

  test('removes a one-sided relationship', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockResolvedValue(
      oneSidedRelationshipProperty()
    );
    const { current, reverse } =
      await removeManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        state,
      });
    expect(current).toEqual(oneSidedRelationshipProperty());
    expect(reverse).toBeUndefined();
    expect(deleteManagedObjectSchemaPropertyApi).toHaveBeenCalledTimes(1);
  });

  test('refuses to remove a relationship that does not exist', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockRejectedValue(notFoundError());
    await expect(
      removeManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'missing',
        state,
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Error removing relationship/),
    });
    expect(deleteManagedObjectSchemaPropertyApi).not.toHaveBeenCalled();
  });

  test('withReverse deletes the reverse side first, then the forward side', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockImplementation(async (args: any) => {
      if (args.propertyName === 'agent') return forwardRelationshipProperty();
      if (args.propertyName === 'privileges')
        return reverseRelationshipProperty();
      throw notFoundError();
    });
    const deleteOrder: string[] = [];
    deleteManagedObjectSchemaPropertyApi.mockImplementation(
      async (args: any) => {
        deleteOrder.push(args.propertyName);
        return {};
      }
    );
    const { current, reverse } =
      await removeManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        withReverse: true,
        state,
      });
    expect(current).toEqual(forwardRelationshipProperty());
    expect(reverse?.type).toBe('alpha_aiagent');
    expect(reverse?.propertyName).toBe('privileges');
    expect(deleteOrder).toEqual(['privileges', 'agent']);
  });

  test('treats a 404 on the forward delete after a successful withReverse reverse delete as success (cascade)', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockImplementation(async (args: any) => {
      if (args.propertyName === 'agent') return forwardRelationshipProperty();
      if (args.propertyName === 'privileges')
        return reverseRelationshipProperty();
      throw notFoundError();
    });
    deleteManagedObjectSchemaPropertyApi.mockImplementation(
      async (args: any) => {
        if (args.propertyName === 'agent') {
          throw notFoundError();
        }
        return {};
      }
    );
    await expect(
      removeManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        withReverse: true,
        state,
      })
    ).resolves.toEqual(
      expect.objectContaining({ current: forwardRelationshipProperty() })
    );
  });

  test('does not attempt the forward delete when the reverse delete fails', async () => {
    const state = mockConfigState();
    getManagedObjectSchemaPropertyApi.mockImplementation(async (args: any) => {
      if (args.propertyName === 'agent') return forwardRelationshipProperty();
      if (args.propertyName === 'privileges')
        return reverseRelationshipProperty();
      throw notFoundError();
    });
    deleteManagedObjectSchemaPropertyApi.mockImplementation(
      async (args: any) => {
        if (args.propertyName === 'privileges') {
          throw new Error('reverse delete failed');
        }
        return {};
      }
    );
    await expect(
      removeManagedObjectSchemaRelationshipProperty({
        type: 'alpha_aiagentprivilege',
        propertyName: 'agent',
        withReverse: true,
        state,
      })
    ).rejects.toMatchObject({
      originalErrors: [
        expect.objectContaining({
          message: expect.stringMatching(/was left untouched/),
        }),
      ],
    });
    expect(deleteManagedObjectSchemaPropertyApi).not.toHaveBeenCalledWith(
      expect.objectContaining({ propertyName: 'agent' })
    );
  });
});
