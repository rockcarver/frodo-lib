/**
 * Run tests
 *
 *        npm run test:only -- src/ops/IdmConfigOps.processEnvironment
 *
 * The switch `state.setUseProcessEnvironmentForPlaceholders(true)` (frodo-lib#1109) lets the placeholders of the files that
 * the library reads fall back to the environment of the process. It must NOT reach the substitution of IDM configuration
 * objects:
 *
 * - on export, the values that the state holds are replaced by their `${KEY}` placeholder; the environment of the process
 *   is never read, so an export with the switch on is byte for byte the export with the switch off, however odd the
 *   process environment is (a variable that holds `1`, an empty one, a very long one). This is the regression that a
 *   first attempt at the fallback caused in frodo-cli (a variable `NO_COLOR=1` replaced every `1` of an export);
 * - on import, only the placeholders of the keys that the state holds are replaced; a `${NAME}` that the state does not
 *   know is left alone (it can be part of the source of a script), also when the process has a variable of that name.
 *
 * Only the api layer is faked. Hermetic: made-up ids and values, no network, no files.
 */
import { jest } from '@jest/globals';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import State from '../shared/State';

const ENTITY: IdObjectSkeletonInterface = {
  _id: 'sample/config',
  text: 'the colour is 1 and 2, the made-up value is made-up-state-value, an empty string is "".',
  nested: { list: ['1', '1', 'made-up-state-value'], flag: true, count: 11 },
  script: { source: 'return `${MADE_UP_HOME}/file`;' },
};

const getConfigEntity = jest.fn(async (): Promise<IdObjectSkeletonInterface> =>
  JSON.parse(JSON.stringify(ENTITY))
);
const putConfigEntity = jest.fn(
  async ({
    entityId,
    entityData,
  }: {
    entityId: string;
    entityData: IdObjectSkeletonInterface;
  }): Promise<IdObjectSkeletonInterface> => ({
    ...entityData,
    _id: entityId,
  })
);

jest.unstable_mockModule('../api/IdmConfigApi', () => ({
  getConfigEntities: jest.fn(),
  getConfigEntity,
  getConfigEntitiesByType: jest.fn(),
  getConfigStubs: jest.fn(),
  putConfigEntity,
  deleteConfigEntity: jest.fn(),
}));

const { exportConfigEntity, importConfigEntities } =
  await import('./IdmConfigOps');

/** An odd process environment: values that would wreck a text replace if they were ever used as one. */
const ODD = {
  FRODO_TEST_IDM_ONE: '1',
  FRODO_TEST_IDM_EMPTY: '',
  FRODO_TEST_IDM_LONG: 'x'.repeat(200000),
  FRODO_TEST_IDM_QUOTE: '"',
  FRODO_TEST_IDM_HOME: '/made/up/home',
};

let state: ReturnType<typeof State>;

beforeEach(() => {
  jest.clearAllMocks();
  state = State({});
  state.setDeploymentType('cloud');
  for (const [name, value] of Object.entries(ODD)) process.env[name] = value;
});

afterEach(() => {
  for (const name of Object.keys(ODD)) delete process.env[name];
});

/** The entities that the api layer was asked to write, in order. */
const written = () =>
  putConfigEntity.mock.calls.map(([args]) => args.entityData);

describe('export: the process environment is never read', () => {
  test('1: with values in the state, the export with the switch on is the export with the switch off, byte for byte', async () => {
    state.setEnv('MADE_UP_KEY', 'made-up-state-value');

    const switchedOff = await exportConfigEntity({
      entityId: ENTITY._id,
      state,
    });
    state.setUseProcessEnvironmentForPlaceholders(true);
    const switchedOn = await exportConfigEntity({
      entityId: ENTITY._id,
      state,
    });

    expect(JSON.stringify(switchedOn.idm)).toBe(
      JSON.stringify(switchedOff.idm)
    );
    // and the value of the state is still replaced, as before
    expect(JSON.stringify(switchedOn.idm)).toContain('${MADE_UP_KEY}');
    expect(JSON.stringify(switchedOn.idm)).not.toContain('made-up-state-value');
  });

  test('2: with no value in the state, nothing is replaced, whatever the process environment holds', async () => {
    state.setUseProcessEnvironmentForPlaceholders(true);
    const result = await exportConfigEntity({ entityId: ENTITY._id, state });
    expect(result.idm[ENTITY._id]).toEqual(ENTITY);
  });
});

describe('import: only the keys of the state are replaced', () => {
  const entityWithPlaceholders = (): IdObjectSkeletonInterface => ({
    _id: 'sample/config',
    text: 'value ${MADE_UP_KEY}',
    script: { source: 'return `${FRODO_TEST_IDM_HOME}/file`;' },
  });

  test('3: a placeholder of a key of the state is replaced, with the switch off and on', async () => {
    state.setEnv('MADE_UP_KEY', 'made-up-state-value');
    for (const on of [false, true]) {
      state.setUseProcessEnvironmentForPlaceholders(on);
      await importConfigEntities({
        importData: {
          meta: {},
          idm: { 'sample/config': entityWithPlaceholders() },
        } as any,
        options: { validate: false },
        state,
      });
    }
    expect(written().map((entity) => entity.text)).toEqual([
      'value made-up-state-value',
      'value made-up-state-value',
    ]);
  });

  test('4: a ${NAME} that the state does not know is left alone, also when the process has that variable and the switch is on', async () => {
    state.setUseProcessEnvironmentForPlaceholders(true);
    await importConfigEntities({
      importData: {
        meta: {},
        idm: { 'sample/config': entityWithPlaceholders() },
      } as any,
      options: { validate: false },
      state,
    });
    const [entity] = written();
    expect(entity.script).toEqual({
      source: 'return `${FRODO_TEST_IDM_HOME}/file`;',
    });
    expect(entity.text).toBe('value ${MADE_UP_KEY}');
    expect(JSON.stringify(entity)).not.toContain('/made/up/home');
  });
});
