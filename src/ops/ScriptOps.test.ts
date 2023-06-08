/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record ScriptOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you musty manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update ScriptOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only ScriptOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as ScriptOps from './ScriptOps';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { ScriptSkeleton } from '../../types/api/ApiTypes';

autoSetupPolly();

async function stageScript(
  script: { id: string; name: string; data: ScriptSkeleton },
  create = true
) {
  // delete if exists, then create
  try {
    await ScriptOps.getScript({ scriptId: script.id, state });
    await ScriptOps.deleteScript({ scriptId: script.id, state });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await ScriptOps.putScript({
        scriptId: script.id,
        scriptData: script.data,
        state,
      });
    }
  }
}

describe('ScriptOps', () => {
  const script1 = {
    id: 'c9cb4b1e-1cd3-4e5b-8f56-140f83ba9f6d',
    name: 'FrodoTestScript1',
    data: {
      _id: 'c9cb4b1e-1cd3-4e5b-8f56-140f83ba9f6d',
      name: 'FrodoTestScript1',
      description: 'Check if username has already been collected.',
      script: [
        '/* Check Username',
        ' *',
        ' * Author: volker.scheuber@forgerock.com',
        ' * ',
        ' * Check if username has already been collected.',
        ' * Return "known" if yes, "unknown" otherwise.',
        ' * ',
        ' * This script does not need to be parametrized. It will work properly as is.',
        ' * ',
        ' * The Scripted Decision Node needs the following outcomes defined:',
        ' * - known',
        ' * - unknown',
        ' */',
        '(function () {',
        '    if (null != sharedState.get("username")) {',
        '        outcome = "known";',
        '    }',
        '    else {',
        '        outcome = "unknown";',
        '    }',
        '}());',
      ],
      default: false,
      language: 'JAVASCRIPT',
      context: 'AUTHENTICATION_TREE_DECISION_NODE',
      createdBy: 'null',
      creationDate: 0,
      lastModifiedBy: 'null',
      lastModifiedDate: 0,
    } as ScriptSkeleton,
  };
  const script2 = {
    id: 'b7259916-71ed-4675-8c5a-de86a80e4aed',
    name: 'FrodoTestScript2',
    data: {
      _id: 'b7259916-71ed-4675-8c5a-de86a80e4aed',
      name: 'FrodoTestScript2',
      description: 'Check if username has already been collected.',
      script: [
        '/* Check Username',
        ' *',
        ' * Author: volker.scheuber@forgerock.com',
        ' * ',
        ' * Check if username has already been collected.',
        ' * Return "known" if yes, "unknown" otherwise.',
        ' * ',
        ' * This script does not need to be parametrized. It will work properly as is.',
        ' * ',
        ' * The Scripted Decision Node needs the following outcomes defined:',
        ' * - known',
        ' * - unknown',
        ' */',
        '(function () {',
        '    if (null != sharedState.get("username")) {',
        '        outcome = "known";',
        '    }',
        '    else {',
        '        outcome = "unknown";',
        '    }',
        '}());',
      ],
      default: false,
      language: 'JAVASCRIPT',
      context: 'AUTHENTICATION_TREE_DECISION_NODE',
      createdBy: 'null',
      creationDate: 0,
      lastModifiedBy: 'null',
      lastModifiedDate: 0,
    } as ScriptSkeleton,
  };
  const script3 = {
    id: '3b2f6836-184c-4ee9-8a1d-557cb01837a5',
    name: 'FrodoTestScript3',
    data: {
      _id: '3b2f6836-184c-4ee9-8a1d-557cb01837a5',
      name: 'FrodoTestScript3',
      description: 'Check if username has already been collected.',
      script: [
        '/* Check Username',
        ' *',
        ' * Author: volker.scheuber@forgerock.com',
        ' * ',
        ' * Check if username has already been collected.',
        ' * Return "known" if yes, "unknown" otherwise.',
        ' * ',
        ' * This script does not need to be parametrized. It will work properly as is.',
        ' * ',
        ' * The Scripted Decision Node needs the following outcomes defined:',
        ' * - known',
        ' * - unknown',
        ' */',
        '(function () {',
        '    if (null != sharedState.get("username")) {',
        '        outcome = "known";',
        '    }',
        '    else {',
        '        outcome = "unknown";',
        '    }',
        '}());',
      ],
      default: false,
      language: 'JAVASCRIPT',
      context: 'AUTHENTICATION_TREE_DECISION_NODE',
      createdBy: 'null',
      creationDate: 0,
      lastModifiedBy: 'null',
      lastModifiedDate: 0,
    } as ScriptSkeleton,
  };
  const script4 = {
    id: '10643e95-873a-4ec0-b713-a7f56760d179',
    name: 'FrodoTestScript4',
    data: {
      _id: '10643e95-873a-4ec0-b713-a7f56760d179',
      name: 'FrodoTestScript4',
      description: 'Check if username has already been collected.',
      script: [
        '/* Check Username',
        ' *',
        ' * Author: volker.scheuber@forgerock.com',
        ' * ',
        ' * Check if username has already been collected.',
        ' * Return "known" if yes, "unknown" otherwise.',
        ' * ',
        ' * This script does not need to be parametrized. It will work properly as is.',
        ' * ',
        ' * The Scripted Decision Node needs the following outcomes defined:',
        ' * - known',
        ' * - unknown',
        ' */',
        '(function () {',
        '    if (null != sharedState.get("username")) {',
        '        outcome = "known";',
        '    }',
        '    else {',
        '        outcome = "unknown";',
        '    }',
        '}());',
      ],
      default: false,
      language: 'JAVASCRIPT',
      context: 'AUTHENTICATION_TREE_DECISION_NODE',
      createdBy: 'null',
      creationDate: 0,
      lastModifiedBy: 'null',
      lastModifiedDate: 0,
    } as ScriptSkeleton,
  };
  const script5 = {
    id: '5b3e4dd2-8060-4029-9ec1-6867932ab939',
    name: 'FrodoTestScript5',
    data: {
      _id: '5b3e4dd2-8060-4029-9ec1-6867932ab939',
      name: 'FrodoTestScript5',
      description: 'Check if username has already been collected.',
      script: [
        '/* Check Username',
        ' *',
        ' * Author: volker.scheuber@forgerock.com',
        ' * ',
        ' * Check if username has already been collected.',
        ' * Return "known" if yes, "unknown" otherwise.',
        ' * ',
        ' * This script does not need to be parametrized. It will work properly as is.',
        ' * ',
        ' * The Scripted Decision Node needs the following outcomes defined:',
        ' * - known',
        ' * - unknown',
        ' */',
        '(function () {',
        '    if (null != sharedState.get("username")) {',
        '        outcome = "known";',
        '    }',
        '    else {',
        '        outcome = "unknown";',
        '    }',
        '}());',
      ],
      default: false,
      language: 'JAVASCRIPT',
      context: 'AUTHENTICATION_TREE_DECISION_NODE',
      createdBy: 'null',
      creationDate: 0,
      lastModifiedBy: 'null',
      lastModifiedDate: 0,
    } as ScriptSkeleton,
  };
  const import1: { name: string; data: ScriptOps.ScriptExportInterface } = {
    name: 'FrodoTestScript5',
    data: {
      meta: {
        origin: 'https://openam-frodo-dev.forgeblocks.com/am',
        originAmVersion: '7.3.0',
        exportedBy: 'volker.scheuber@forgerock.com',
        exportDate: '2023-01-02T20:04:41.662Z',
        exportTool: 'frodo',
        exportToolVersion: 'v0.17.1 [v18.5.0]',
      },
      script: {
        '5b3e4dd2-8060-4029-9ec1-6867932ab939': {
          _id: '5b3e4dd2-8060-4029-9ec1-6867932ab939',
          name: 'FrodoTestScript5',
          description: 'Check if username has already been collected.',
          script: [
            '/* Check Username',
            ' *',
            ' * Author: volker.scheuber@forgerock.com',
            ' * ',
            ' * Check if username has already been collected.',
            ' * Return "known" if yes, "unknown" otherwise.',
            ' * ',
            ' * This script does not need to be parametrized. It will work properly as is.',
            ' * ',
            ' * The Scripted Decision Node needs the following outcomes defined:',
            ' * - known',
            ' * - unknown',
            ' */',
            '(function () {',
            '    if (null != sharedState.get("username")) {',
            '        outcome = "known";',
            '    }',
            '    else {',
            '        outcome = "unknown";',
            '    }',
            '}());',
          ],
          default: false,
          language: 'JAVASCRIPT',
          context: 'AUTHENTICATION_TREE_DECISION_NODE',
          createdBy: 'null',
          creationDate: 0,
          lastModifiedBy: 'null',
          lastModifiedDate: 0,
        },
      },
    },
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageScript(script1);
      await stageScript(script2);
      await stageScript(script3, false);
      await stageScript(script4);
      await stageScript(script5, false);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageScript(script1, false);
      await stageScript(script2, false);
      await stageScript(script3, false);
      await stageScript(script4, false);
      await stageScript(script5, false);
    }
  });

  describe('createScriptExportTemplate()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.createScriptExportTemplate).toBeDefined();
    });

    test(`1: Create script export template`, async () => {
      const response = ScriptOps.createScriptExportTemplate({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('getScripts()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.getScripts).toBeDefined();
    });

    test(`1: Get scripts`, async () => {
      const response = await ScriptOps.getScripts({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getScript()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.getScript).toBeDefined();
    });

    test(`1: Get script by id '${script1.id}'`, async () => {
      const response = await ScriptOps.getScript({
        scriptId: script1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getScriptByName()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.getScriptByName).toBeDefined();
    });

    test(`1: Get script by name '${script1.name}'`, async () => {
      const response = await ScriptOps.getScriptByName({
        scriptName: script1.name,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('putScript()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.putScript).toBeDefined();
    });

    test(`1: Put script '${script3.id}'`, async () => {
      const response = await ScriptOps.putScript({
        scriptId: script3.id,
        scriptData: script3.data,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('exportScript()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.exportScript).toBeDefined();
    });

    test(`1: Export script by id ${script1.id}`, async () => {
      const response = await ScriptOps.exportScript({
        scriptId: script1.id,
        state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('exportScriptByName()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.exportScriptByName).toBeDefined();
    });

    test(`1: Export script by name ${script1.name}`, async () => {
      const response = await ScriptOps.exportScriptByName({
        scriptName: script1.name,
        state,
      });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('exportScripts()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.exportScripts).toBeDefined();
    });

    test('1: Export all scripts', async () => {
      const response = await ScriptOps.exportScripts({ state });
      expect(response).toMatchSnapshot({
        meta: expect.any(Object),
      });
    });
  });

  describe('importScripts()', () => {
    test('0: Method is implemented', async () => {
      expect(ScriptOps.importScripts).toBeDefined();
    });

    test(`1: Import all scripts`, async () => {
      expect.assertions(1);
      const outcome = await ScriptOps.importScripts({
        scriptName: '',
        importData: import1.data,
        state,
      });
      expect(outcome).toBeTruthy();
    });

    test(`2: Import script by name`, async () => {
      expect.assertions(1);
      const outcome = await ScriptOps.importScripts({
        scriptName: import1.name,
        importData: import1.data,
        state,
      });
      expect(outcome).toBeTruthy();
    });
  });
});
