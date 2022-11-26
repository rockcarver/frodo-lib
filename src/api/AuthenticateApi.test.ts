import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { AuthenticateRaw, state } from '../index';
import * as global from '../storage/StaticStorage';
import {
  getTreeStepResponse,
  mockStep,
} from '../test/mocks/ForgeRockApiMockEngine';

const mock = new MockAdapter(axios);

state.default.session.setTenant('https://openam-frodo-dev.forgeblocks.com/am');
state.default.session.setUsername('volker.scheuber@forgerock.com');
state.default.session.setPassword('Sup3rS3cr3t!');
state.default.session.setRealm('alpha');
state.default.session.setCookieName('cookieName');
state.default.session.setCookieValue('cookieValue');
state.default.session.setDeploymentType(global.CLOUD_DEPLOYMENT_TYPE_KEY);

describe.only('AuthenticateApi - step()', () => {
  test('step() 0: Method is implemented', async () => {
    expect(AuthenticateRaw.step).toBeDefined();
  });

  test('step() 1: Initial step - get callbacks', async () => {
    mockStep(mock);
    const config = {
      headers: {
        'X-OpenAM-Username': state.default.session.getUsername(),
        'X-OpenAM-Password': state.default.session.getPassword(),
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
