import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Agent, state } from '../index';
import * as global from '../storage/StaticStorage';
import { isEqualJson } from './utils/OpsUtils';
import {
  mockGetAgentsByType,
  mockGetAgentByTypeAndId,
  mockFindAgentById,
  mockPutAgentByTypeAndId,
  getAgent,
  mockDeleteAgentByTypeAndId,
  mockFindAgentByTypeAndId,
} from '../test/mocks/ForgeRockApiMockEngine';
import { AgentExportInterface } from './OpsTypes';

const mock = new MockAdapter(axios);

state.setHost('https://openam-frodo-dev.forgeblocks.com/am');
state.setRealm('alpha');
state.setCookieName('cookieName');
state.setCookieValue('cookieValue');
state.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe('AgentOps - createAgentExportTemplate()', () => {
  test('createAgentExportTemplate() 0: Method is implemented', async () => {
    expect(Agent.createAgentExportTemplate).toBeDefined();
  });

  test('createAgentExportTemplate() 1: Get all agent types', async () => {
    const template: AgentExportInterface = { meta: {}, agents: {} };
    const exportTemplate = Agent.createAgentExportTemplate();
    console.dir(exportTemplate);
    expect(exportTemplate).toBeTruthy();
    expect(exportTemplate).toMatchObject<AgentExportInterface>(template);
  });
});

describe('AgentOps - getAgents()', () => {
  test('getAgents() 0: Method is implemented', async () => {
    expect(Agent.getAgents).toBeDefined();
  });

  test('getAgents() 1: Get all agents', async () => {
    const agentTypes = ['IdentityGatewayAgent', 'J2EEAgent', 'WebAgent'];
    const agentIds = [
      'ig_mytestrun_com',
      'ig_chico',
      'ajays_client',
      'api_client',
      'tomcatagent',
      'javaAgent',
      'apacheagent',
      'webserver',
    ];
    mockGetAgentsByType(mock);
    expect.assertions(21);
    const agents = await Agent.getAgents();
    expect(agents).toBeTruthy();
    expect(agents.length).toBe(8);
    for (const agent of agents) {
      expect(agentTypes).toContain(agent._type._id);
      expect(agentIds).toContain(agent._id);
    }
  });
});

