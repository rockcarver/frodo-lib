import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { AgentRaw, state } from '../index';
import * as global from '../storage/StaticStorage';
import { isEqualJson } from '../ops/utils/OpsUtils';
import {
  getAgent,
  mockDeleteAgentByTypeAndId,
  mockFindAgentById,
  mockGetAgentTypes,
  mockGetAgentsByType,
  mockGetAgents,
  mockFindAgentByTypeAndId,
  mockGetAgentByTypeAndId,
  mockPutAgentByTypeAndId,
} from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('AgentApi - getAgentTypes()', () => {
  test('getAgentTypes() 0: Method is implemented', async () => {
    expect(AgentRaw.getAgentTypes).toBeDefined();
  });

  test('getAgentTypes() 1: Get all agent types', async () => {
    mockGetAgentTypes(mock);
    const agentTypes = await AgentRaw.getAgentTypes();
    expect(agentTypes).toBeTruthy();
    expect(agentTypes.result?.length).toBe(10);
  });
});

describe('AgentApi - getAgentsByType()', () => {
  test('getAgentsByType() 0: Method is implemented', async () => {
    expect(AgentRaw.getAgentsByType).toBeDefined();
  });

  test('getAgentsByType() 1: Get all gateway agents', async () => {
    mockGetAgentsByType(mock);
    const agentType = 'IdentityGatewayAgent';
    expect.assertions(7);
    const agents = await AgentRaw.getAgentsByType(agentType);
    expect(agents).toBeTruthy();
    expect(agents.result?.length).toBe(4);
    for (const agent of agents.result) {
      expect(agent._type._id).toBe(agentType);
    }
  });

  test('getAgentsByType() 2: Get all java agents', async () => {
    mockGetAgentsByType(mock);
    const agentType = 'J2EEAgent';
    expect.assertions(5);
    const agents = await AgentRaw.getAgentsByType(agentType);
    expect(agents).toBeTruthy();
    expect(agents.result?.length).toBe(2);
    for (const agent of agents.result) {
      expect(agent._type._id).toBe(agentType);
    }
  });

  test('getAgentsByType() 3: Get all web agents', async () => {
    mockGetAgentsByType(mock);
    const agentType = 'WebAgent';
    expect.assertions(5);
    const agents = await AgentRaw.getAgentsByType(agentType);
    expect(agents).toBeTruthy();
    expect(agents.result?.length).toBe(2);
    for (const agent of agents.result) {
      expect(agent._type._id).toBe(agentType);
    }
  });
});

describe('AgentApi - getAgents()', () => {
  test('getAgents() 0: Method is implemented', async () => {
    expect(AgentRaw.getAgents).toBeDefined();
  });

  test('getAgents() 1: Get all agents', async () => {
    mockGetAgents(mock);
    expect.assertions(3);
    const agents = await AgentRaw.getAgents();
    expect(agents).toBeTruthy();
    expect(agents.result?.length).toBe(39);
  });
});

describe('AgentApi - findAgentById()', () => {
  test('findAgentById() 0: Method is implemented', async () => {
    expect(AgentRaw.findAgentById).toBeDefined();
  });

  test('findAgentById() 1: Find agent "ig_mytestrun_com"', async () => {
    mockFindAgentById(mock);
    expect.assertions(3);
    const agentId = 'ig_mytestrun_com';
    const agents = await AgentRaw.findAgentById(agentId);
    expect(agents).toBeTruthy();
    expect(agents.length).toBe(1);
  });

  test('findAgentById() 2: Find agent "tomcatagent"', async () => {
    mockFindAgentById(mock);
    expect.assertions(3);
    const agentId = 'tomcatagent';
    const agents = await AgentRaw.findAgentById(agentId);
    expect(agents).toBeTruthy();
    expect(agents.length).toBe(1);
  });

  test('findAgentById() 3: Find agent "apacheagent"', async () => {
    mockFindAgentById(mock);
    expect.assertions(3);
    const agentId = 'apacheagent';
    const agents = await AgentRaw.findAgentById(agentId);
    expect(agents).toBeTruthy();
    expect(agents.length).toBe(1);
  });
});

