import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { SecretsRaw, state } from '../index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');

describe('SecretsApi - getSecrets()', () => {
  test('getSecrets() 1: Get all secrets - success', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/getSecrets/secrets.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/secrets')
      .reply(200, mockResponse);
    const response = await SecretsRaw.getSecrets();
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('getSecrets() 2: Get all secrets - error', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/getSecrets/error.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/secrets')
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.getSecrets();
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });
});

describe('SecretsApi - getSecret()', () => {
  test('getSecret() 1: Get existing secret: esv-volkerstestsecret1', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/getSecret/esv-volkerstestsecret1.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.getSecret('esv-volkerstestsecret1');
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('getSecret() 2: Get non-existing secret: esv-does-not-exist', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/getSecret/esv-does-not-exist.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-does-not-exist'
      )
      .reply(404, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.getSecret('esv-does-not-exist');
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(404);
      expect(error.response.data.code).toBe(404);
      expect(error.response.data.message).toBe(
        'The secret does not exist or does not have a version'
      );
    }
  });
});

describe('SecretsApi - putSecret()', () => {
  test('putSecret() 1: Create secret: esv-volkerstestsecret1 - success', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/putSecret/esv-volkerstestsecret1.json'
        ),
        'utf8'
      )
    );
    mock
      .onPut(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.putSecret(
      'esv-volkerstestsecret1',
      "Volker's Test Secret Value",
      "Volker's Test Secret Description",
      'generic',
      true
    );
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('putSecret() 2: Create secret: esv-volkerstestsecret1 - error', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/putSecret/error.json'
        ),
        'utf8'
      )
    );
    mock
      .onPut(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.putSecret(
        'esv-volkerstestsecret1',
        "Volker's Test Secret Value",
        "Volker's Test Secret Description",
        'generic',
        true
      );
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });
});

describe('SecretsApi - setSecretDescription()', () => {
  test('setSecretDescription() 1: Set secret description: esv-volkerstestsecret1 - success', async () => {
    const mockResponse = '';
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1?_action=setDescription'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.setSecretDescription(
      'esv-volkerstestsecret1',
      "Volker's Updated Test Secret Description"
    );
    expect(response).toBe('');
  });

  test('setSecretDescription() 2: Set secret description: esv-volkerstestsecret1 - error', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/setSecretDescription/error.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1?_action=setDescription'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.setSecretDescription(
        'esv-volkerstestsecret1',
        "Volker's Updated Test Secret Description"
      );
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });
});

describe('SecretsApi - deleteSecret()', () => {
  test('deleteSecret() 1: Delete secret: esv-volkerstestsecret1 - success', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/deleteSecret/esv-volkerstestsecret1.json'
        ),
        'utf8'
      )
    );
    mock
      .onDelete(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.deleteSecret('esv-volkerstestsecret1');
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('deleteSecret() 2: Delete secret: esv-volkerstestsecret1 - error', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/deleteSecret/error.json'
        ),
        'utf8'
      )
    );
    mock
      .onDelete(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.deleteSecret('esv-volkerstestsecret1');
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });
});

describe('SecretsApi - getSecretVersions()', () => {
  test('getSecretVersions() 1: Get versions of existing secret: esv-volkerstestsecret1', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/getSecretVersions/esv-volkerstestsecret1.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.getSecretVersions(
      'esv-volkerstestsecret1'
    );
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('getSecretVersions() 2: Get versions of non-existing secret: esv-does-not-exist', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/getSecretVersions/esv-does-not-exist.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-does-not-exist/versions'
      )
      .reply(404, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.getSecretVersions('esv-does-not-exist');
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(404);
      expect(error.response.data.code).toBe(404);
      expect(error.response.data.message).toBe(
        'The secret does not exist or does not have a version'
      );
    }
  });
});