describe('AgentOps - getAgent()', () => {
  test('getAgent() 0: Method is implemented', async () => {
    expect(Agent.getAgent).toBeDefined();
  });

  test('getAgent() 1: Get agent "ig_mytestrun_com" (gateway)', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockFindAgentById(mock);
    mockGetAgentByTypeAndId(mock);
    expect.assertions(5);
    const agent = await Agent.getAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getAgent() 2: Get agent "tomcatagent" (java)', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockFindAgentById(mock);
    mockGetAgentByTypeAndId(mock);
    expect.assertions(5);
    const agent = await Agent.getAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getAgent() 3: Get agent "apacheagent" (web)', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockFindAgentById(mock);
    mockGetAgentByTypeAndId(mock);
    expect.assertions(5);
    const agent = await Agent.getAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentOps - getAgentByTypeAndId()', () => {
  test('getAgentByTypeAndId() 0: Method is implemented', async () => {
    expect(Agent.getAgentByTypeAndId).toBeDefined();
  });

  test('getAgentByTypeAndId() 1: Get gateway agent "ig_mytestrun_com"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getAgentByTypeAndId() 2: Get java agent "tomcatagent"', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getAgentByTypeAndId() 3: Get web agent "apacheagent"', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getAgentByTypeAndId(agentType, agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentOps - getIdentityGatewayAgents()', () => {
  test('getIdentityGatewayAgents() 0: Method is implemented', async () => {
    expect(Agent.getIdentityGatewayAgents).toBeDefined();
  });

  test('getIdentityGatewayAgents() 1: Get gateway agents', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentIds = [
      'ig_mytestrun_com',
      'ig_chico',
      'ajays_client',
      'api_client',
    ];
    mockGetAgentsByType(mock);
    expect.assertions(10);
    const agents = await Agent.getIdentityGatewayAgents();
    expect(agents).toBeTruthy();
    for (const agent of agents) {
      expect(agent._type._id).toBe(agentType);
      expect(agentIds).toContain(agent._id);
    }
  });
});

describe('AgentOps - getIdentityGatewayAgent()', () => {
  test('getIdentityGatewayAgent() 0: Method is implemented', async () => {
    expect(Agent.getIdentityGatewayAgent).toBeDefined();
  });

  test('getIdentityGatewayAgent() 1: Get gateway agent "ig_mytestrun_com"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getIdentityGatewayAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getIdentityGatewayAgent() 2: Get gateway agent "ig_chico"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_chico';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getIdentityGatewayAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getIdentityGatewayAgent() 3: Get gateway agent "ajays_client"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ajays_client';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getIdentityGatewayAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getIdentityGatewayAgent() 4: Get gateway agent "api_client"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'api_client';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getIdentityGatewayAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentOps - putIdentityGatewayAgent()', () => {
  test('putIdentityGatewayAgent() 0: Method is implemented', async () => {
    expect(Agent.putIdentityGatewayAgent).toBeDefined();
  });

  test('putIdentityGatewayAgent() 1: Put gateway agent "ig_mytestrun_com"', async () => {
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
    const agent = await Agent.putIdentityGatewayAgent(agentId, agentData);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('putIdentityGatewayAgent() 2: Put gateway agent "ig_chico"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_chico';
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
    const agent = await Agent.putIdentityGatewayAgent(agentId, agentData);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('putIdentityGatewayAgent() 3: Put gateway agent "ajays_client"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ajays_client';
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
    const agent = await Agent.putIdentityGatewayAgent(agentId, agentData);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('putIdentityGatewayAgent() 4: Put gateway agent "api_client"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'api_client';
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
    const agent = await Agent.putIdentityGatewayAgent(agentId, agentData);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentOps - getJavaAgents()', () => {
  test('getJavaAgents() 0: Method is implemented', async () => {
    expect(Agent.getJavaAgents).toBeDefined();
  });

  test('getJavaAgents() 1: Get java agents', async () => {
    const agentType = 'J2EEAgent';
    const agentIds = ['tomcatagent', 'javaAgent'];
    mockGetAgentsByType(mock);
    expect.assertions(6);
    const agents = await Agent.getJavaAgents();
    expect(agents).toBeTruthy();
    for (const agent of agents) {
      expect(agent._type._id).toBe(agentType);
      expect(agentIds).toContain(agent._id);
    }
  });
});

describe('AgentOps - getJavaAgent()', () => {
  test('getJavaAgent() 0: Method is implemented', async () => {
    expect(Agent.getJavaAgent).toBeDefined();
  });

  test('getJavaAgent() 1: Get java agent "tomcatagent"', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getJavaAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getJavaAgent() 2: Get java agent "javaAgent"', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'javaAgent';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getJavaAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentOps - putJavaAgent()', () => {
  test('putJavaAgent() 0: Method is implemented', async () => {
    expect(Agent.putJavaAgent).toBeDefined();
  });

  test('putJavaAgent() 1: Put java agent "tomcatagent"', async () => {
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
    const agent = await Agent.putJavaAgent(agentId, agentData);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('putJavaAgent() 2: Put java agent "javaAgent"', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'javaAgent';
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
    const agent = await Agent.putJavaAgent(agentId, agentData);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentOps - getWebAgents()', () => {
  test('getWebAgents() 0: Method is implemented', async () => {
    expect(Agent.getWebAgents).toBeDefined();
  });

  test('getWebAgents() 1: Get web agents', async () => {
    const agentType = 'WebAgent';
    const agentIds = ['apacheagent', 'webserver'];
    mockGetAgentsByType(mock);
    expect.assertions(6);
    const agents = await Agent.getWebAgents();
    expect(agents).toBeTruthy();
    for (const agent of agents) {
      expect(agent._type._id).toBe(agentType);
      expect(agentIds).toContain(agent._id);
    }
  });
});

describe('AgentOps - getWebAgent()', () => {
  test('getWebAgent() 0: Method is implemented', async () => {
    expect(Agent.getWebAgent).toBeDefined();
  });

  test('getWebAgent() 1: Get web agent "apacheagent"', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getWebAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });

  test('getWebAgent() 2: Get web agent "webserver"', async () => {
    const agentType = 'WebAgent';
    const agentId = 'webserver';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(4);
    const agent = await Agent.getWebAgent(agentId);
    expect(agent).toBeTruthy();
    expect(agent._type._id).toBe(agentType);
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentOps - putWebAgent()', () => {
  test('putWebAgent() 0: Method is implemented', async () => {
    expect(Agent.putWebAgent).toBeDefined();
  });

  test('putWebAgent() 1: Put java agent "apacheagent"', async () => {
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
    const agent = await Agent.putWebAgent(agentId, agentData);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });

  test('putWebAgent() 2: Put web agent "webserver"', async () => {
    const agentType = 'WebAgent';
    const agentId = 'webserver';
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
    const agent = await Agent.putWebAgent(agentId, agentData);
    expect(agent).toBeTruthy();
    expect(agent._id).toBe(agentId);
  });
});

describe('AgentOps - exportAgents()', () => {
  test('exportAgents() 0: Method is implemented', async () => {
    expect(Agent.exportAgents).toBeDefined();
  });

  test('exportAgents() 1: Export all agents', async () => {
    const agentTypes = ['IdentityGatewayAgent', 'J2EEAgent', 'WebAgent'];
    const agentIds = [
      'ig_mytestrun_com',
      'ig_chico',
      'ajays_client',
      'api_client',
      'tomcatagent',
      'javaAgent',
      'apacheagent',
      'webserver',
    ];
    mockGetAgentsByType(mock);
    expect.assertions(22);
    const exportData = await Agent.exportAgents();
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(8);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentTypes).toContain(agent._type._id);
      expect(agentIds).toContain(agent._id);
    }
  });
});

describe('AgentOps - exportIdentityGatewayAgents()', () => {
  test('exportIdentityGatewayAgents() 0: Method is implemented', async () => {
    expect(Agent.exportIdentityGatewayAgents).toBeDefined();
  });

  test('exportIdentityGatewayAgents() 1: Export gateway agents', async () => {
    const agentTypes = ['IdentityGatewayAgent'];
    const agentIds = [
      'ig_mytestrun_com',
      'ig_chico',
      'ajays_client',
      'api_client',
    ];
    mockGetAgentsByType(mock);
    expect.assertions(12);
    const exportData = await Agent.exportIdentityGatewayAgents();
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(4);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentTypes).toContain(agent._type._id);
      expect(agentIds).toContain(agent._id);
    }
  });
});

describe('AgentOps - exportJavaAgents()', () => {
  test('exportJavaAgents() 0: Method is implemented', async () => {
    expect(Agent.exportJavaAgents).toBeDefined();
  });

  test('exportJavaAgents() 1: Export java agents', async () => {
    const agentTypes = ['J2EEAgent'];
    const agentIds = ['tomcatagent', 'javaAgent'];
    mockGetAgentsByType(mock);
    expect.assertions(8);
    const exportData = await Agent.exportJavaAgents();
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(2);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentTypes).toContain(agent._type._id);
      expect(agentIds).toContain(agent._id);
    }
  });
});

describe('AgentOps - exportWebAgents()', () => {
  test('exportWebAgents() 0: Method is implemented', async () => {
    expect(Agent.exportJavaAgents).toBeDefined();
  });

  test('exportWebAgents() 1: Export web agents', async () => {
    const agentTypes = ['WebAgent'];
    const agentIds = ['apacheagent', 'webserver'];
    mockGetAgentsByType(mock);
    expect.assertions(8);
    const exportData = await Agent.exportWebAgents();
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(2);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentTypes).toContain(agent._type._id);
      expect(agentIds).toContain(agent._id);
    }
  });
});

describe('AgentOps - exportAgent()', () => {
  test('exportAgent() 0: Method is implemented', async () => {
    expect(Agent.exportAgent).toBeDefined();
  });

  test('exportAgent() 1: Export agent "ig_mytestrun_com" (gateway)', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockFindAgentById(mock);
    mockGetAgentByTypeAndId(mock);
    expect.assertions(7);
    const exportData = await Agent.exportAgent(agentId);
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(1);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentType).toBe(agent._type._id);
      expect(agentId).toBe(agent._id);
    }
  });

  test('exportAgent() 2: Export agent "tomcatagent" (java)', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockFindAgentById(mock);
    mockGetAgentByTypeAndId(mock);
    expect.assertions(7);
    const exportData = await Agent.exportAgent(agentId);
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(1);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentType).toBe(agent._type._id);
      expect(agentId).toBe(agent._id);
    }
  });

  test('exportAgent() 3: Export agent "apacheagent" (web)', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockFindAgentById(mock);
    mockGetAgentByTypeAndId(mock);
    expect.assertions(7);
    const exportData = await Agent.exportAgent(agentId);
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(1);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentType).toBe(agent._type._id);
      expect(agentId).toBe(agent._id);
    }
  });
});

