/**
 * To record and update snapshots, you must perform 3 steps in order:
 *
 * 1. Record API responses & update ESM snapshots
 *
 *    To record and update ESM snapshots, you must call the test:record
 *    script and override all the connection state variables required
 *    to connect to the env to record from:
 *
 *        FRODO_DEBUG=1 FRODO_HOST=frodo-dev npm run test:record AgentApi
 *
 *    The above command assumes that you have a connection profile for
 *    'volker-dev' on your development machine.
 *
 * 2. Update CJS snapshots
 *
 *    After recording, the ESM snapshots will already be updated as that happens
 *    in one go, but you must manually update the CJS snapshots by running:
 *
 *        FRODO_DEBUG=1 npm run test:update AgentApi
 *
 * 3. Test your changes
 *
 *    If 1 and 2 didn't produce any errors, you are ready to run the tests in
 *    replay mode and make sure they all succeed as well:
 *
 *        npm run test:only AgentApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import * as AgentApi from './AgentApi';
import { state } from '../index';
import { getAgent } from '../test/mocks/ForgeRockApiMockEngine';
import { autoSetupPolly } from '../utils/AutoSetupPolly';
import { filterRecording } from '../utils/PollyUtils';

const ctx = autoSetupPolly();

describe('AgentApi', () => {
  const gateway1 = {
    id: 'FrodoTestGatewayAgent1',
    type: 'IdentityGatewayAgent' as AgentApi.AgentType,
  };
  const gateway2 = {
    id: 'FrodoTestGatewayAgent2',
    type: 'IdentityGatewayAgent' as AgentApi.AgentType,
  };
  const gateway3 = {
    id: 'FrodoTestGatewayAgent3',
    type: 'IdentityGatewayAgent' as AgentApi.AgentType,
  };
  const java1 = {
    id: 'FrodoTestJavaAgent1',
    type: 'J2EEAgent' as AgentApi.AgentType,
  };
  const java2 = {
    id: 'FrodoTestJavaAgent2',
    type: 'J2EEAgent' as AgentApi.AgentType,
  };
  const java3 = {
    id: 'FrodoTestJavaAgent3',
    type: 'J2EEAgent' as AgentApi.AgentType,
  };
  const web1 = {
    id: 'FrodoTestWebAgent1',
    type: 'WebAgent' as AgentApi.AgentType,
  };
  const web2 = {
    id: 'FrodoTestWebAgent2',
    type: 'WebAgent' as AgentApi.AgentType,
  };
  const web3 = {
    id: 'FrodoTestWebAgent3',
    type: 'WebAgent' as AgentApi.AgentType,
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup gateway1 - delete if exists, then create
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: gateway1.type,
          agentId: gateway1.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: gateway1.type,
          agentId: gateway1.id,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await AgentApi.putAgentByTypeAndId({
          agentType: gateway1.type,
          agentId: gateway1.id,
          agentData: getAgent(gateway1.type, gateway1.id),
          state,
        });
      }
      // setup gateway2 - delete if exists
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: gateway2.type,
          agentId: gateway2.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: gateway2.type,
          agentId: gateway2.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      // setup gateway3 - delete if exists, then create
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: gateway3.type,
          agentId: gateway3.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: gateway3.type,
          agentId: gateway3.id,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await AgentApi.putAgentByTypeAndId({
          agentType: gateway3.type,
          agentId: gateway3.id,
          agentData: getAgent(gateway3.type, gateway3.id),
          state,
        });
      }

      // setup java1 - delete if exists, then create
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: java1.type,
          agentId: java1.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: java1.type,
          agentId: java1.id,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await AgentApi.putAgentByTypeAndId({
          agentType: java1.type,
          agentId: java1.id,
          agentData: getAgent(java1.type, java1.id),
          state,
        });
      }
      // setup java2 - delete if exists
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: java2.type,
          agentId: java2.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: java2.type,
          agentId: java2.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      // setup java3 - delete if exists, then create
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: java3.type,
          agentId: java3.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: java3.type,
          agentId: java3.id,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await AgentApi.putAgentByTypeAndId({
          agentType: java3.type,
          agentId: java3.id,
          agentData: getAgent(java3.type, java3.id),
          state,
        });
      }

      // setup web1 - delete if exists, then create
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: web1.type,
          agentId: web1.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: web1.type,
          agentId: web1.id,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await AgentApi.putAgentByTypeAndId({
          agentType: web1.type,
          agentId: web1.id,
          agentData: getAgent(web1.type, web1.id),
          state,
        });
      }
      // setup web2 - delete if exists
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: web2.type,
          agentId: web2.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: web2.type,
          agentId: web2.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      // setup web3 - delete if exists, then create
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: web3.type,
          agentId: web3.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: web3.type,
          agentId: web3.id,
          state,
        });
      } catch (error) {
        // ignore
      } finally {
        await AgentApi.putAgentByTypeAndId({
          agentType: web3.type,
          agentId: web3.id,
          agentData: getAgent(web3.type, web3.id),
          state,
        });
      }
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: gateway1.type,
          agentId: gateway1.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: gateway1.type,
          agentId: gateway1.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: gateway2.type,
          agentId: gateway2.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: gateway2.type,
          agentId: gateway2.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: gateway3.type,
          agentId: gateway3.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: gateway3.type,
          agentId: gateway3.id,
          state,
        });
      } catch (error) {
        // ignore
      }

      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: java1.type,
          agentId: java1.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: java1.type,
          agentId: java1.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: java2.type,
          agentId: java2.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: java2.type,
          agentId: java2.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: java3.type,
          agentId: java3.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: java3.type,
          agentId: java3.id,
          state,
        });
      } catch (error) {
        // ignore
      }

      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: web1.type,
          agentId: web1.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: web1.type,
          agentId: web1.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: web2.type,
          agentId: web2.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: web2.type,
          agentId: web2.id,
          state,
        });
      } catch (error) {
        // ignore
      }
      try {
        await AgentApi.getAgentByTypeAndId({
          agentType: web3.type,
          agentId: web3.id,
          state,
        });
        await AgentApi.deleteAgentByTypeAndId({
          agentType: web3.type,
          agentId: web3.id,
          state,
        });
      } catch (error) {
        // ignore
      }
    }
  });
  beforeEach(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      ctx.polly.server.any().on('beforePersist', (_req, recording) => {
        filterRecording(recording);
      });
    }
  });

  describe('getAgentTypes()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentApi.getAgentTypes).toBeDefined();
    });

    test('1: Get all agent types', async () => {
      const response = await AgentApi.getAgentTypes({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getAgentsByType()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentApi.getAgentsByType).toBeDefined();
    });

    test('1: Get all gateway agents', async () => {
      const agentType = 'IdentityGatewayAgent';
      const response = await AgentApi.getAgentsByType({ agentType, state });
      expect(response).toMatchSnapshot();
    });

    test('2: Get all java agents', async () => {
      const agentType = 'J2EEAgent';
      const response = await AgentApi.getAgentsByType({ agentType, state });
      expect(response).toMatchSnapshot();
    });

    test('3: Get all web agents', async () => {
      const agentType = 'WebAgent';
      const response = await AgentApi.getAgentsByType({ agentType, state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getAgents()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentApi.getAgents).toBeDefined();
    });

    test('1: Get all agents', async () => {
      const response = await AgentApi.getAgents({ state });
      expect(response).toMatchSnapshot();
    });
  });

  describe('findAgentById()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentApi.findAgentById).toBeDefined();
    });

    test(`1: Find agent '${gateway1.id}'`, async () => {
      const response = await AgentApi.findAgentById({
        agentId: gateway1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Find agent '${java1.id}'`, async () => {
      const response = await AgentApi.findAgentById({
        agentId: java1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`3: Find agent '${web1.id}'`, async () => {
      const response = await AgentApi.findAgentById({
        agentId: web1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('findAgentByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentApi.findAgentByTypeAndId).toBeDefined();
    });

    test(`1: Find ${gateway1.type} '${gateway1.id}'`, async () => {
      const response = await AgentApi.findAgentByTypeAndId({
        agentType: gateway1.type,
        agentId: gateway1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Find ${java1.type} '${java1.id}'`, async () => {
      const response = await AgentApi.findAgentByTypeAndId({
        agentType: java1.type,
        agentId: java1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`3: Find ${web1.type} '${web1.id}'`, async () => {
      const response = await AgentApi.findAgentByTypeAndId({
        agentType: web1.type,
        agentId: web1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('getAgentByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentApi.getAgentByTypeAndId).toBeDefined();
    });

    test(`1: Get ${gateway1.type} '${gateway1.id}'`, async () => {
      const response = await AgentApi.getAgentByTypeAndId({
        agentType: gateway1.type,
        agentId: gateway1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Get ${java1.type} '${java1.id}'`, async () => {
      const response = await AgentApi.getAgentByTypeAndId({
        agentType: java1.type,
        agentId: java1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`3: Get ${web1.type} '${web1.id}'`, async () => {
      const response = await AgentApi.getAgentByTypeAndId({
        agentType: web1.type,
        agentId: web1.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('putAgentByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentApi.putAgentByTypeAndId).toBeDefined();
    });

    test(`1: Put ${gateway2.type} '${gateway2.id}'`, async () => {
      const response = await AgentApi.putAgentByTypeAndId({
        agentType: gateway2.type,
        agentId: gateway2.id,
        agentData: getAgent(gateway2.type, gateway2.id),
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Put ${java2.type} '${java2.id}'`, async () => {
      const response = await AgentApi.putAgentByTypeAndId({
        agentType: java2.type,
        agentId: java2.id,
        agentData: getAgent(java2.type, java2.id),
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`3: Put ${web2.type} '${web2.id}'`, async () => {
      const response = await AgentApi.putAgentByTypeAndId({
        agentType: web2.type,
        agentId: web2.id,
        agentData: getAgent(web2.type, web2.id),
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });

  describe('deleteAgentByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentApi.deleteAgentByTypeAndId).toBeDefined();
    });

    test(`1: Delete ${gateway3.type} '${gateway3.id}'`, async () => {
      const response = await AgentApi.deleteAgentByTypeAndId({
        agentType: gateway3.type,
        agentId: gateway3.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`2: Delete ${java3.type} '${java3.id}'`, async () => {
      const response = await AgentApi.deleteAgentByTypeAndId({
        agentType: java3.type,
        agentId: java3.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });

    test(`3: Delete ${web3.type} '${web3.id}'`, async () => {
      const response = await AgentApi.deleteAgentByTypeAndId({
        agentType: web3.type,
        agentId: web3.id,
        state,
      });
      expect(response).toMatchSnapshot();
    });
  });
});