describe('SecretsApi - createNewVersionOfSecret()', () => {
  test('createNewVersionOfSecret() 1: Create new version of existing secret: esv-volkerstestsecret1 - success', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/createNewVersionOfSecret/esv-volkerstestsecret1.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions?_action=create'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.createNewVersionOfSecret(
      'esv-volkerstestsecret1',
      "Volker's Test Secret Value"
    );
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('createNewVersionOfSecret() 2: Create new version of existing secret: esv-volkerstestsecret1 - error', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/createNewVersionOfSecret/error.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions?_action=create'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.createNewVersionOfSecret(
        'esv-volkerstestsecret1',
        "Volker's Test Secret Value"
      );
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });

  test('createNewVersionOfSecret() 3: Create new version of non-existing secret: esv-does-not-exist - error', async () => {
    const mockResponse = fs.readFileSync(
      path.resolve(
        __dirname,
        '../test/mocks/SecretsApi/createNewVersionOfSecret/esv-does-not-exist.txt'
      ),
      'utf8'
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions?_action=create'
      )
      .reply(500, mockResponse);
    expect.assertions(3);
    try {
      await SecretsRaw.createNewVersionOfSecret(
        'esv-volkerstestsecret1',
        "Volker's Test Secret Value"
      );
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data).toBe(mockResponse);
    }
  });
});

describe('SecretsApi - getVersionOfSecret()', () => {
  test('getVersionOfSecret() 1: Get version 2 of existing secret: esv-volkerstestsecret1', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/getVersionOfSecret/esv-volkerstestsecret1_v2.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions/2'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.getVersionOfSecret(
      'esv-volkerstestsecret1',
      '2'
    );
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('getVersionOfSecret() 2: Get version 2 of non-existing secret: esv-does-not-exist', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/getVersionOfSecret/esv-does-not-exist_v2.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-does-not-exist/versions/2'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.getVersionOfSecret('esv-does-not-exist', '2');
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe(
        'Failed to update secret version'
      );
    }
  });
});

describe('SecretsApi - setStatusOfVersionOfSecret()', () => {
  test('setStatusOfVersionOfSecret() 1: Disable version 2 of existing secret: esv-volkerstestsecret1 - success', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/setStatusOfVersionOfSecret/esv-volkerstestsecret1_v2_DISABLED.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions/2?_action=changestatus'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.setStatusOfVersionOfSecret(
      'esv-volkerstestsecret1',
      '2',
      SecretsRaw.VersionOfSecretStatus.DISABLED
    );
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('setStatusOfVersionOfSecret() 2: Disable version 2 of existing secret: esv-volkerstestsecret1 - error', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/setStatusOfVersionOfSecret/error.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions/2?_action=changestatus'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.setStatusOfVersionOfSecret(
        'esv-volkerstestsecret1',
        '2',
        SecretsRaw.VersionOfSecretStatus.DISABLED
      );
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });

  test('setStatusOfVersionOfSecret() 3: Disable version 2 of non-existing secret: esv-does-not-exist - error', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/setStatusOfVersionOfSecret/esv-does-not-exist_v2_DISABLED.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-does-not-exist/versions/2?_action=changestatus'
      )
      .reply(404, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.setStatusOfVersionOfSecret(
        'esv-does-not-exist',
        '2',
        SecretsRaw.VersionOfSecretStatus.DISABLED
      );
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(404);
      expect(error.response.data.code).toBe(404);
      expect(error.response.data.message).toBe(
        'The secret does not exist or does not have a version'
      );
    }
  });
});

describe('SecretsApi - deleteVersionOfSecret()', () => {
  test('deleteVersionOfSecret() 1: Delete version 2 of secret: esv-volkerstestsecret1 - success', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/deleteVersionOfSecret/esv-volkerstestsecret1_v2.json'
        ),
        'utf8'
      )
    );
    mock
      .onDelete(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions/2'
      )
      .reply(200, mockResponse);
    const response = await SecretsRaw.deleteVersionOfSecret(
      'esv-volkerstestsecret1',
      '2'
    );
    expect(response).toBeTruthy();
    expect(response).toMatchObject(mockResponse);
  });

  test('deleteVersionOfSecret() 2: Delete version 2 of secret: esv-volkerstestsecret1 - error', async () => {
    const mockResponse = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/SecretsApi/deleteVersionOfSecret/error.json'
        ),
        'utf8'
      )
    );
    mock
      .onDelete(
        'https://openam-frodo-dev.forgeblocks.com/environment/secrets/esv-volkerstestsecret1/versions/2'
      )
      .reply(500, mockResponse);
    expect.assertions(4);
    try {
      await SecretsRaw.deleteVersionOfSecret('esv-volkerstestsecret1', '2');
    } catch (error) {
      // console.dir(error);
      expect(error).toBeTruthy();
      expect(error.response.status).toBe(500);
      expect(error.response.data.code).toBe(500);
      expect(error.response.data.message).toBe('Server Error');
    }
  });
});