describe('AgentOps - exportIdentityGatewayAgent()', () => {
  test('exportIdentityGatewayAgent() 0: Method is implemented', async () => {
    expect(Agent.exportIdentityGatewayAgent).toBeDefined();
  });

  test('exportIdentityGatewayAgent() 1: Export gateway agent "ig_mytestrun_com"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(6);
    const exportData = await Agent.exportIdentityGatewayAgent(agentId);
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(1);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentType).toBe(agent._type._id);
      expect(agentId).toBe(agent._id);
    }
  });
});

describe('AgentOps - exportJavaAgent()', () => {
  test('exportJavaAgent() 0: Method is implemented', async () => {
    expect(Agent.exportJavaAgent).toBeDefined();
  });

  test('exportJavaAgent() 2: Export java agent "tomcatagent"', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(6);
    const exportData = await Agent.exportJavaAgent(agentId);
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(1);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentType).toBe(agent._type._id);
      expect(agentId).toBe(agent._id);
    }
  });
});

describe('AgentOps - exportWebAgent()', () => {
  test('exportWebAgent() 0: Method is implemented', async () => {
    expect(Agent.exportWebAgent).toBeDefined();
  });

  test('exportWebAgent() 3: Export web agent "apacheagent"', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockGetAgentByTypeAndId(mock);
    expect.assertions(6);
    const exportData = await Agent.exportWebAgent(agentId);
    expect(exportData).toBeTruthy();
    expect(exportData.agents).toBeTruthy();
    expect(Object.keys(exportData.agents).length).toBe(1);
    for (const agent of Object.values(exportData.agents)) {
      expect(agentType).toBe(agent._type._id);
      expect(agentId).toBe(agent._id);
    }
  });
});

