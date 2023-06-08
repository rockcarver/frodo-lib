/**
 * To record and update snapshots, you must perform 5 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    This step breaks down into 4 phases:
 *
 *    Phase 1: Record Non-destructive tests
 *    Phase 2: Record Group 1 of DESTRUCTIVE tests - Deletes by ID
 *    Phase 3: Record Group 2 of DESTRUCTIVE tests - Deletes by type
 *    Phase 4: Record Group 3 of DESTRUCTIVE tests - Delete all
 *
 *    Because destructive tests interfere with the recording of non-destructive
 *    tests and also interfere among themselves, they have to be run in groups
 *    of non-interfering tests.
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
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

async function stageAgent(agent: { id: string; type: string }, create = true) {
  // delete if exists, then create
  try {
    await AgentApi.getAgentByTypeAndId({
      agentType: agent.type,
      agentId: agent.id,
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
        state,
      });
    }
  }
}

describe('AgentOps', () => {
  const gateway1 = {
    id: 'FrodoOpsTestGatewayAgent1',
    type: 'IdentityGatewayAgent',
  };
  const gateway2 = {
    id: 'FrodoOpsTestGatewayAgent2',
    type: 'IdentityGatewayAgent',
  };
  const gateway3 = {
    id: 'FrodoOpsTestGatewayAgent3',
    type: 'IdentityGatewayAgent',
  };
  const gateway4 = {
    id: 'FrodoOpsTestGatewayAgent4',
    type: 'IdentityGatewayAgent',
  };
  const gateway5 = {
    id: 'FrodoOpsTestGatewayAgent5',
    type: 'IdentityGatewayAgent',
  };
  const gateway6 = {
    id: 'FrodoOpsTestGatewayAgent6',
    type: 'IdentityGatewayAgent',
  };
  const gateway7 = {
    id: 'FrodoOpsTestGatewayAgent7',
    type: 'IdentityGatewayAgent',
  };
  const gateway8 = {
    id: 'FrodoOpsTestGatewayAgent8',
    type: 'IdentityGatewayAgent',
  };
  const gateway9 = {
    id: 'FrodoOpsTestGatewayAgent9',
    type: 'IdentityGatewayAgent',
  };
  const java1 = {
    id: 'FrodoOpsTestJavaAgent1',
    type: 'J2EEAgent',
  };
  const java2 = {
    id: 'FrodoOpsTestJavaAgent2',
    type: 'J2EEAgent',
  };
  const java3 = {
    id: 'FrodoOpsTestJavaAgent3',
    type: 'J2EEAgent',
  };
  const java4 = {
    id: 'FrodoOpsTestJavaAgent4',
    type: 'J2EEAgent',
  };
  const java5 = {
    id: 'FrodoOpsTestJavaAgent5',
    type: 'J2EEAgent',
  };
  const java6 = {
    id: 'FrodoOpsTestJavaAgent6',
    type: 'J2EEAgent',
  };
  const java7 = {
    id: 'FrodoOpsTestJavaAgent7',
    type: 'J2EEAgent',
  };
  const java8 = {
    id: 'FrodoOpsTestJavaAgent8',
    type: 'J2EEAgent',
  };
  const java9 = {
    id: 'FrodoOpsTestJavaAgent9',
    type: 'J2EEAgent',
  };
  const web1 = {
    id: 'FrodoOpsTestWebAgent1',
    type: 'WebAgent',
  };
  const web2 = {
    id: 'FrodoOpsTestWebAgent2',
    type: 'WebAgent',
  };
  const web3 = {
    id: 'FrodoOpsTestWebAgent3',
    type: 'WebAgent',
  };
  const web4 = {
    id: 'FrodoOpsTestWebAgent4',
    type: 'WebAgent',
  };
  const web5 = {
    id: 'FrodoOpsTestWebAgent5',
    type: 'WebAgent',
  };
  const web6 = {
    id: 'FrodoOpsTestWebAgent6',
    type: 'WebAgent',
  };
  const web7 = {
    id: 'FrodoOpsTestWebAgent7',
    type: 'WebAgent',
  };
  const web8 = {
    id: 'FrodoOpsTestWebAgent8',
    type: 'WebAgent',
  };
  const web9 = {
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

      test('1: Get all agent types', async () => {
        const response = AgentOps.createAgentExportTemplate();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getAgents).toBeDefined();
      });

      test('1: Get all agents', async () => {
        const response = await AgentOps.getAgents({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getAgent).toBeDefined();
      });

      test(`1: Get agent '${gateway1.id}' (${gateway1.type})`, async () => {
        const response = await AgentOps.getAgent({
          agentId: gateway1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Get agent '${java1.id}' (${java1.type})`, async () => {
        const response = await AgentOps.getAgent({ agentId: java1.id, state });
        expect(response).toMatchSnapshot();
      });

      test(`3: Get agent '${web1.id}' (${web1.type})`, async () => {
        const response = await AgentOps.getAgent({ agentId: web1.id, state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getAgentByTypeAndId()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getAgentByTypeAndId).toBeDefined();
      });

      test(`1: Get agent by type '${gateway1.id}' (${gateway1.type})`, async () => {
        const response = await AgentOps.getAgentByTypeAndId({
          agentType: gateway1.type,
          agentId: gateway1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Get agent by type '${java1.id}' (${java1.type})`, async () => {
        const response = await AgentOps.getAgentByTypeAndId({
          agentType: java1.type,
          agentId: java1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`3: Get agent by type '${web1.id}' (${web1.type})`, async () => {
        const response = await AgentOps.getAgentByTypeAndId({
          agentType: web1.type,
          agentId: web1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getIdentityGatewayAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getIdentityGatewayAgents).toBeDefined();
      });

      test('1: Get gateway agents', async () => {
        const response = await AgentOps.getIdentityGatewayAgents({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getIdentityGatewayAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getIdentityGatewayAgent).toBeDefined();
      });

      test(`1: Get ${gateway1.type} '${gateway1.id}'`, async () => {
        const response = await AgentOps.getIdentityGatewayAgent({
          gatewayId: gateway1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('putIdentityGatewayAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.putIdentityGatewayAgent).toBeDefined();
      });

      test(`1: Put ${gateway2.type} '${gateway2.id}'`, async () => {
        const response = await AgentOps.putIdentityGatewayAgent({
          gatewayId: gateway2.id,
          gatewayData: getAgent(gateway2.type, gateway2.id),
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getJavaAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getJavaAgents).toBeDefined();
      });

      test('1: Get java agents', async () => {
        const response = await AgentOps.getJavaAgents({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getJavaAgent).toBeDefined();
      });

      test(`1: Get ${java1.type} '${java1.id}'`, async () => {
        const response = await AgentOps.getJavaAgent({
          agentId: java1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('putJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.putJavaAgent).toBeDefined();
      });

      test(`1: Put ${java2.type} '${java2.id}'`, async () => {
        const response = await AgentOps.putJavaAgent({
          agentId: java2.id,
          agentData: getAgent(java2.type, java2.id),
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getWebAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getWebAgents).toBeDefined();
      });

      test('1: Get web agents', async () => {
        const response = await AgentOps.getWebAgents({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('getWebAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.getWebAgent).toBeDefined();
      });

      test(`1: Get ${web1.type} '${web1.id}'`, async () => {
        const response = await AgentOps.getWebAgent({
          agentId: web1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });
    });

    describe('putWebAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.putWebAgent).toBeDefined();
      });

      test(`1: Put ${web2.type} '${web2.id}'`, async () => {
        const response = await AgentOps.putWebAgent({
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
        const response = await AgentOps.exportAgents({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportIdentityGatewayAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.exportIdentityGatewayAgents).toBeDefined();
      });

      test('1: Export gateway agents', async () => {
        const response = await AgentOps.exportIdentityGatewayAgents({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportJavaAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.exportJavaAgents).toBeDefined();
      });

      test('1: Export java agents', async () => {
        const response = await AgentOps.exportJavaAgents({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportWebAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.exportJavaAgents).toBeDefined();
      });

      test('1: Export web agents', async () => {
        const response = await AgentOps.exportWebAgents({ state });
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.exportAgent).toBeDefined();
      });

      test(`1: Export agent '${gateway1.id}' (${gateway1.type})`, async () => {
        const response = await AgentOps.exportAgent({
          agentId: gateway1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`2: Export agent '${java1.id}' (${java1.type})`, async () => {
        const response = await AgentOps.exportAgent({
          agentId: java1.id,
          state,
        });
        expect(response).toMatchSnapshot();
      });

      test(`3: Export agent '${web1.id}' (${web1.type})`, async () => {
        const response = await AgentOps.exportAgent({
          agentId: web1.id,
          state,
        });
        expect(response).toMatchSnapshot();
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
        expect(response).toMatchSnapshot();
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
        expect(response).toMatchSnapshot();
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
        expect(response).toMatchSnapshot();
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
        const exportData = AgentOps.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        await AgentOps.importAgents({ importData: exportData, state });
        expect(true).toBeTruthy();
      });
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
        const exportData = AgentOps.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
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
        const exportData = AgentOps.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(1);
        try {
          await AgentOps.importIdentityGatewayAgents({
            importData: exportData,
            state,
          });
        } catch (error) {
          expect(error).toMatchSnapshot();
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
        const exportData = AgentOps.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        await AgentOps.importJavaAgents({ importData: exportData, state });
        expect(true).toBeTruthy();
      });

      test('2: Import java agents with wrong type', async () => {
        const agents = {
          [web4.id]: web4.type,
          [gateway4.id]: gateway4.type,
        };
        const exportData = AgentOps.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(1);
        try {
          await AgentOps.importJavaAgents({ importData: exportData, state });
        } catch (error) {
          expect(error).toMatchSnapshot();
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
        const exportData = AgentOps.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        await AgentOps.importWebAgents({ importData: exportData, state });
        expect(true).toBeTruthy();
      });

      test('2: Import web agents with wrong type', async () => {
        const agents = {
          [gateway4.id]: gateway4.type,
          [java4.id]: java4.type,
        };
        const exportData = AgentOps.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(1);
        try {
          await AgentOps.importWebAgents({ importData: exportData, state });
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('importAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.importAgent).toBeDefined();
      });

      test('1: Import gateway agent', async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[gateway6.id] = getAgent(gateway6.type, gateway6.id);
        await AgentOps.importAgent({
          agentId: gateway6.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import java agent', async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[java6.id] = getAgent(java6.type, java6.id);
        await AgentOps.importAgent({
          agentId: java6.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('3: Import web agent', async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[web6.id] = getAgent(web6.type, web6.id);
        await AgentOps.importAgent({
          agentId: web6.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });
    });

    describe('importIdentityGatewayAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.importIdentityGatewayAgent).toBeDefined();
      });

      test(`1: Import ${gateway7.type} '${gateway7.id}'`, async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[gateway7.id] = getAgent(gateway7.type, gateway7.id);
        await AgentOps.importIdentityGatewayAgent({
          agentId: gateway7.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import gateway agent with wrong type', async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[java7.id] = getAgent(java7.type, java7.id);
        expect.assertions(1);
        try {
          await AgentOps.importIdentityGatewayAgent({
            agentId: java7.id,
            importData: exportData,
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('importJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.importJavaAgents).toBeDefined();
      });

      test(`1: Import ${java7.type} '${java7.id}'`, async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[java7.id] = getAgent(java7.type, java7.id);
        await AgentOps.importJavaAgent({
          agentId: java7.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import java agent with wrong type', async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[web7.id] = getAgent(web7.type, web7.id);
        expect.assertions(1);
        try {
          await AgentOps.importJavaAgent({
            agentId: web7.id,
            importData: exportData,
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('importWebAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.importWebAgent).toBeDefined();
      });

      test(`1: Import ${web7.type} '${web7.id}'`, async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[web7.id] = getAgent(web7.type, web7.id);
        await AgentOps.importWebAgent({
          agentId: web7.id,
          importData: exportData,
          state,
        });
        expect(true).toBeTruthy();
      });

      test('2: Import web agent with wrong type', async () => {
        const exportData = AgentOps.createAgentExportTemplate();
        exportData.agents[gateway7.id] = getAgent(gateway7.type, gateway7.id);
        expect.assertions(1);
        try {
          await AgentOps.importWebAgent({
            agentId: gateway7.id,
            importData: exportData,
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
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
        await AgentOps.deleteAgent({ agentId: gateway8.id, state });
        expect(true).toBeTruthy();
      });

      test(`2: Delete agent '${java8.id}' (${java8.type})`, async () => {
        await AgentOps.deleteAgent({ agentId: java8.id, state });
        expect(true).toBeTruthy();
      });

      test(`3: Delete agent '${web8.id}' (${web8.type})`, async () => {
        await AgentOps.deleteAgent({ agentId: web8.id, state });
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
        expect.assertions(1);
        try {
          await AgentOps.deleteIdentityGatewayAgent({
            agentId: java9.id,
            state,
          });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('deleteJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(AgentOps.deleteJavaAgent).toBeDefined();
      });

      test(`1: Delete ${java9.type} '${java9.id}'`, async () => {
        await AgentOps.deleteJavaAgent({ agentId: java9.id, state });
        expect(true).toBeTruthy();
      });

      test(`2: Delete agent of wrong type '${web9.id}' (${web9.type})`, async () => {
        expect.assertions(1);
        try {
          await AgentOps.deleteJavaAgent({ agentId: web9.id, state });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('deleteWebAgent()', () => {
      test('deleteWebAgent() 0: Method is implemented', async () => {
        expect(AgentOps.deleteWebAgent).toBeDefined();
      });

      test(`1: Delete ${web9.type} '${web9.id}'`, async () => {
        await AgentOps.deleteWebAgent({ agentId: web9.id, state });
        expect(true).toBeTruthy();
      });

      test(`2: Delete agent of wrong type '${gateway9.id}' (${gateway9.type})`, async () => {
        expect.assertions(1);
        try {
          await AgentOps.deleteWebAgent({ agentId: gateway9.id, state });
        } catch (error) {
          expect(error.message).toMatchSnapshot();
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
