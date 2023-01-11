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
import { Agent, AgentRaw } from '../index';
import { getAgent } from '../test/mocks/ForgeRockApiMockEngine';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

autoSetupPolly();

async function stageAgent(agent: { id: string; type: string }, create = true) {
  // delete if exists, then create
  try {
    await AgentRaw.getAgentByTypeAndId(agent.type, agent.id);
    await AgentRaw.deleteAgentByTypeAndId(agent.type, agent.id);
  } catch (error) {
    // ignore
  } finally {
    if (create) {
      await AgentRaw.putAgentByTypeAndId(
        agent.type,
        agent.id,
        getAgent(agent.type, agent.id)
      );
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
        expect(Agent.createAgentExportTemplate).toBeDefined();
      });

      test('1: Get all agent types', async () => {
        const response = Agent.createAgentExportTemplate();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getAgents).toBeDefined();
      });

      test('1: Get all agents', async () => {
        const response = await Agent.getAgents();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getAgent).toBeDefined();
      });

      test(`1: Get agent '${gateway1.id}' (${gateway1.type})`, async () => {
        const response = await Agent.getAgent(gateway1.id);
        expect(response).toMatchSnapshot();
      });

      test(`2: Get agent '${java1.id}' (${java1.type})`, async () => {
        const response = await Agent.getAgent(java1.id);
        expect(response).toMatchSnapshot();
      });

      test(`3: Get agent '${web1.id}' (${web1.type})`, async () => {
        const response = await Agent.getAgent(web1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('getAgentByTypeAndId()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getAgentByTypeAndId).toBeDefined();
      });

      test(`1: Get agent by type '${gateway1.id}' (${gateway1.type})`, async () => {
        const response = await Agent.getAgentByTypeAndId(
          gateway1.type,
          gateway1.id
        );
        expect(response).toMatchSnapshot();
      });

      test(`2: Get agent by type '${java1.id}' (${java1.type})`, async () => {
        const response = await Agent.getAgentByTypeAndId(java1.type, java1.id);
        expect(response).toMatchSnapshot();
      });

      test(`3: Get agent by type '${web1.id}' (${web1.type})`, async () => {
        const response = await Agent.getAgentByTypeAndId(web1.type, web1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('getIdentityGatewayAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getIdentityGatewayAgents).toBeDefined();
      });

      test('1: Get gateway agents', async () => {
        const response = await Agent.getIdentityGatewayAgents();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getIdentityGatewayAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getIdentityGatewayAgent).toBeDefined();
      });

      test(`1: Get ${gateway1.type} '${gateway1.id}'`, async () => {
        const response = await Agent.getIdentityGatewayAgent(gateway1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('putIdentityGatewayAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.putIdentityGatewayAgent).toBeDefined();
      });

      test(`1: Put ${gateway2.type} '${gateway2.id}'`, async () => {
        const response = await Agent.putIdentityGatewayAgent(
          gateway2.id,
          getAgent(gateway2.type, gateway2.id)
        );
        expect(response).toMatchSnapshot();
      });
    });

    describe('getJavaAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getJavaAgents).toBeDefined();
      });

      test('1: Get java agents', async () => {
        const response = await Agent.getJavaAgents();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getJavaAgent).toBeDefined();
      });

      test(`1: Get ${java1.type} '${java1.id}'`, async () => {
        const response = await Agent.getJavaAgent(java1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('putJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.putJavaAgent).toBeDefined();
      });

      test(`1: Put ${java2.type} '${java2.id}'`, async () => {
        const response = await Agent.putJavaAgent(
          java2.id,
          getAgent(java2.type, java2.id)
        );
        expect(response).toMatchSnapshot();
      });
    });

    describe('getWebAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getWebAgents).toBeDefined();
      });

      test('1: Get web agents', async () => {
        const response = await Agent.getWebAgents();
        expect(response).toMatchSnapshot();
      });
    });

    describe('getWebAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.getWebAgent).toBeDefined();
      });

      test(`1: Get ${web1.type} '${web1.id}'`, async () => {
        const response = await Agent.getWebAgent(web1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('putWebAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.putWebAgent).toBeDefined();
      });

      test(`1: Put ${web2.type} '${web2.id}'`, async () => {
        const response = await Agent.putWebAgent(
          web2.id,
          getAgent(web2.type, web2.id)
        );
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.exportAgents).toBeDefined();
      });

      test('1: Export all agents', async () => {
        const response = await Agent.exportAgents();
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportIdentityGatewayAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.exportIdentityGatewayAgents).toBeDefined();
      });

      test('1: Export gateway agents', async () => {
        const response = await Agent.exportIdentityGatewayAgents();
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportJavaAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.exportJavaAgents).toBeDefined();
      });

      test('1: Export java agents', async () => {
        const response = await Agent.exportJavaAgents();
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportWebAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.exportJavaAgents).toBeDefined();
      });

      test('1: Export web agents', async () => {
        const response = await Agent.exportWebAgents();
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.exportAgent).toBeDefined();
      });

      test(`1: Export agent '${gateway1.id}' (${gateway1.type})`, async () => {
        const response = await Agent.exportAgent(gateway1.id);
        expect(response).toMatchSnapshot();
      });

      test(`2: Export agent '${java1.id}' (${java1.type})`, async () => {
        const response = await Agent.exportAgent(java1.id);
        expect(response).toMatchSnapshot();
      });

      test(`3: Export agent '${web1.id}' (${web1.type})`, async () => {
        const response = await Agent.exportAgent(web1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportIdentityGatewayAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.exportIdentityGatewayAgent).toBeDefined();
      });

      test(`1: Export ${gateway1.type} '${gateway1.id}'`, async () => {
        const response = await Agent.exportIdentityGatewayAgent(gateway1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.exportJavaAgent).toBeDefined();
      });

      test(`1: Export ${java1.type} '${java1.id}'`, async () => {
        const response = await Agent.exportJavaAgent(java1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('exportWebAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.exportWebAgent).toBeDefined();
      });

      test(`1: Export ${web1.type} '${web1.id}'`, async () => {
        const response = await Agent.exportWebAgent(web1.id);
        expect(response).toMatchSnapshot();
      });
    });

    describe('importAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.importAgents).toBeDefined();
      });

      test('1: Import all agents', async () => {
        const agents = {
          [gateway3.id]: gateway3.type,
          [java3.id]: java3.type,
          [web3.id]: web3.type,
        };
        const exportData = Agent.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        await Agent.importAgents(exportData);
        expect(true).toBeTruthy();
      });
    });

    describe('importIdentityGatewayAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.importIdentityGatewayAgents).toBeDefined();
      });

      test('1: Import all gateway agents', async () => {
        const agents = {
          [gateway4.id]: gateway4.type,
          [gateway5.id]: gateway5.type,
        };
        const exportData = Agent.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        await Agent.importIdentityGatewayAgents(exportData);
        expect(true).toBeTruthy();
      });

      test('2: Import gateway agents with wrong type', async () => {
        const agents = {
          [java4.id]: java4.type,
          [web4.id]: web4.type,
        };
        const exportData = Agent.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(1);
        try {
          await Agent.importIdentityGatewayAgents(exportData);
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('importJavaAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.importJavaAgents).toBeDefined();
      });

      test('1: Import all java agents', async () => {
        const agents = {
          [java4.id]: java4.type,
          [java5.id]: java5.type,
        };
        const exportData = Agent.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        await Agent.importJavaAgents(exportData);
        expect(true).toBeTruthy();
      });

      test('2: Import java agents with wrong type', async () => {
        const agents = {
          [web4.id]: web4.type,
          [gateway4.id]: gateway4.type,
        };
        const exportData = Agent.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(1);
        try {
          await Agent.importJavaAgents(exportData);
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('importWebAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.importWebAgents).toBeDefined();
      });

      test('1: Import all web agents', async () => {
        const agents = {
          [web4.id]: web4.type,
          [web5.id]: web5.type,
        };
        const exportData = Agent.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        await Agent.importWebAgents(exportData);
        expect(true).toBeTruthy();
      });

      test('2: Import web agents with wrong type', async () => {
        const agents = {
          [gateway4.id]: gateway4.type,
          [java4.id]: java4.type,
        };
        const exportData = Agent.createAgentExportTemplate();
        for (const agentId of Object.keys(agents)) {
          exportData.agents[agentId] = getAgent(agents[agentId], agentId);
        }
        expect.assertions(1);
        try {
          await Agent.importWebAgents(exportData);
        } catch (error) {
          expect(error).toMatchSnapshot();
        }
      });
    });

    describe('importAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.importAgent).toBeDefined();
      });

      test('1: Import gateway agent', async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[gateway6.id] = getAgent(gateway6.type, gateway6.id);
        await Agent.importAgent(gateway6.id, exportData);
        expect(true).toBeTruthy();
      });

      test('2: Import java agent', async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[java6.id] = getAgent(java6.type, java6.id);
        await Agent.importAgent(java6.id, exportData);
        expect(true).toBeTruthy();
      });

      test('3: Import web agent', async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[web6.id] = getAgent(web6.type, web6.id);
        await Agent.importAgent(web6.id, exportData);
        expect(true).toBeTruthy();
      });
    });

    describe('importIdentityGatewayAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.importIdentityGatewayAgent).toBeDefined();
      });

      test(`1: Import ${gateway7.type} '${gateway7.id}'`, async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[gateway7.id] = getAgent(gateway7.type, gateway7.id);
        await Agent.importIdentityGatewayAgent(gateway7.id, exportData);
        expect(true).toBeTruthy();
      });

      test('2: Import gateway agent with wrong type', async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[java7.id] = getAgent(java7.type, java7.id);
        expect.assertions(1);
        try {
          await Agent.importIdentityGatewayAgent(java7.id, exportData);
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('importJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.importJavaAgents).toBeDefined();
      });

      test(`1: Import ${java7.type} '${java7.id}'`, async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[java7.id] = getAgent(java7.type, java7.id);
        await Agent.importJavaAgent(java7.id, exportData);
        expect(true).toBeTruthy();
      });

      test('2: Import java agent with wrong type', async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[web7.id] = getAgent(web7.type, web7.id);
        expect.assertions(1);
        try {
          await Agent.importJavaAgent(web7.id, exportData);
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('importWebAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.importWebAgent).toBeDefined();
      });

      test(`1: Import ${web7.type} '${web7.id}'`, async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[web7.id] = getAgent(web7.type, web7.id);
        await Agent.importWebAgent(web7.id, exportData);
        expect(true).toBeTruthy();
      });

      test('2: Import web agent with wrong type', async () => {
        const exportData = Agent.createAgentExportTemplate();
        exportData.agents[gateway7.id] = getAgent(gateway7.type, gateway7.id);
        expect.assertions(1);
        try {
          await Agent.importWebAgent(gateway7.id, exportData);
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
        expect(Agent.deleteAgent).toBeDefined();
      });

      test(`1: Delete agent '${gateway8.id}' (${gateway8.type})`, async () => {
        await Agent.deleteAgent(gateway8.id);
        expect(true).toBeTruthy();
      });

      test(`2: Delete agent '${java8.id}' (${java8.type})`, async () => {
        await Agent.deleteAgent(java8.id);
        expect(true).toBeTruthy();
      });

      test(`3: Delete agent '${web8.id}' (${web8.type})`, async () => {
        await Agent.deleteAgent(web8.id);
        expect(true).toBeTruthy();
      });
    });

    describe('deleteIdentityGatewayAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.deleteIdentityGatewayAgent).toBeDefined();
      });

      test(`1: Delete ${gateway9.type} '${gateway9.id}'`, async () => {
        await Agent.deleteIdentityGatewayAgent(gateway9.id);
        expect(true).toBeTruthy();
      });

      test(`2: Delete agent of wrong type '${java9.id}' (${java9.type})`, async () => {
        expect.assertions(1);
        try {
          await Agent.deleteIdentityGatewayAgent(java9.id);
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('deleteJavaAgent()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.deleteJavaAgent).toBeDefined();
      });

      test(`1: Delete ${java9.type} '${java9.id}'`, async () => {
        await Agent.deleteJavaAgent(java9.id);
        expect(true).toBeTruthy();
      });

      test(`2: Delete agent of wrong type '${web9.id}' (${web9.type})`, async () => {
        expect.assertions(1);
        try {
          await Agent.deleteJavaAgent(web9.id);
        } catch (error) {
          expect(error.message).toMatchSnapshot();
        }
      });
    });

    describe('deleteWebAgent()', () => {
      test('deleteWebAgent() 0: Method is implemented', async () => {
        expect(Agent.deleteWebAgent).toBeDefined();
      });

      test(`1: Delete ${web9.type} '${web9.id}'`, async () => {
        await Agent.deleteWebAgent(web9.id);
        expect(true).toBeTruthy();
      });

      test(`2: Delete agent of wrong type '${gateway9.id}' (${gateway9.type})`, async () => {
        expect.assertions(1);
        try {
          await Agent.deleteWebAgent(gateway9.id);
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
        expect(Agent.deleteIdentityGatewayAgents).toBeDefined();
      });

      test('1: Delete all gateway agents', async () => {
        await Agent.deleteIdentityGatewayAgents();
        expect(true).toBeTruthy();
      });
    });

    describe('deleteJavaAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.deleteJavaAgents).toBeDefined();
      });

      test('1: Delete all java agents', async () => {
        await Agent.deleteJavaAgents();
        expect(true).toBeTruthy();
      });
    });

    describe('deleteWebAgents()', () => {
      test('0: Method is implemented', async () => {
        expect(Agent.deleteWebAgents).toBeDefined();
      });

      test('1: Delete all web agents', async () => {
        await Agent.deleteWebAgents();
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
        expect(Agent.deleteAgents).toBeDefined();
      });

      test('1: Delete all agents', async () => {
        expect.assertions(1);
        await Agent.deleteAgents();
        expect(true).toBeTruthy();
      });
    });
  }
});