describe('AgentOps - importAgents()', () => {
  test('importAgents() 0: Method is implemented', async () => {
    expect(Agent.importAgents).toBeDefined();
  });

  test('importAgents() 1: Import all agents', async () => {
    const agents = {
      ig_mytestrun_com: 'IdentityGatewayAgent',
      ig_chico: 'IdentityGatewayAgent',
      ajays_client: 'IdentityGatewayAgent',
      api_client: 'IdentityGatewayAgent',
      tomcatagent: 'J2EEAgent',
      javaAgent: 'J2EEAgent',
      apacheagent: 'WebAgent',
      webserver: 'WebAgent',
    };
    const exportData = Agent.createAgentExportTemplate();
    for (const agentId of Object.keys(agents)) {
      const agentType = agents[agentId];
      const agentData = getAgent(agentType, agentId);
      exportData.agents[agentId] = agentData;
    }
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(25);
    await Agent.importAgents(exportData);
    expect(true).toBeTruthy();
  });
});

describe('AgentOps - importIdentityGatewayAgents()', () => {
  test('importIdentityGatewayAgents() 0: Method is implemented', async () => {
    expect(Agent.importIdentityGatewayAgents).toBeDefined();
  });

  test('importIdentityGatewayAgents() 1: Import all gateway agents', async () => {
    const agents = {
      ig_mytestrun_com: 'IdentityGatewayAgent',
      ig_chico: 'IdentityGatewayAgent',
      ajays_client: 'IdentityGatewayAgent',
      api_client: 'IdentityGatewayAgent',
    };
    const exportData = Agent.createAgentExportTemplate();
    for (const agentId of Object.keys(agents)) {
      const agentType = agents[agentId];
      const agentData = getAgent(agentType, agentId);
      exportData.agents[agentId] = agentData;
    }
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(13);
    await Agent.importIdentityGatewayAgents(exportData);
    expect(true).toBeTruthy();
  });

  test('importIdentityGatewayAgents() 2: Import agents with wrong type', async () => {
    const agents = {
      tomcatagent: 'J2EEAgent',
      javaAgent: 'J2EEAgent',
    };
    const exportData = Agent.createAgentExportTemplate();
    for (const agentId of Object.keys(agents)) {
      const agentType = agents[agentId];
      const agentData = getAgent(agentType, agentId);
      exportData.agents[agentId] = agentData;
    }
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.importIdentityGatewayAgents(exportData);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(
        "Wrong agent type! Expected 'IdentityGatewayAgent' but got 'J2EEAgent'."
      );
    }
  });
});

