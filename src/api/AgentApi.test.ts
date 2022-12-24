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
import { jest } from '@jest/globals';
import { AgentRaw } from '../index';
import { getAgent } from '../test/mocks/ForgeRockApiMockEngine';
import { autoSetupPolly } from '../utils/AutoSetupPolly';

// Increase timeout for this test as pipeline keeps failing with error:
// Timeout - Async callback was not invoked within the 5000 ms timeout specified by jest.setTimeout.
jest.setTimeout(30000);

autoSetupPolly();

describe('AgentApi', () => {
  const gateway1 = {
    id: 'FrodoTestGatewayAgent1',
    type: 'IdentityGatewayAgent',
  };
  const gateway2 = {
    id: 'FrodoTestGatewayAgent2',
    type: 'IdentityGatewayAgent',
  };
  const gateway3 = {
    id: 'FrodoTestGatewayAgent3',
    type: 'IdentityGatewayAgent',
  };
  const java1 = {
    id: 'FrodoTestJavaAgent1',
    type: 'J2EEAgent',
  };
  const java2 = {
    id: 'FrodoTestJavaAgent2',
    type: 'J2EEAgent',
  };
  const java3 = {
    id: 'FrodoTestJavaAgent3',
    type: 'J2EEAgent',
  };
  const web1 = {
    id: 'FrodoTestWebAgent1',
    type: 'WebAgent',
  };
  const web2 = {
    id: 'FrodoTestWebAgent2',
    type: 'WebAgent',
  };
  const web3 = {
    id: 'FrodoTestWebAgent3',
    type: 'WebAgent',
  };
  // in recording mode, setup test data before recording
  beforeAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      // setup gateway1 - delete if exists, then create
      try {
        await AgentRaw.getAgentByTypeAndId(gateway1.type, gateway1.id);
        await AgentRaw.deleteAgentByTypeAndId(gateway1.type, gateway1.id);
      } catch (error) {
        // ignore
      } finally {
        await AgentRaw.putAgentByTypeAndId(
          gateway1.type,
          gateway1.id,
          getAgent(gateway1.type, gateway1.id)
        );
      }
      // setup gateway2 - delete if exists
      try {
        await AgentRaw.getAgentByTypeAndId(gateway2.type, gateway2.id);
        await AgentRaw.deleteAgentByTypeAndId(gateway2.type, gateway2.id);
      } catch (error) {
        // ignore
      }
      // setup gateway3 - delete if exists, then create
      try {
        await AgentRaw.getAgentByTypeAndId(gateway3.type, gateway3.id);
        await AgentRaw.deleteAgentByTypeAndId(gateway3.type, gateway3.id);
      } catch (error) {
        // ignore
      } finally {
        await AgentRaw.putAgentByTypeAndId(
          gateway3.type,
          gateway3.id,
          getAgent(gateway3.type, gateway3.id)
        );
      }

      // setup java1 - delete if exists, then create
      try {
        await AgentRaw.getAgentByTypeAndId(java1.type, java1.id);
        await AgentRaw.deleteAgentByTypeAndId(java1.type, java1.id);
      } catch (error) {
        // ignore
      } finally {
        await AgentRaw.putAgentByTypeAndId(
          java1.type,
          java1.id,
          getAgent(java1.type, java1.id)
        );
      }
      // setup java2 - delete if exists
      try {
        await AgentRaw.getAgentByTypeAndId(java2.type, java2.id);
        await AgentRaw.deleteAgentByTypeAndId(java2.type, java2.id);
      } catch (error) {
        // ignore
      }
      // setup java3 - delete if exists, then create
      try {
        await AgentRaw.getAgentByTypeAndId(java3.type, java3.id);
        await AgentRaw.deleteAgentByTypeAndId(java3.type, java3.id);
      } catch (error) {
        // ignore
      } finally {
        await AgentRaw.putAgentByTypeAndId(
          java3.type,
          java3.id,
          getAgent(java3.type, java3.id)
        );
      }

      // setup web1 - delete if exists, then create
      try {
        await AgentRaw.getAgentByTypeAndId(web1.type, web1.id);
        await AgentRaw.deleteAgentByTypeAndId(web1.type, web1.id);
      } catch (error) {
        // ignore
      } finally {
        await AgentRaw.putAgentByTypeAndId(
          web1.type,
          web1.id,
          getAgent(web1.type, web1.id)
        );
      }
      // setup web2 - delete if exists
      try {
        await AgentRaw.getAgentByTypeAndId(web2.type, web2.id);
        await AgentRaw.deleteAgentByTypeAndId(web2.type, web2.id);
      } catch (error) {
        // ignore
      }
      // setup web3 - delete if exists, then create
      try {
        await AgentRaw.getAgentByTypeAndId(web3.type, web3.id);
        await AgentRaw.deleteAgentByTypeAndId(web3.type, web3.id);
      } catch (error) {
        // ignore
      } finally {
        await AgentRaw.putAgentByTypeAndId(
          web3.type,
          web3.id,
          getAgent(web3.type, web3.id)
        );
      }
    }
  });
  // in recording mode, remove test data after recording
  afterAll(async () => {
    if (process.env.FRODO_POLLY_MODE === 'record') {
      try {
        await AgentRaw.getAgentByTypeAndId(gateway1.type, gateway1.id);
        await AgentRaw.deleteAgentByTypeAndId(gateway1.type, gateway1.id);
      } catch (error) {
        // ignore
      }
      try {
        await AgentRaw.getAgentByTypeAndId(gateway2.type, gateway2.id);
        await AgentRaw.deleteAgentByTypeAndId(gateway2.type, gateway2.id);
      } catch (error) {
        // ignore
      }
      try {
        await AgentRaw.getAgentByTypeAndId(gateway3.type, gateway3.id);
        await AgentRaw.deleteAgentByTypeAndId(gateway3.type, gateway3.id);
      } catch (error) {
        // ignore
      }

      try {
        await AgentRaw.getAgentByTypeAndId(java1.type, java1.id);
        await AgentRaw.deleteAgentByTypeAndId(java1.type, java1.id);
      } catch (error) {
        // ignore
      }
      try {
        await AgentRaw.getAgentByTypeAndId(java2.type, java2.id);
        await AgentRaw.deleteAgentByTypeAndId(java2.type, java2.id);
      } catch (error) {
        // ignore
      }
      try {
        await AgentRaw.getAgentByTypeAndId(java3.type, java3.id);
        await AgentRaw.deleteAgentByTypeAndId(java3.type, java3.id);
      } catch (error) {
        // ignore
      }

      try {
        await AgentRaw.getAgentByTypeAndId(web1.type, web1.id);
        await AgentRaw.deleteAgentByTypeAndId(web1.type, web1.id);
      } catch (error) {
        // ignore
      }
      try {
        await AgentRaw.getAgentByTypeAndId(web2.type, web2.id);
        await AgentRaw.deleteAgentByTypeAndId(web2.type, web2.id);
      } catch (error) {
        // ignore
      }
      try {
        await AgentRaw.getAgentByTypeAndId(web3.type, web3.id);
        await AgentRaw.deleteAgentByTypeAndId(web3.type, web3.id);
      } catch (error) {
        // ignore
      }
    }
  });

  describe('getAgentTypes()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentRaw.getAgentTypes).toBeDefined();
    });

    test('1: Get all agent types', async () => {
      const response = await AgentRaw.getAgentTypes();
      expect(response).toMatchSnapshot();
    });
  });

  describe('getAgentsByType()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentRaw.getAgentsByType).toBeDefined();
    });

    test('1: Get all gateway agents', async () => {
      const agentType = 'IdentityGatewayAgent';
      const response = await AgentRaw.getAgentsByType(agentType);
      expect(response).toMatchSnapshot();
    });

    test('2: Get all java agents', async () => {
      const agentType = 'J2EEAgent';
      const response = await AgentRaw.getAgentsByType(agentType);
      expect(response).toMatchSnapshot();
    });

    test('3: Get all web agents', async () => {
      const agentType = 'WebAgent';
      const response = await AgentRaw.getAgentsByType(agentType);
      expect(response).toMatchSnapshot();
    });
  });

  describe('getAgents()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentRaw.getAgents).toBeDefined();
    });

    test('1: Get all agents', async () => {
      const response = await AgentRaw.getAgents();
      expect(response).toMatchSnapshot();
    });
  });

  describe('findAgentById()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentRaw.findAgentById).toBeDefined();
    });

    test(`1: Find agent '${gateway1.id}'`, async () => {
      const response = await AgentRaw.findAgentById(gateway1.id);
      expect(response).toMatchSnapshot();
    });

    test(`2: Find agent '${java1.id}'`, async () => {
      const response = await AgentRaw.findAgentById(java1.id);
      expect(response).toMatchSnapshot();
    });

    test(`3: Find agent '${web1.id}'`, async () => {
      const response = await AgentRaw.findAgentById(web1.id);
      expect(response).toMatchSnapshot();
    });
  });

  describe('findAgentByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentRaw.findAgentByTypeAndId).toBeDefined();
    });

    test(`1: Find ${gateway1.type} '${gateway1.id}'`, async () => {
      const response = await AgentRaw.findAgentByTypeAndId(
        gateway1.type,
        gateway1.id
      );
      expect(response).toMatchSnapshot();
    });

    test(`2: Find ${java1.type} '${java1.id}'`, async () => {
      const response = await AgentRaw.findAgentByTypeAndId(
        java1.type,
        java1.id
      );
      expect(response).toMatchSnapshot();
    });

    test(`3: Find ${web1.type} '${web1.id}'`, async () => {
      const response = await AgentRaw.findAgentByTypeAndId(web1.type, web1.id);
      expect(response).toMatchSnapshot();
    });
  });

  describe('getAgentByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentRaw.getAgentByTypeAndId).toBeDefined();
    });

    test(`1: Get ${gateway1.type} '${gateway1.id}'`, async () => {
      const response = await AgentRaw.getAgentByTypeAndId(
        gateway1.type,
        gateway1.id
      );
      expect(response).toMatchSnapshot();
    });

    test(`2: Get ${java1.type} '${java1.id}'`, async () => {
      const response = await AgentRaw.getAgentByTypeAndId(java1.type, java1.id);
      expect(response).toMatchSnapshot();
    });

    test(`3: Get ${web1.type} '${web1.id}'`, async () => {
      const response = await AgentRaw.getAgentByTypeAndId(web1.type, web1.id);
      expect(response).toMatchSnapshot();
    });
  });

  describe('putAgentByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentRaw.putAgentByTypeAndId).toBeDefined();
    });

    test(`1: Put ${gateway2.type} '${gateway2.id}'`, async () => {
      const response = await AgentRaw.putAgentByTypeAndId(
        gateway2.type,
        gateway2.id,
        getAgent(gateway2.type, gateway2.id)
      );
      expect(response).toMatchSnapshot();
    });

    test(`2: Put ${java2.type} '${java2.id}'`, async () => {
      const response = await AgentRaw.putAgentByTypeAndId(
        java2.type,
        java2.id,
        getAgent(java2.type, java2.id)
      );
      expect(response).toMatchSnapshot();
    });

    test(`3: Put ${web2.type} '${web2.id}'`, async () => {
      const response = await AgentRaw.putAgentByTypeAndId(
        web2.type,
        web2.id,
        getAgent(web2.type, web2.id)
      );
      expect(response).toMatchSnapshot();
    });
  });

  describe('deleteAgentByTypeAndId()', () => {
    test('0: Method is implemented', async () => {
      expect(AgentRaw.deleteAgentByTypeAndId).toBeDefined();
    });

    test(`1: Delete ${gateway3.type} '${gateway3.id}'`, async () => {
      const response = await AgentRaw.deleteAgentByTypeAndId(
        gateway3.type,
        gateway3.id
      );
      expect(response).toMatchSnapshot();
    });

    test(`2: Delete ${java3.type} '${java3.id}'`, async () => {
      const response = await AgentRaw.deleteAgentByTypeAndId(
        java3.type,
        java3.id
      );
      expect(response).toMatchSnapshot();
    });

    test(`3: Delete ${web3.type} '${web3.id}'`, async () => {
      const response = await AgentRaw.deleteAgentByTypeAndId(
        web3.type,
        web3.id
      );
      expect(response).toMatchSnapshot();
    });
  });
});
