/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses
 *
 *    To record API responses, you must call the test:record script and
 *    override all the connection state required to connect to the
 *    env to record from:
 *
 *    ATTENTION: For the recording to succeed, you MUST make sure to use a
 *               user account, not a service account.
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record MappingOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update snapshots
 *
 *    After recording API responses, you must manually update/create snapshots
 *    by running:
 *
 *        FRODO_DEBUG=1 npm run test:update MappingOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        FRODO_DEBUG=1 npm run test:only MappingOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { autoSetupPolly } from "../utils/AutoSetupPolly";
import { filterRecording } from "../utils/PollyUtils";
import * as MappingOps from "./MappingOps";
import { state } from "../lib/FrodoLib";
import { MappingSkeleton} from "./MappingOps";

const ctx = autoSetupPolly();

async function stageMapping(
  mapping: MappingSkeleton,
  create = true
) {
  // delete if exists, then create
  try {
    await MappingOps.readMapping({
      mappingId: mapping._id,
      state
    });
    await MappingOps.deleteMapping({
      mappingId: mapping._id,
      state,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await MappingOps.createMapping({
        mappingId: mapping._id,
        mappingData: mapping,
        state
      });
    }
  }
}

function makeSimpleTestMapping(i: number, type: string): MappingSkeleton {
  return {
    _id: `${type}/mapping${i}`,
    name: `mapping${i}`,
    displayName: `mapping${i}`,
    linkQualifiers: [],
    consentRequired: false,
    policies: [],
    properties: [],
    source: 'managed/bravo_user',
    target: 'managed/bravo_user',
    syncAfter: [],
  };
}

const SYNC = 'sync';
const MAPPING = 'mapping';

describe('MappingOps', () => {

  // Mappings for read/export tests
  const mapping1: MappingSkeleton = {
    _id: 'sync/mapping1',
    name: 'mapping1',
    displayName: 'mapping1',
    linkQualifiers: [],
    consentRequired: false,
    policies: [],
    properties: [],
    source: 'system/connector1/bravo_user',
    target: 'system/connector1/bravo_user',
    syncAfter: [],
  };
  const mapping2: MappingSkeleton = makeSimpleTestMapping(2, MAPPING);
  // Mappings for create tests
  const mapping3: MappingSkeleton = makeSimpleTestMapping(3, SYNC);
  const mapping4: MappingSkeleton = makeSimpleTestMapping(4, MAPPING);
  // Mappings for import tests
  const mapping5: MappingSkeleton = makeSimpleTestMapping(5, SYNC);
  const mapping6: MappingSkeleton = makeSimpleTestMapping(6, MAPPING);
  // Mappings for import first tests
  const mapping7: MappingSkeleton = makeSimpleTestMapping(7, SYNC);
  const mapping8: MappingSkeleton = makeSimpleTestMapping(8, MAPPING);
  // Mappings for import all tests
  const mapping9: MappingSkeleton = makeSimpleTestMapping(9, SYNC);
  const mapping10: MappingSkeleton = makeSimpleTestMapping(10, MAPPING);
  // Mappings for update tests
  const mapping11: MappingSkeleton = makeSimpleTestMapping(11, SYNC);
  const mapping12: MappingSkeleton = makeSimpleTestMapping(12, MAPPING);

  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageMapping(mapping1);
      await stageMapping(mapping2);
      await stageMapping(mapping3, false);
      await stageMapping(mapping4, false);
      await stageMapping(mapping5, false);
      await stageMapping(mapping6, false);
      await stageMapping(mapping7, false);
      await stageMapping(mapping8, false);
      await stageMapping(mapping9, false);
      await stageMapping(mapping10, false);
      await stageMapping(mapping11);
      await stageMapping(mapping12);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageMapping(mapping1, false);
      await stageMapping(mapping2, false);
      await stageMapping(mapping3, false);
      await stageMapping(mapping4, false);
      await stageMapping(mapping5, false);
      await stageMapping(mapping6, false);
      await stageMapping(mapping7, false);
      await stageMapping(mapping8, false);
      await stageMapping(mapping9, false);
      await stageMapping(mapping10, false);
      await stageMapping(mapping11);
      await stageMapping(mapping12);
    }
  });

  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('createMappingExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.createMappingExportTemplate).toBeDefined();
    });

    test('1: Create Mapping Export Template', async () => {
      const response = MappingOps.createMappingExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('readSyncMappings()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.readSyncMappings).toBeDefined();
    });

    test('1: Read sync mappings', async () => {
      const response = await MappingOps.readSyncMappings({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readNewMappings()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.readNewMappings).toBeDefined();
    });

    test('1: Read new mappings', async () => {
      const response = await MappingOps.readNewMappings({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readMappings()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.readMappings).toBeDefined();
    });

    test('1: Read mappings', async () => {
      const response = await MappingOps.readMappings({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('readMapping()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.readMapping).toBeDefined();
    });

    test('1: Should read sync mapping', async () => {
      expect(await MappingOps.readMapping({
        mappingId: mapping1._id,
        state
      })).toMatchSnapshot();
    });

    test('2: Should read regular mapping', async () => {
      expect(await MappingOps.readMapping({
        mappingId: mapping2._id,
        state
      })).toMatchSnapshot();
    });
  });

  describe('createMapping()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.createMapping).toBeDefined();
    });

    test('1: Should create sync mapping', async () => {
      expect(await MappingOps.createMapping({
        mappingId: mapping3._id,
        mappingData: mapping3,
        state
      })).toMatchSnapshot();
    });

    test('2: Should create regular mapping', async () => {
      expect(await MappingOps.createMapping({
        mappingId: mapping4._id,
        mappingData: mapping4,
        state
      })).toMatchSnapshot();
    });
  });

  describe('updateMapping()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.updateMapping).toBeDefined();
    });

    test('1: Should update sync mapping', async () => {
      expect(await MappingOps.updateMapping({
        mappingId: mapping11._id,
        mappingData: {...mapping11, consentRequired: true, },
        state
      })).toMatchSnapshot();
    });

    test('2: Should update regular mapping', async () => {
      expect(await MappingOps.updateMapping({
        mappingId: mapping12._id,
        mappingData: {...mapping12, consentRequired: true, },
        state
      })).toMatchSnapshot();
    });
  });

  describe('exportMapping()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.exportMapping).toBeDefined();
    });

    test('1: Should export sync mapping', async () => {
      expect(await MappingOps.exportMapping({
        mappingId: mapping1._id,
        options: {
          useStringArrays: false,
          deps: false,
          connectorId: 'connector1',
          moType: undefined
        },
        state
      })).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });

    test('2: Should export regular mapping', async () => {
      expect(await MappingOps.exportMapping({
        mappingId: mapping2._id,
        options: {
          useStringArrays: true,
          deps: true,
          connectorId: undefined,
          moType: 'bravo_user'
        },
        state
      })).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('exportMappings()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.exportMappings).toBeDefined();
    });

    test('1: Export mappings', async () => {
      const response = await MappingOps.exportMappings({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('importMapping()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.importMapping).toBeDefined();
    });

    test('1: Should import sync mapping', async () => {
      const importData = MappingOps.createMappingExportTemplate({ state });
      importData.sync.mappings.push(mapping5);
      expect(await MappingOps.importMapping({
        mappingId: mapping5._id,
        importData,
        options: {
          deps: false,
        },
        state
      })).toMatchSnapshot();
    });

    test('2: Should import regular mapping', async () => {
      const importData = MappingOps.createMappingExportTemplate({ state });
      importData.mapping[mapping6._id] = mapping6;
      expect(await MappingOps.importMapping({
        mappingId: mapping6._id,
        importData,
        options: {
          deps: false,
        },
        state
      })).toMatchSnapshot();
    });
  });

  describe('importFirstMapping()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.importFirstMapping).toBeDefined();
    });

    test('1: Should import first sync mapping', async () => {
      const importData = MappingOps.createMappingExportTemplate({ state });
      importData.sync.mappings.push(mapping7);
      importData.mapping[mapping8._id] = mapping8;
      expect(await MappingOps.importFirstMapping({
        importData,
        state
      })).toMatchSnapshot();
    });

    test('2: Should import first regular mapping', async () => {
      const importData = MappingOps.createMappingExportTemplate({ state });
      importData.mapping[mapping8._id] = mapping8;
      importData.mapping[mapping7._id] = mapping7;
      expect(await MappingOps.importFirstMapping({
        importData,
        state
      })).toMatchSnapshot();
    });
  });

  describe('importMappings()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.importMappings).toBeDefined();
    });

    test('1: Should import mappings', async () => {
      const importData = MappingOps.createMappingExportTemplate({ state });
      importData.sync.mappings.push(mapping9);
      importData.mapping[mapping10._id] = mapping10;
      expect(await MappingOps.importMappings({
        importData,
        state
      })).toMatchSnapshot();
    });
  });

  describe('updateLegacyMappings()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.updateLegacyMappings).toBeDefined();
    });
    //TODO: create tests
  });

  describe('deleteMappings()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.deleteMappings).toBeDefined();
    });
    //TODO: create tests
  });

  describe('deleteMapping()', () => {
    test('0: Method is implemented', async () => {
      expect(MappingOps.deleteMapping).toBeDefined();
    });
    //TODO: create tests
  });
});