describe('AgentOps - importJavaAgents()', () => {
  test('importJavaAgents() 0: Method is implemented', async () => {
    expect(Agent.importJavaAgents).toBeDefined();
  });

  test('importJavaAgents() 1: Import all java agents', async () => {
    const agents = {
      tomcatagent: 'J2EEAgent',
      javaAgent: 'J2EEAgent',
    };
    const exportData = Agent.createAgentExportTemplate();
    for (const agentId of Object.keys(agents)) {
      const agentType = agents[agentId];
      const agentData = getAgent(agentType, agentId);
      exportData.agents[agentId] = agentData;
    }
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(7);
    await Agent.importJavaAgents(exportData);
    expect(true).toBeTruthy();
  });

  test('importJavaAgents() 2: Import agents with wrong type', async () => {
    const agents = {
      apacheagent: 'WebAgent',
      webserver: 'WebAgent',
    };
    const exportData = Agent.createAgentExportTemplate();
    for (const agentId of Object.keys(agents)) {
      const agentType = agents[agentId];
      const agentData = getAgent(agentType, agentId);
      exportData.agents[agentId] = agentData;
    }
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.importJavaAgents(exportData);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(
        "Wrong agent type! Expected 'J2EEAgent' but got 'WebAgent'."
      );
    }
  });
});

describe('AgentOps - importWebAgents()', () => {
  test('importWebAgents() 0: Method is implemented', async () => {
    expect(Agent.importWebAgents).toBeDefined();
  });

  test('importWebAgents() 1: Import all web agents', async () => {
    const agents = {
      apacheagent: 'WebAgent',
      webserver: 'WebAgent',
    };
    const exportData = Agent.createAgentExportTemplate();
    for (const agentId of Object.keys(agents)) {
      const agentType = agents[agentId];
      const agentData = getAgent(agentType, agentId);
      exportData.agents[agentId] = agentData;
    }
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(7);
    await Agent.importWebAgents(exportData);
    expect(true).toBeTruthy();
  });

  test('importWebAgents() 2: Import agents with wrong type', async () => {
    const agents = {
      ig_mytestrun_com: 'IdentityGatewayAgent',
      ig_chico: 'IdentityGatewayAgent',
      ajays_client: 'IdentityGatewayAgent',
      api_client: 'IdentityGatewayAgent',
    };
    const exportData = Agent.createAgentExportTemplate();
    for (const agentId of Object.keys(agents)) {
      const agentType = agents[agentId];
      const agentData = getAgent(agentType, agentId);
      exportData.agents[agentId] = agentData;
    }
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.importWebAgents(exportData);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(
        "Wrong agent type! Expected 'WebAgent' but got 'IdentityGatewayAgent'."
      );
    }
  });
});

describe('AgentOps - importAgent()', () => {
  test('importAgent() 0: Method is implemented', async () => {
    expect(Agent.importAgent).toBeDefined();
  });

  test('importAgent() 1: Import gateway agent', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(4);
    await Agent.importAgent(agentId, exportData);
    expect(true).toBeTruthy();
  });

  test('importAgent() 2: Import java agent', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(4);
    await Agent.importAgent(agentId, exportData);
    expect(true).toBeTruthy();
  });

  test('importAgent() 3: Import web agent', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(4);
    await Agent.importAgent(agentId, exportData);
    expect(true).toBeTruthy();
  });
});

describe('AgentOps - importIdentityGatewayAgent()', () => {
  test('importIdentityGatewayAgent() 0: Method is implemented', async () => {
    expect(Agent.importIdentityGatewayAgent).toBeDefined();
  });

  test('importIdentityGatewayAgent() 1: Import gateway agent "ig_mytestrun_com"', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(4);
    await Agent.importIdentityGatewayAgent(agentId, exportData);
    expect(true).toBeTruthy();
  });

  test('importIdentityGatewayAgent() 2: Import agent with wrong type', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(2);
    try {
      await Agent.importIdentityGatewayAgent(agentId, exportData);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(
        "Wrong agent type! Expected 'IdentityGatewayAgent' but got 'J2EEAgent'."
      );
    }
  });
});

