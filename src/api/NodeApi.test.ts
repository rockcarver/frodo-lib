import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { NodeRaw, state } from '../index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mock = new MockAdapter(axios);

state.default.session.setTenant('');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');

describe('NodeApi - getNodeTypes()', () => {
  test('getNodeTypes() 1: Get all node types', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/getNodeTypes/types.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes?_action=getAllTypes'
      )
      .reply(200, response);
    const types = await NodeRaw.getNodeTypes();
    expect(types).toBeTruthy();
    expect(types.length).toBe(99);
  });
});

describe('NodeApi - getNodesByType()', () => {
  test('getNodesByType() 1: Get all page nodes', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/getNodesByType/PageNode.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode?_queryFilter=true'
      )
      .reply(200, response);
    const nodes = await NodeRaw.getNodesByType('PageNode');
    expect(nodes).toBeTruthy();
    expect(nodes.length).toBe(161);
  });
});

describe('NodeApi - getNode()', () => {
  test('getNode() 1: Get existing page node [1aea363f-d8d2-4711-b88d-d58fff92dbae]', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/getNode/PageNode_1aea363f-d8d2-4711-b88d-d58fff92dbae.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/1aea363f-d8d2-4711-b88d-d58fff92dbae'
      )
      .reply(200, response);
    const node = await NodeRaw.getNode(
      '1aea363f-d8d2-4711-b88d-d58fff92dbae',
      'PageNode'
    );
    expect(node).toBeTruthy();
    expect(node).toMatchObject(response);
  });

  test('getNode() 2: Get non-existing page node [00000000-0000-0000-0000-000000000000]', async () => {
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/00000000-0000-0000-0000-000000000000'
      )
      .reply(404, {
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    expect.assertions(2);
    try {
      await NodeRaw.getNode('00000000-0000-0000-0000-000000000000', 'PageNode');
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchObject({
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    }
  });
});

describe('NodeApi - putNode()', () => {
  test('putNode() 1: Create page node [0ad90971-d08a-4af3-86f3-01729572dc8f]', async () => {
    const nodeData = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/putNode/PageNode_0ad90971-d08a-4af3-86f3-01729572dc8f.json'
        ),
        'utf8'
      )
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/0ad90971-d08a-4af3-86f3-01729572dc8f'
      )
      .reply(201, nodeData);
    const node = await NodeRaw.putNode(
      '0ad90971-d08a-4af3-86f3-01729572dc8f',
      'PageNode',
      nodeData
    );
    expect(node).toBeTruthy();
    expect(node).toMatchObject(nodeData);
  });

  test('putNode() 1: Update existing page node [1aea363f-d8d2-4711-b88d-d58fff92dbae]', async () => {
    const nodeData = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/putNode/PageNode_1aea363f-d8d2-4711-b88d-d58fff92dbae.json'
        ),
        'utf8'
      )
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/1aea363f-d8d2-4711-b88d-d58fff92dbae'
      )
      .reply(200, nodeData);
    const node = await NodeRaw.putNode(
      '1aea363f-d8d2-4711-b88d-d58fff92dbae',
      'PageNode',
      nodeData
    );
    expect(node).toBeTruthy();
    expect(node).toMatchObject(nodeData);
  });
});

describe('NodeApi - deleteNode()', () => {
  test('deleteNode() 1: Delete existing node [1aea363f-d8d2-4711-b88d-d58fff92dbae]', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/NodeApi/deleteNode/PageNode_1aea363f-d8d2-4711-b88d-d58fff92dbae.json'
        ),
        'utf8'
      )
    );
    mock
      .onDelete(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/1aea363f-d8d2-4711-b88d-d58fff92dbae'
      )
      .reply(200, response);
    const node = await NodeRaw.deleteNode(
      '1aea363f-d8d2-4711-b88d-d58fff92dbae',
      'PageNode'
    );
    expect(node).toBeTruthy();
    expect(node._id).toEqual('1aea363f-d8d2-4711-b88d-d58fff92dbae');
  });

  test('deleteNode() 2: Delete non-existing node [00000000-0000-0000-0000-000000000000]', async () => {
    mock
      .onDelete(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/nodes/PageNode/00000000-0000-0000-0000-000000000000'
      )
      .reply(404, {
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    expect.assertions(2);
    try {
      await NodeRaw.deleteNode(
        '00000000-0000-0000-0000-000000000000',
        'PageNode'
      );
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchObject({
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    }
  });
});
