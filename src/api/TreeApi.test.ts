import { TreeRaw } from '../index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import autoSetupPolly from '../utils/AutoSetupPolly';

const context = autoSetupPolly();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('TreeApi', () => {
  describe('getTrees()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeRaw.getTrees).toBeDefined();
    });

    test('1: Get all trees', async () => {
      console.dir(context.polly);
      const response = await TreeRaw.getTrees();
      expect(response).toMatchSnapshot();
    });
  });

  describe('getTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeRaw.getTree).toBeDefined();
    });

    test('1: Get existing tree', async () => {
      const response = await TreeRaw.getTree('FrodoTest');
      expect(response).toMatchSnapshot();
    });

    test('2: Get non-existing tree', async () => {
      try {
        await TreeRaw.getTree('DoesNotExist');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('putTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeRaw.putTree).toBeDefined();
    });

    test('1: Put valid tree', async () => {
      const treeData = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            '../test/mocks/TreeApi/putTree/FrodoTest.json'
          ),
          'utf8'
        )
      );
      const response = await TreeRaw.putTree('FrodoTest', treeData);
      expect(response).toMatchSnapshot();
    });

    test('2: Put invalid tree [trailing data]', async () => {
      const treeData = fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/TreeApi/putTree/Invalid_trailing-data.txt'
        ),
        'utf8'
      );
      try {
        await TreeRaw.putTree('Invalid', treeData);
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('3: Put invalid tree [invalid attribute]', async () => {
      const treeData = fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/TreeApi/putTree/Invalid_invalid-attribute.json'
        ),
        'utf8'
      );
      try {
        await TreeRaw.putTree('Invalid', treeData);
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('4: Put invalid tree [no entry node]', async () => {
      const treeData = fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/TreeApi/putTree/Invalid_no-entry-node.json'
        ),
        'utf8'
      );
      try {
        await TreeRaw.putTree('Invalid', treeData);
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });

    test('5: Put invalid tree [invalid nodes]', async () => {
      const treeData = fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/TreeApi/putTree/Invalid_invalid-nodes.json'
        ),
        'utf8'
      );
      try {
        await TreeRaw.putTree('Invalid', treeData);
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });

  describe('deleteTree()', () => {
    test('0: Method is implemented', async () => {
      expect(TreeRaw.deleteTree).toBeDefined();
    });

    test('1: Delete existing tree', async () => {
      const response = await TreeRaw.deleteTree('FrodoTest');
      expect(response).toMatchSnapshot();
    });

    test('2: Delete non-existing tree', async () => {
      try {
        await TreeRaw.deleteTree('DoesNotExist');
      } catch (error) {
        expect(error.response.data).toMatchSnapshot();
      }
    });
  });
});