describe('AgentOps - importJavaAgent()', () => {
  test('importJavaAgent() 0: Method is implemented', async () => {
    expect(Agent.importJavaAgents).toBeDefined();
  });

  test('importJavaAgent() 1: Import java agent "tomcatagent"', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(4);
    await Agent.importJavaAgent(agentId, exportData);
    expect(true).toBeTruthy();
  });

  test('importJavaAgent() 2: Import agent with wrong type', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(2);
    try {
      await Agent.importJavaAgent(agentId, exportData);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(
        "Wrong agent type! Expected 'J2EEAgent' but got 'WebAgent'."
      );
    }
  });
});

describe('AgentOps - importWebAgent()', () => {
  test('importWebAgent() 0: Method is implemented', async () => {
    expect(Agent.importWebAgent).toBeDefined();
  });

  test('importWebAgent() 1: Import web agent "apacheagent"', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(4);
    await Agent.importWebAgent(agentId, exportData);
    expect(true).toBeTruthy();
  });

  test('importWebAgent() 2: Import agent with wrong type', async () => {
    const exportData = Agent.createAgentExportTemplate();
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    const agentData = getAgent(agentType, agentId);
    exportData.agents[agentId] = agentData;
    mockPutAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
        expect(isEqualJson(mockAgentObj, agentData, ['_rev'])).toBeTruthy();
      }
    );
    expect.assertions(2);
    try {
      await Agent.importWebAgent(agentId, exportData);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(
        "Wrong agent type! Expected 'WebAgent' but got 'IdentityGatewayAgent'."
      );
    }
  });
});

describe('AgentOps - deleteAgents()', () => {
  test('deleteAgents() 0: Method is implemented', async () => {
    expect(Agent.deleteAgents).toBeDefined();
  });

  test('deleteAgents() 1: Delete all agents', async () => {
    const agents = {
      ig_mytestrun_com: 'IdentityGatewayAgent',
      ig_chico: 'IdentityGatewayAgent',
      ajays_client: 'IdentityGatewayAgent',
      api_client: 'IdentityGatewayAgent',
      tomcatagent: 'J2EEAgent',
      javaAgent: 'J2EEAgent',
      apacheagent: 'WebAgent',
      webserver: 'WebAgent',
    };
    mockGetAgentsByType(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(28);
    await Agent.deleteAgents();
    expect(true).toBeTruthy();
  });
});

describe('AgentOps - deleteAgent()', () => {
  test('deleteAgent() 0: Method is implemented', async () => {
    expect(Agent.deleteAgent).toBeDefined();
  });

  test('deleteAgent() 1: Delete agent "ig_mytestrun_com" (gateway)', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockFindAgentById(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(5);
    await Agent.deleteAgent(agentId);
    expect(true).toBeTruthy();
  });

  test('deleteAgent() 2: Delete agent "tomcatagent" (java)', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockFindAgentById(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(5);
    await Agent.deleteAgent(agentId);
    expect(true).toBeTruthy();
  });

  test('deleteAgent() 3: Delete agent "apacheagent" (web)', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockFindAgentById(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(5);
    await Agent.deleteAgent(agentId);
    expect(true).toBeTruthy();
  });
});

describe('AgentOps - deleteIdentityGatewayAgents()', () => {
  test('deleteIdentityGatewayAgents() 0: Method is implemented', async () => {
    expect(Agent.deleteIdentityGatewayAgents).toBeDefined();
  });

  test('deleteIdentityGatewayAgents() 1: Delete all gateway agents', async () => {
    const agents = {
      ig_mytestrun_com: 'IdentityGatewayAgent',
      ig_chico: 'IdentityGatewayAgent',
      ajays_client: 'IdentityGatewayAgent',
      api_client: 'IdentityGatewayAgent',
    };
    mockGetAgentsByType(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(14);
    await Agent.deleteIdentityGatewayAgents();
    expect(true).toBeTruthy();
  });
});

describe('AgentOps - deleteIdentityGatewayAgent()', () => {
  test('deleteIdentityGatewayAgent() 0: Method is implemented', async () => {
    expect(Agent.deleteIdentityGatewayAgent).toBeDefined();
  });

  test('deleteIdentityGatewayAgent() 1: Delete gateway agent "ig_mytestrun_com"', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(5);
    await Agent.deleteIdentityGatewayAgent(agentId);
    expect(true).toBeTruthy();
  });

  test('deleteIdentityGatewayAgent() 2: Delete agent of wrong type "tomcatagent" (java)', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.deleteIdentityGatewayAgent(agentId);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(
        `Identity gateway agent '${agentId}' not found!`
      );
    }
  });

  test('deleteIdentityGatewayAgent() 3: Delete agent of wrong type "apacheagent" (web)', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.deleteIdentityGatewayAgent(agentId);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(
        `Identity gateway agent '${agentId}' not found!`
      );
    }
  });
});

