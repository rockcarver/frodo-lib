import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TreeRaw, state } from '../index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mock = new MockAdapter(axios);

state.default.session.setTenant('');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');

describe('TreeApi - getTrees()', () => {
  test('getTrees() 0: Method is implemented', async () => {
    expect(TreeRaw.getTrees).toBeDefined();
  });

  test('getTrees() 1: Get all trees', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../test/mocks/TreeApi/getTrees/trees.json'),
        'utf8'
      )
    );
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees?_queryFilter=true'
      )
      .reply(200, response);
    const trees = await TreeRaw.getTrees();
    expect(trees).toBeTruthy();
    expect(trees).toMatchSnapshot();
  });
});

describe('TreeApi - getTree()', () => {
  test('getTree() 0: Method is implemented', async () => {
    expect(TreeRaw.getTree).toBeDefined();
  });

  test('getTree() 1: Get existing tree', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../test/mocks/TreeApi/getTree/FrodoTest.json'),
        'utf8'
      )
    );
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/FrodoTest'
      )
      .reply(200, response);
    const tree = await TreeRaw.getTree('FrodoTest');
    expect(tree).toBeTruthy();
    expect(tree).toMatchSnapshot();
  });

  test('getTree() 2: Get non-existing tree', async () => {
    mock
      .onGet(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/DoesNotExist'
      )
      .reply(404, {
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    try {
      await TreeRaw.getTree('DoesNotExist');
    } catch (error) {
      expect(error.response.data).toMatchSnapshot();
    }
  });
});

describe('TreeApi - putTree()', () => {
  test('putTree() 0: Method is implemented', async () => {
    expect(TreeRaw.putTree).toBeDefined();
  });

  test('putTree() 1: Put valid tree', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../test/mocks/TreeApi/putTree/FrodoTest.json'),
        'utf8'
      )
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/FrodoTest'
      )
      .reply(201, response);
    const tree = await TreeRaw.putTree('FrodoTest', response);
    expect(tree).toBeTruthy();
    expect(tree).toMatchSnapshot();
  });

  test('putTree() 2: Put invalid tree [trailing data]', async () => {
    const request = fs.readFileSync(
      path.resolve(
        __dirname,
        '../test/mocks/TreeApi/putTree/Invalid_trailing-data.txt'
      ),
      'utf8'
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/Invalid'
      )
      .reply(400, {
        code: 400,
        reason: 'Bad Request',
        message:
          'The request could not be processed because there is trailing data after the JSON content',
      });
    expect.assertions(2);
    try {
      await TreeRaw.putTree('Invalid', request);
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchSnapshot();
    }
  });

  test('putTree() 3: Put invalid tree [invalid attribute]', async () => {
    const request = fs.readFileSync(
      path.resolve(
        __dirname,
        '../test/mocks/TreeApi/putTree/Invalid_invalid-attribute.json'
      ),
      'utf8'
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/Invalid'
      )
      .reply(400, {
        code: 400,
        reason: 'Bad Request',
        message: 'Invalid attribute specified.',
        detail: {
          validAttributes: [
            'description',
            'enabled',
            'entryNodeId',
            'identityResource',
            'nodes',
            'staticNodes',
            'uiConfig',
          ],
        },
      });
    expect.assertions(2);
    try {
      await TreeRaw.putTree('Invalid', request);
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchSnapshot();
    }
  });

  test('putTree() 4: Put invalid tree [no entry node]', async () => {
    const request = fs.readFileSync(
      path.resolve(
        __dirname,
        '../test/mocks/TreeApi/putTree/Invalid_no-entry-node.json'
      ),
      'utf8'
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/Invalid'
      )
      .reply(400, {
        code: 400,
        reason: 'Bad Request',
        message: 'Node with ID entryNodeId must exist in the tree.',
      });
    expect.assertions(2);
    try {
      await TreeRaw.putTree('Invalid', request);
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchSnapshot();
    }
  });

  test('putTree() 5: Put invalid tree [invalid nodes]', async () => {
    const request = fs.readFileSync(
      path.resolve(
        __dirname,
        '../test/mocks/TreeApi/putTree/Invalid_invalid-nodes.json'
      ),
      'utf8'
    );
    mock
      .onPut(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/Invalid'
      )
      .reply(400, {
        code: 400,
        reason: 'Bad Request',
        message: 'Node with ID entryNodeId must exist in the tree.',
      });
    expect.assertions(2);
    try {
      await TreeRaw.putTree('Invalid', request);
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchSnapshot();
    }
  });
});

describe('TreeApi - deleteTree()', () => {
  test('deleteTree() 0: Method is implemented', async () => {
    expect(TreeRaw.deleteTree).toBeDefined();
  });

  test('deleteTree() 1: Delete existing tree', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/TreeApi/deleteTree/FrodoTest.json'
        ),
        'utf8'
      )
    );
    mock
      .onDelete(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/FrodoTest'
      )
      .reply(200, response);
    const tree = await TreeRaw.deleteTree('FrodoTest');
    expect(tree).toBeTruthy();
    expect(tree).toMatchSnapshot();
  });

  test('deleteTree() 2: Delete non-existing tree', async () => {
    mock
      .onDelete(
        '/json/realms/root/realms/alpha/realm-config/authentication/authenticationtrees/trees/DoesNotExist'
      )
      .reply(404, {
        code: 404,
        reason: 'Not Found',
        message: 'Not Found',
      });
    expect.assertions(2);
    try {
      await TreeRaw.deleteTree('DoesNotExist');
    } catch (error) {
      expect(error.response).toBeTruthy();
      expect(error.response.data).toMatchSnapshot();
    }
  });
});
