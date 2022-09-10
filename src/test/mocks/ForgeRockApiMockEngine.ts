import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function mockGetTree(mock: MockAdapter) {
  mock
    .onGet(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/trees\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const treeId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, `./TreeApi/getTree/${treeId}.json`),
          'utf8'
        )
      );
      expect(mockResponse._id).toBe(treeId);
      return [mockStatus, mockResponse];
    });
}

export function mockGetNode(mock: MockAdapter) {
  mock
    .onGet(
      /\/json\/realms\/root\/realms\/alpha\/realm-config\/authentication\/authenticationtrees\/nodes\/.+/
    )
    .reply(function (config) {
      const elements = config.url ? config.url.split('/') : [];
      const nodeType = elements[elements?.length - 2];
      const nodeId = elements[elements?.length - 1];
      const mockStatus = 200;
      const mockResponse = JSON.parse(
        fs.readFileSync(
          path.resolve(
            __dirname,
            `./NodeApi/getNode/${nodeType}/${nodeId}.json`
          ),
          'utf8'
        )
      );
      expect(mockResponse._id).toBe(nodeId);
      return [mockStatus, mockResponse];
    });
}