describe('AgentOps - deleteJavaAgents()', () => {
  test('deleteJavaAgents() 0: Method is implemented', async () => {
    expect(Agent.deleteJavaAgents).toBeDefined();
  });

  test('deleteJavaAgents() 1: Delete all java agents', async () => {
    const agents = {
      tomcatagent: 'J2EEAgent',
      javaAgent: 'J2EEAgent',
    };
    mockGetAgentsByType(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(8);
    await Agent.deleteJavaAgents();
    expect(true).toBeTruthy();
  });
});

describe('AgentOps - deleteJavaAgent()', () => {
  test('deleteJavaAgent() 0: Method is implemented', async () => {
    expect(Agent.deleteJavaAgent).toBeDefined();
  });

  test('deleteJavaAgent() 1: Delete java agent "tomcatagent"', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(5);
    await Agent.deleteJavaAgent(agentId);
    expect(true).toBeTruthy();
  });

  test('deleteJavaAgent() 2: Delete agent of wrong type "ig_mytestrun_com" (gateway)', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.deleteJavaAgent(agentId);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(`Java agent '${agentId}' not found!`);
    }
  });

  test('deleteJavaAgent() 3: Delete agent of wrong type "apacheagent" (web)', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.deleteJavaAgent(agentId);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(`Java agent '${agentId}' not found!`);
    }
  });
});

describe('AgentOps - deleteWebAgents()', () => {
  test('deleteWebAgents() 0: Method is implemented', async () => {
    expect(Agent.deleteWebAgents).toBeDefined();
  });

  test('deleteWebAgents() 1: Delete all web agents', async () => {
    const agents = {
      apacheagent: 'WebAgent',
      webserver: 'WebAgent',
    };
    mockGetAgentsByType(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(Object.values(agents)).toContain(mockAgentType);
        expect(Object.keys(agents)).toContain(mockAgentId);
      }
    );
    expect.assertions(8);
    await Agent.deleteWebAgents();
    expect(true).toBeTruthy();
  });
});

describe('AgentOps - deleteWebAgent()', () => {
  test('deleteWebAgent() 0: Method is implemented', async () => {
    expect(Agent.deleteWebAgent).toBeDefined();
  });

  test('deleteWebAgent() 1: Delete web agent "apacheagent"', async () => {
    const agentType = 'WebAgent';
    const agentId = 'apacheagent';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(5);
    await Agent.deleteWebAgent(agentId);
    expect(true).toBeTruthy();
  });

  test('deleteWebAgent() 2: Delete agent of wrong type "ig_mytestrun_com" (gateway)', async () => {
    const agentType = 'IdentityGatewayAgent';
    const agentId = 'ig_mytestrun_com';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.deleteWebAgent(agentId);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(`Web agent '${agentId}' not found!`);
    }
  });

  test('deleteWebAgent() 3: Delete agent of wrong type "tomcatagent" (java)', async () => {
    const agentType = 'J2EEAgent';
    const agentId = 'tomcatagent';
    mockFindAgentByTypeAndId(mock);
    mockDeleteAgentByTypeAndId(
      mock,
      (mockAgentType, mockAgentId, mockAgentObj) => {
        expect(mockAgentObj).toBeTruthy();
        expect(agentType).toBe(mockAgentType);
        expect(agentId).toBe(mockAgentId);
      }
    );
    expect.assertions(2);
    try {
      await Agent.deleteWebAgent(agentId);
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe(`Web agent '${agentId}' not found!`);
    }
  });
});