describe('AgentApi - findAgentByTypeAndId()', () => {
  test('findAgentByTypeAndId() 0: Method is implemented', async () => {
    expect(AgentRaw.findAgentByTypeAndId).toBeDefined();
  });

  test('findAgentByTypeAndId() 1: Find gateway agent "ig_mytestrun_com"', async () => {
    mockFindAgentByTypeAndId(mock);
    expect.assertions(3);
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    const agents = await AgentRaw.findAgentByTypeAndId(agentType, agentId);
    expect(agents).toBeTruthy();
    expect(agents.length).toBe(1);
  });

  test('findAgentByTypeAndId() 2: Find java agent "tomcatagent"', async () => {
    mockFindAgentByTypeAndId(mock);
    expect.assertions(3);
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    const agents = await AgentRaw.findAgentByTypeAndId(agentType, agentId);
    expect(agents).toBeTruthy();
    expect(agents.length).toBe(1);
  });

  test('findAgentByTypeAndId() 3: Find web agent "apacheagent"', async () => {
    mockFindAgentByTypeAndId(mock);
    expect.assertions(3);
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    const agents = await AgentRaw.findAgentByTypeAndId(agentType, agentId);
    expect(agents).toBeTruthy();
    expect(agents.length).toBe(1);
  });
});

describe('AgentApi - getAgentByTypeAndId()', () => {
  test('getAgentByTypeAndId() 0: Method is implemented', async () => {
    expect(AgentRaw.getAgentByTypeAndId).toBeDefined();
  });

  test('getAgentByTypeAndId() 1: Get gateway agent "ig_mytestrun_com"', async () => {
    mockGetAgentByTypeAndId(mock);
    expect.assertions(3);
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    const agent = await AgentRaw.getAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('getAgentByTypeAndId() 2: Get java agent "tomcatagent"', async () => {
    mockGetAgentByTypeAndId(mock);
    expect.assertions(3);
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    const agent = await AgentRaw.getAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('getAgentByTypeAndId() 3: Get web agent "apacheagent"', async () => {
    mockGetAgentByTypeAndId(mock);
    expect.assertions(3);
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    const agent = await AgentRaw.getAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentApi - putAgentByTypeAndId()', () => {
  test('putAgentByTypeAndId() 0: Method is implemented', async () => {
    expect(AgentRaw.putAgentByTypeAndId).toBeDefined();
  });

  test('putAgentByTypeAndId() 1: Put gateway agent "ig_mytestrun_com"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    const agentData = getAgent(agentType, agentId);
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(5);
    const agent = await AgentRaw.putAgentByTypeAndId(
      agentType,
      agentId,
      agentData
    );
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('putAgentByTypeAndId() 2: Put java agent "tomcatagent"', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    const agentData = getAgent(agentType, agentId);
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(5);
    const agent = await AgentRaw.putAgentByTypeAndId(
      agentType,
      agentId,
      agentData
    );
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('putAgentByTypeAndId() 3: Put web agent "apacheagent"', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    const agentData = getAgent(agentType, agentId);
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(5);
    const agent = await AgentRaw.putAgentByTypeAndId(
      agentType,
      agentId,
      agentData
    );
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentApi - deleteAgentByTypeAndId()', () => {
  test('deleteAgentByTypeAndId() 0: Method is implemented', async () => {
    expect(AgentRaw.deleteAgentByTypeAndId).toBeDefined();
  });

  test('deleteAgentByTypeAndId() 1: Delete gateway agent "ig_mytestrun_com"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    const agentData = getAgent(agentType, agentId);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(5);
    const agent = await AgentRaw.deleteAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('deleteAgentByTypeAndId() 2: Delete java agent "tomcatagent"', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    const agentData = getAgent(agentType, agentId);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(5);
    const agent = await AgentRaw.deleteAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('deleteAgentByTypeAndId() 3: Delete web agent "apacheagent"', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    const agentData = getAgent(agentType, agentId);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(5);
    const agent = await AgentRaw.deleteAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });
});
