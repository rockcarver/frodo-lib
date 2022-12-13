import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { AuthenticateRaw, state } from '../index';
import * as global from '../storage/StaticStorage';
import {
  getTreeStepResponse,
  mockStep,
} from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.setHost('https://openam-frodo-dev.forgeblocks.com/am');
state.setUsername('volker.scheuber@forgerock.com');
state.setPassword('Sup3rS3cr3t!');
state.setRealm('alpha');
state.setCookieName('cookieName');
state.setCookieValue('cookieValue');
state.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe.only('AuthenticateApi - step()', () => {
  test('step() 0: Method is implemented', async () => {
    expect(AuthenticateRaw.step).toBeDefined();
  });

  test('step() 1: Initial step - get callbacks', async () => {
    mockStep(mock);
    const config = {
      headers: {
        'X-OpenAM-Username': state.getUsername(),
        'X-OpenAM-Password': state.getPassword(),
      },
    };
    const response = await AuthenticateRaw.step({}, config);
    expect(response.authId).toBeTruthy();
    expect(response.callbacks).toBeTruthy();
  });

  test('step() 2: Final step - get session', async () => {
    const body = getTreeStepResponse(undefined, undefined);
    mockStep(mock);
    const response = await AuthenticateRaw.step(body);
    expect(response.authId).toBeFalsy();
    expect(response.callbacks).toBeFalsy();
    expect(response.tokenId).toBeTruthy();
  });
});
