/**
 * To record and update snapshots, you must perform 5 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into 5 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *    Phase 2: Record Group 1 of DESTRUCTIVE tests - Deletes by ID
 *    Phase 3: Record Group 2 of DESTRUCTIVE tests - Deletes by type
 *    Phase 4: Record Group 3 of DESTRUCTIVE tests - Delete all
 *    Phase 5: Record tests that require classic deployment
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
 *
 *    Make sure to set the FRODO_HOST and FRODO_REALM environment variables when
 *    recording to ensure you are using the right deployment for phase 5 (by default these are
 *    set to the frodo-dev cloud tenant and alpha realm respectively). Alternatively,
 *    you can use FRODO_DEPLOY=classic to use the default settings of host/realm for classic deployments.
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from and also indicate the phase:
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=1 FRODO_HOST=frodo-dev npm run test:record AgentOps
 *
 *    THESE TESTS ARE DESTRUCTIVE!!! DO NOT RUN AGAINST AN ENV WITH ACTIVE AGENTS!!!
 *
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=2 FRODO_HOST=frodo-dev npm run test:record AgentOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=3 FRODO_HOST=frodo-dev npm run test:record AgentOps
 *        FRODO_DEBUG=1 FRODO_RECORD_PHASE=4 FRODO_HOST=frodo-dev npm run test:record AgentOps
 *
 *    The above command assumes that you have a connection profile for
 *    'frodo-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update AgentOps
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only AgentOps
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import { state } from '../index';
import * as AgentApi from '../api/AgentApi';
import * as AgentOps from './AgentOps';
import { getAgent } from '../test/mocks/ForgeRockApiMockEngine';
import { autoSetupPolly, setDefaultState } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';
import { FrodoError } from './FrodoError';
import Constants from "../shared/Constants";

const ctx = autoSetupPolly();

async function stageAgent(
  agent: { id: string; type: AgentApi.AgentType },
  create = true
) {
  // delete if exists, then create
  try {
    await AgentApi.getAgentByTypeAndId({
      agentType: agent.type,
      agentId: agent.id,
      globalConfig: false,
      state,
    });
    await AgentApi.deleteAgentByTypeAndId({
      agentType: agent.type,
      agentId: agent.id,
      state,
    });
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await AgentApi.putAgentByTypeAndId({
        agentType: agent.type,
        agentId: agent.id,
        agentData: getAgent(agent.type, agent.id),
        globalConfig: false,
        state,
      });
    }
  }
}

type agentStub = {
  id: string;
  type: AgentApi.AgentType;
};
describe('AgentOps', () => {
  const gateway1: agentStub = {
    id: 'FrodoOpsTestGatewayAgent1',
    type: 'IdentityGatewayAgent',
  };
  const gateway2: agentStub = {
    id: 'FrodoOpsTestGatewayAgent2',
    type: 'IdentityGatewayAgent',
  };
  const gateway3: agentStub = {
    id: 'FrodoOpsTestGatewayAgent3',
    type: 'IdentityGatewayAgent',
  };
  const gateway4: agentStub = {
    id: 'FrodoOpsTestGatewayAgent4',
    type: 'IdentityGatewayAgent',
  };
  const gateway5: agentStub = {
    id: 'FrodoOpsTestGatewayAgent5',
    type: 'IdentityGatewayAgent',
  };
  const gateway6: agentStub = {
    id: 'FrodoOpsTestGatewayAgent6',
    type: 'IdentityGatewayAgent',
  };
  const gateway7: agentStub = {
    id: 'FrodoOpsTestGatewayAgent7',
    type: 'IdentityGatewayAgent',
  };
  const gateway8: agentStub = {
    id: 'FrodoOpsTestGatewayAgent8',
    type: 'IdentityGatewayAgent',
  };
  const gateway9: agentStub = {
    id: 'FrodoOpsTestGatewayAgent9',
    type: 'IdentityGatewayAgent',
  };
  const java1: agentStub = {
    id: 'FrodoOpsTestJavaAgent1',
    type: 'J2EEAgent',
  };
  const java2: agentStub = {
    id: 'FrodoOpsTestJavaAgent2',
    type: 'J2EEAgent',
  };
  const java3: agentStub = {
    id: 'FrodoOpsTestJavaAgent3',
    type: 'J2EEAgent',
  };
  const java4: agentStub = {
    id: 'FrodoOpsTestJavaAgent4',
    type: 'J2EEAgent',
  };
  const java5: agentStub = {
    id: 'FrodoOpsTestJavaAgent5',
    type: 'J2EEAgent',
  };
  const java6: agentStub = {
    id: 'FrodoOpsTestJavaAgent6',
    type: 'J2EEAgent',
  };
  const java7: agentStub = {
    id: 'FrodoOpsTestJavaAgent7',
    type: 'J2EEAgent',
  };
  const java8: agentStub = {
    id: 'FrodoOpsTestJavaAgent8',
    type: 'J2EEAgent',
  };
  const java9: agentStub = {
    id: 'FrodoOpsTestJavaAgent9',
    type: 'J2EEAgent',
  };
  const web1: agentStub = {
    id: 'FrodoOpsTestWebAgent1',
    type: 'WebAgent',
  };
  const web2: agentStub = {
    id: 'FrodoOpsTestWebAgent2',
    type: 'WebAgent',
  };
  const web3: agentStub = {
    id: 'FrodoOpsTestWebAgent3',
    type: 'WebAgent',
  };
  const web4: agentStub = {
    id: 'FrodoOpsTestWebAgent4',
    type: 'WebAgent',
  };
  const web5: agentStub = {
    id: 'FrodoOpsTestWebAgent5',
    type: 'WebAgent',
  };
  const web6: agentStub = {
    id: 'FrodoOpsTestWebAgent6',
    type: 'WebAgent',
  };
  const web7: agentStub = {
    id: 'FrodoOpsTestWebAgent7',
    type: 'WebAgent',
  };
  const web8: agentStub = {
    id: 'FrodoOpsTestWebAgent8',
    type: 'WebAgent',
  };
  const web9: agentStub = {
    id: 'FrodoOpsTestWebAgent9',
    type: 'WebAgent',
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageAgent(gateway1);
      await stageAgent(gateway2, false);
      await stageAgent(gateway3, false);
      await stageAgent(gateway4, false);
      await stageAgent(gateway5, false);
      await stageAgent(gateway6, false);
      await stageAgent(gateway7);
      await stageAgent(gateway8);
      await stageAgent(gateway9);

      await stageAgent(java1);
      await stageAgent(java2, false);
      await stageAgent(java3, false);
      await stageAgent(java4, false);
      await stageAgent(java5, false);
      await stageAgent(java6, false);
      await stageAgent(java7);
      await stageAgent(java8);
      await stageAgent(java9);

      await stageAgent(web1);
      await stageAgent(web2, false);
      await stageAgent(web3, false);
      await stageAgent(web4, false);
      await stageAgent(web5, false);
      await stageAgent(web6, false);
      await stageAgent(web7);
      await stageAgent(web8);
      await stageAgent(web9);
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      await stageAgent(gateway1, false);
      await stageAgent(gateway2, false);
      await stageAgent(gateway3, false);
      await stageAgent(gateway4, false);
      await stageAgent(gateway5, false);
      await stageAgent(gateway6, false);
      await stageAgent(gateway7, false);
      await stageAgent(gateway8, false);
      await stageAgent(gateway9, false);

      await stageAgent(java1, false);
      await stageAgent(java2, false);
      await stageAgent(java3, false);
      await stageAgent(java4, false);
      await stageAgent(java5, false);
      await stageAgent(java6, false);
      await stageAgent(java7, false);
      await stageAgent(java8, false);
      await stageAgent(java9, false);

      await stageAgent(web1, false);
      await stageAgent(web2, false);
      await stageAgent(web3, false);
      await stageAgent(web4, false);
      await stageAgent(web5, false);
      await stageAgent(web6, false);
      await stageAgent(web7, false);
      await stageAgent(web8, false);
      await stageAgent(web9, false);
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });
  describe('Cloud Tests', () => {
    beforeEach(() => {
      setDefaultState()
    });
    // Phase 1
    if (
      !process.env.FRODO_POLLY_MODE ||
      (process.env.FRODO_POLLY_MODE === 'record' &&
        process.env.FRODO_RECORD_PHASE === '1')
    ) {
      describe('createAgentExportTemplate()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.createAgentExportTemplate).toBeDefined();
        });

      test('1: Create Agent Export Template', async () => {
        const response = AgentOps.createAgentExportTemplate({ state });
        expect(response).toMatchSnapshot({
          meta: expect.any(Object),
        });
      });
    });

      describe('readAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readAgents).toBeDefined();
        });

        test('1: Read all agents', async () => {
          const response = await AgentOps.readAgents({state, globalConfig: false,});
          expect(response).toMatchSnapshot();
        });
      });

      describe('readAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readAgent).toBeDefined();
        });

        test(`1: Read agent '${gateway1.id}' (${gateway1.type})`, async () => {
          const response = await AgentOps.readAgent({
            agentId: gateway1.id,
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test(`2: Read agent '${java1.id}' (${java1.type})`, async () => {
          const response = await AgentOps.readAgent({agentId: java1.id, globalConfig: false, state});
          expect(response).toMatchSnapshot();
        });

        test(`3: Read agent '${web1.id}' (${web1.type})`, async () => {
          const response = await AgentOps.readAgent({agentId: web1.id, globalConfig: false, state});
          expect(response).toMatchSnapshot();
        });
      });

      describe('createAgentGroupExportTemplate()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.createAgentGroupExportTemplate).toBeDefined();
        });

        test('1: Create Agent Group Export Template', async () => {
          const response = AgentOps.createAgentGroupExportTemplate({ state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('readAgentGroup()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readAgentGroup).toBeDefined();
        });
        //TODO: create tests
      });

      describe('readAgentGroups()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readAgentGroups).toBeDefined();
        });

        test('1: Read Agent Groups', async () => {
          const response = await AgentOps.readAgentGroups({ state });
          expect(response).toMatchSnapshot();
        });
      });

      describe('exportAgentGroup()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportAgentGroup).toBeDefined();
        });
        //TODO: create tests
      });

      describe('exportAgentGroups()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportAgentGroups).toBeDefined();
        });

        test('1: Export Agent Groups', async () => {
          const response = await AgentOps.exportAgentGroups({ state });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('readAgentByTypeAndId()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readAgentByTypeAndId).toBeDefined();
        });

        test(`1: Read agent by type '${gateway1.id}' (${gateway1.type})`, async () => {
          const response = await AgentOps.readAgentByTypeAndId({
            agentType: gateway1.type,
            agentId: gateway1.id,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test(`2: Read agent by type '${java1.id}' (${java1.type})`, async () => {
          const response = await AgentOps.readAgentByTypeAndId({
            agentType: java1.type,
            agentId: java1.id,
            state,
          });
          expect(response).toMatchSnapshot();
        });

        test(`3: Read agent by type '${web1.id}' (${web1.type})`, async () => {
          const response = await AgentOps.readAgentByTypeAndId({
            agentType: web1.type,
            agentId: web1.id,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readIdentityGatewayAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readIdentityGatewayAgents).toBeDefined();
        });

        test('1: Read gateway agents', async () => {
          const response = await AgentOps.readIdentityGatewayAgents({state});
          expect(response).toMatchSnapshot();
        });
      });

      describe('readIdentityGatewayAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readIdentityGatewayAgent).toBeDefined();
        });

        test(`1: Read ${gateway1.type} '${gateway1.id}'`, async () => {
          const response = await AgentOps.readIdentityGatewayAgent({
            gatewayId: gateway1.id,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('updateIdentityGatewayAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.updateIdentityGatewayAgent).toBeDefined();
        });

        test(`1: Update ${gateway2.type} '${gateway2.id}'`, async () => {
          const response = await AgentOps.updateIdentityGatewayAgent({
            gatewayId: gateway2.id,
            gatewayData: getAgent(gateway2.type, gateway2.id),
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readJavaAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readJavaAgents).toBeDefined();
        });

        test('1: Read java agents', async () => {
          const response = await AgentOps.readJavaAgents({state});
          expect(response).toMatchSnapshot();
        });
      });

      describe('readJavaAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readJavaAgent).toBeDefined();
        });

        test(`1: Read ${java1.type} '${java1.id}'`, async () => {
          const response = await AgentOps.readJavaAgent({
            agentId: java1.id,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('uodateJavaAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.updateJavaAgent).toBeDefined();
        });

        test(`1: Update ${java2.type} '${java2.id}'`, async () => {
          const response = await AgentOps.updateJavaAgent({
            agentId: java2.id,
            agentData: getAgent(java2.type, java2.id),
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('readWebAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readWebAgents).toBeDefined();
        });

        test('1: Read web agents', async () => {
          const response = await AgentOps.readWebAgents({state});
          expect(response).toMatchSnapshot();
        });
      });

      describe('readWebAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.readWebAgent).toBeDefined();
        });

        test(`1: Read ${web1.type} '${web1.id}'`, async () => {
          const response = await AgentOps.readWebAgent({
            agentId: web1.id,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('updateWebAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.updateWebAgent).toBeDefined();
        });

        test(`1: Update ${web2.type} '${web2.id}'`, async () => {
          const response = await AgentOps.updateWebAgent({
            agentId: web2.id,
            agentData: getAgent(web2.type, web2.id),
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('exportAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportAgents).toBeDefined();
        });

        test('1: Export all agents', async () => {
          const response = await AgentOps.exportAgents({state, globalConfig: false});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportIdentityGatewayAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportIdentityGatewayAgents).toBeDefined();
        });

        test('1: Export gateway agents', async () => {
          const response = await AgentOps.exportIdentityGatewayAgents({state});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportJavaAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportJavaAgents).toBeDefined();
        });

        test('1: Export java agents', async () => {
          const response = await AgentOps.exportJavaAgents({state});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportWebAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportJavaAgents).toBeDefined();
        });

        test('1: Export web agents', async () => {
          const response = await AgentOps.exportWebAgents({state});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportAgent).toBeDefined();
        });

        test(`1: Export agent '${gateway1.id}' (${gateway1.type})`, async () => {
          const response = await AgentOps.exportAgent({
            agentId: gateway1.id,
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test(`2: Export agent '${java1.id}' (${java1.type})`, async () => {
          const response = await AgentOps.exportAgent({
            agentId: java1.id,
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });

        test(`3: Export agent '${web1.id}' (${web1.type})`, async () => {
          const response = await AgentOps.exportAgent({
            agentId: web1.id,
            globalConfig: false,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportIdentityGatewayAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportIdentityGatewayAgent).toBeDefined();
        });

        test(`1: Export ${gateway1.type} '${gateway1.id}'`, async () => {
          const response = await AgentOps.exportIdentityGatewayAgent({
            agentId: gateway1.id,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportJavaAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportJavaAgent).toBeDefined();
        });

        test(`1: Export ${java1.type} '${java1.id}'`, async () => {
          const response = await AgentOps.exportJavaAgent({
            agentId: java1.id,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportWebAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.exportWebAgent).toBeDefined();
        });

        test(`1: Export ${web1.type} '${web1.id}'`, async () => {
          const response = await AgentOps.exportWebAgent({
            agentId: web1.id,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('importAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importAgents).toBeDefined();
        });

      test('1: Import all agents', async () => {
        const agents = {
          [gateway3.id]: gateway3.type,
          [java3.id]: java3.type,
          [web3.id]: web3.type,
        };
        const exportData = AgentOps.createAgentExportTemplate({ state });
        for (const agentId of Object.keys(agents)) {
          exportData.agent[agentId] = getAgent(agents[agentId], agentId);
        }
        await AgentOps.importAgents({ importData: exportData, globalConfig: false, state });
        expect(true).toBeTruthy();
      });
    });

      describe('importAgentGroups()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importAgentGroups).toBeDefined();
        });
        // TODO: Write tests
      });

      describe('importIdentityGatewayAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importIdentityGatewayAgents).toBeDefined();
        });

      test('1: Import all gateway agents', async () => {
        const agents = {
          [gateway4.id]: gateway4.type,
          [gateway5.id]: gateway5.type,
        };
        const exportData = AgentOps.createAgentExportTemplate({ state });
        for (const agentId of Object.keys(agents)) {
          exportData.agent[agentId] = getAgent(agents[agentId], agentId);
        }
        await AgentOps.importIdentityGatewayAgents({
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import gateway agents with wrong type', async () => {
        const agents = {
          [java4.id]: java4.type,
          [web4.id]: web4.type,
        };
        const exportData = AgentOps.createAgentExportTemplate({ state });
        for (const agentId of Object.keys(agents)) {
          exportData.agent[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(2);
        try {
          await AgentOps.importIdentityGatewayAgents({
            importData: exportData,
            state,
          });
        } catch (error) {
          expect(error.name).toEqual('FrodoError');
          expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
        }
      });
    });

      describe('importJavaAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importJavaAgents).toBeDefined();
        });

      test('1: Import all java agents', async () => {
        const agents = {
          [java4.id]: java4.type,
          [java5.id]: java5.type,
        };
        const exportData = AgentOps.createAgentExportTemplate({ state });
        for (const agentId of Object.keys(agents)) {
          exportData.agent[agentId] = getAgent(agents[agentId], agentId);
        }
        await AgentOps.importJavaAgents({ importData: exportData, state });
        expect(true).toBeTruthy();
      });

      test('2: Import java agents with wrong type', async () => {
        const agents = {
          [web4.id]: web4.type,
          [gateway4.id]: gateway4.type,
        };
        const exportData = AgentOps.createAgentExportTemplate({ state });
        for (const agentId of Object.keys(agents)) {
          exportData.agent[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(2);
        try {
          await AgentOps.importJavaAgents({ importData: exportData, state });
        } catch (error) {
          expect(error.name).toEqual('FrodoError');
          expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
        }
      });
    });

      describe('importWebAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importWebAgents).toBeDefined();
        });

      test('1: Import all web agents', async () => {
        const agents = {
          [web4.id]: web4.type,
          [web5.id]: web5.type,
        };
        const exportData = AgentOps.createAgentExportTemplate({ state });
        for (const agentId of Object.keys(agents)) {
          exportData.agent[agentId] = getAgent(agents[agentId], agentId);
        }
        await AgentOps.importWebAgents({ importData: exportData, state });
        expect(true).toBeTruthy();
      });

      test('2: Import web agents with wrong type', async () => {
        const agents = {
          [gateway4.id]: gateway4.type,
          [java4.id]: java4.type,
        };
        const exportData = AgentOps.createAgentExportTemplate({ state });
        for (const agentId of Object.keys(agents)) {
          exportData.agent[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(2);
        try {
          await AgentOps.importWebAgents({ importData: exportData, state });
        } catch (error) {
          expect(error.name).toEqual('FrodoError');
          expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
        }
      });
    });

      describe('importAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importAgent).toBeDefined();
        });

      test('1: Import gateway agent', async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[gateway6.id] = getAgent(gateway6.type, gateway6.id);
        await AgentOps.importAgent({
          agentId: gateway6.id,
          importData: exportData,
          globalConfig: false,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import java agent', async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[java6.id] = getAgent(java6.type, java6.id);
        await AgentOps.importAgent({
          agentId: java6.id,
          importData: exportData,
          globalConfig: false,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('3: Import web agent', async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[web6.id] = getAgent(web6.type, web6.id);
        await AgentOps.importAgent({
          agentId: web6.id,
          importData: exportData,
          globalConfig: false,
          state,
        });
        expect(true).toBeTruthy();
      });
    });

      describe('importAgentGroup()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importAgentGroup).toBeDefined();
        });
        // TODO: Write tests
      });

      describe('importIdentityGatewayAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importIdentityGatewayAgent).toBeDefined();
        });

      test(`1: Import ${gateway7.type} '${gateway7.id}'`, async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[gateway7.id] = getAgent(gateway7.type, gateway7.id);
        await AgentOps.importIdentityGatewayAgent({
          agentId: gateway7.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import gateway agent with wrong type', async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[java7.id] = getAgent(java7.type, java7.id);
        expect.assertions(2);
        try {
          await AgentOps.importIdentityGatewayAgent({
            agentId: java7.id,
            importData: exportData,
            state,
          });
        } catch (error) {
          expect(error.name).toEqual('FrodoError');
          expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
        }
      });
    });

      describe('importJavaAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importJavaAgents).toBeDefined();
        });

      test(`1: Import ${java7.type} '${java7.id}'`, async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[java7.id] = getAgent(java7.type, java7.id);
        await AgentOps.importJavaAgent({
          agentId: java7.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import java agent with wrong type', async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[web7.id] = getAgent(web7.type, web7.id);
        expect.assertions(2);
        try {
          await AgentOps.importJavaAgent({
            agentId: web7.id,
            importData: exportData,
            state,
          });
        } catch (error) {
          expect(error.name).toEqual('FrodoError');
          expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
        }
      });
    });

      describe('importWebAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.importWebAgent).toBeDefined();
        });

      test(`1: Import ${web7.type} '${web7.id}'`, async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[web7.id] = getAgent(web7.type, web7.id);
        await AgentOps.importWebAgent({
          agentId: web7.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import web agent with wrong type', async () => {
        const exportData = AgentOps.createAgentExportTemplate({ state });
        exportData.agent[gateway7.id] = getAgent(gateway7.type, gateway7.id);
        expect.assertions(2);
        try {
          await AgentOps.importWebAgent({
            agentId: gateway7.id,
            importData: exportData,
            state,
          });
        } catch (error) {
          expect(error.name).toEqual('FrodoError');
          expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
        }
      });
    });
  }

    // Phase 2
    if (
      !process.env.FRODO_POLLY_MODE ||
      (process.env.FRODO_POLLY_MODE === 'record' &&
        process.env.FRODO_RECORD_PHASE === '2')
    ) {
      describe('deleteAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.deleteAgent).toBeDefined();
        });

        test(`1: Delete agent '${gateway8.id}' (${gateway8.type})`, async () => {
          await AgentOps.deleteAgent({agentId: gateway8.id, state});
          expect(true).toBeTruthy();
        });

        test(`2: Delete agent '${java8.id}' (${java8.type})`, async () => {
          await AgentOps.deleteAgent({agentId: java8.id, state});
          expect(true).toBeTruthy();
        });

        test(`3: Delete agent '${web8.id}' (${web8.type})`, async () => {
          await AgentOps.deleteAgent({agentId: web8.id, state});
          expect(true).toBeTruthy();
        });
      });

      describe('deleteIdentityGatewayAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.deleteIdentityGatewayAgent).toBeDefined();
        });

        test(`1: Delete ${gateway9.type} '${gateway9.id}'`, async () => {
          await AgentOps.deleteIdentityGatewayAgent({
            agentId: gateway9.id,
            state,
          });
          expect(true).toBeTruthy();
        });

        test(`2: Delete agent of wrong type '${java9.id}' (${java9.type})`, async () => {
          expect.assertions(2);
          try {
            await AgentOps.deleteIdentityGatewayAgent({
              agentId: java9.id,
              state,
            });
          } catch (error) {
            expect(error.name).toEqual('FrodoError');
            expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
          }
        });
      });

      describe('deleteJavaAgent()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.deleteJavaAgent).toBeDefined();
        });

        test(`1: Delete ${java9.type} '${java9.id}'`, async () => {
          await AgentOps.deleteJavaAgent({agentId: java9.id, state});
          expect(true).toBeTruthy();
        });

        test(`2: Delete agent of wrong type '${web9.id}' (${web9.type})`, async () => {
          expect.assertions(2);
          try {
            await AgentOps.deleteJavaAgent({agentId: web9.id, state});
          } catch (error) {
            expect(error.name).toEqual('FrodoError');
            expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
          }
        });
      });

      describe('deleteWebAgent()', () => {
        test('deleteWebAgent() 0: Method is implemented', async () => {
          expect(AgentOps.deleteWebAgent).toBeDefined();
        });

        test(`1: Delete ${web9.type} '${web9.id}'`, async () => {
          await AgentOps.deleteWebAgent({agentId: web9.id, state});
          expect(true).toBeTruthy();
        });

        test(`2: Delete agent of wrong type '${gateway9.id}' (${gateway9.type})`, async () => {
          expect.assertions(2);
          try {
            await AgentOps.deleteWebAgent({agentId: gateway9.id, state});
          } catch (error) {
            expect(error.name).toEqual('FrodoError');
            expect((error as FrodoError).getCombinedMessage()).toMatchSnapshot();
          }
        });
      });
    }

    // Phase 3
    if (
      !process.env.FRODO_POLLY_MODE ||
      (process.env.FRODO_POLLY_MODE === 'record' &&
        process.env.FRODO_RECORD_PHASE === '3')
    ) {
      describe('deleteIdentityGatewayAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.deleteIdentityGatewayAgents).toBeDefined();
        });

        test('1: Delete all gateway agents', async () => {
          await AgentOps.deleteIdentityGatewayAgents({ state });
          expect(true).toBeTruthy();
        });
      });

      describe('deleteJavaAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.deleteJavaAgents).toBeDefined();
        });

        test('1: Delete all java agents', async () => {
          await AgentOps.deleteJavaAgents({ state });
          expect(true).toBeTruthy();
        });
      });

      describe('deleteWebAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.deleteWebAgents).toBeDefined();
        });

        test('1: Delete all web agents', async () => {
          await AgentOps.deleteWebAgents({ state });
          expect(true).toBeTruthy();
        });
      });
    }

    // Phase 4
    if (
      !process.env.FRODO_POLLY_MODE ||
      (process.env.FRODO_POLLY_MODE === 'record' &&
        process.env.FRODO_RECORD_PHASE === '4')
    ) {
      describe('deleteAgents()', () => {
        test('0: Method is implemented', async () => {
          expect(AgentOps.deleteAgents).toBeDefined();
        });

        test('1: Delete all agents', async () => {
          expect.assertions(1);
          await AgentOps.deleteAgents({ state });
          expect(true).toBeTruthy();
        });
      });
    }
  });
  // Phase 5
  if (
    !process.env.FRODO_POLLY_MODE ||
    (process.env.FRODO_POLLY_MODE === 'record' &&
      process.env.FRODO_RECORD_PHASE === '5')
  ) {
    describe('Classic Tests', () => {
      beforeEach(() => {
        setDefaultState(Constants.CLASSIC_DEPLOYMENT_TYPE_KEY)
      });
      describe('readAgents()', () => {
        test('2: Read all agents', async () => {
          const response = await AgentOps.readAgents({state, globalConfig: true,});
          expect(response).toMatchSnapshot();
        });
      });

      describe('readAgent()', () => {
        test(`4: Read agent 'AgentService'`, async () => {
          const response = await AgentOps.readAgent({
            agentId: 'AgentService',
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot();
        });
      });

      describe('exportAgents()', () => {
        test('2: Export all agents', async () => {
          const response = await AgentOps.exportAgents({state, globalConfig: true});
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });

      describe('exportAgent()', () => {

        test(`4: Export agent 'AgentService'`, async () => {
          const response = await AgentOps.exportAgent({
            agentId: 'AgentService',
            globalConfig: true,
            state,
          });
          expect(response).toMatchSnapshot({
            meta: expect.any(Object),
          });
        });
      });
    });
  }
});
