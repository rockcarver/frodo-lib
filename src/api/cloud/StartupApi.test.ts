/**
 * Run tests
 *
 *        npm run test StartupApi
 *
 * Note: FRODO_DEBUG=1 is optional and enables debug logging for some output
 * in case things don't function as expected
 */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import * as StartupApi from './StartupApi';
import { state } from '../../index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mock = new MockAdapter(axios);

state.setHost('https://openam-frodo-dev.forgeblocks.com/am');
state.setRealm('alpha');
state.setCookieName('cookieName');
state.setUserSessionTokenMeta({
  tokenId: 'cookieValue',
  realm: '/realm',
  successUrl: 'url',
  expires: 0,
});

describe('StartupApi - getStatus()', () => {
  test('getStatus() 1: Get restart status - expect "ready"', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/StartupApi/getStatus/ready.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/startup')
      .reply(200, response);
    const status = await StartupApi.getStatus({ state });
    expect(status in StartupApi.RestartStatus).toBeTruthy();
    expect(status).toBe(StartupApi.RestartStatus.ready);
  });

  test('getStatus() 2: Get restart status - expect "restarting"', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/StartupApi/getStatus/restarting.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/startup')
      .reply(200, response);
    const status = await StartupApi.getStatus({ state });
    expect(status in StartupApi.RestartStatus).toBeTruthy();
    expect(status).toBe(StartupApi.RestartStatus.restarting);
  });
});

describe('StartupApi - initiateRestart()', () => {
  test('initiateRestart() 1: Initiate restart - expect "ready" -> "restarting"', async () => {
    const response1 = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/StartupApi/getStatus/ready.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/startup')
      .reply(200, response1);
    const response2 = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/StartupApi/initiateRestart/restarting.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/startup?_action=restart'
      )
      .reply(200, response2);
    const status = await StartupApi.initiateRestart({ state });
    expect(status in StartupApi.RestartStatus).toBeTruthy();
    expect(status).toBe(StartupApi.RestartStatus.restarting);
  });

  test('initiateRestart() 2: Initiate restart - expect "restarting" -> exception', async () => {
    const response1 = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/StartupApi/getStatus/restarting.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/startup')
      .reply(200, response1);
    const response2 = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../test/mocks/StartupApi/initiateRestart/restarting.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/startup?_action=restart'
      )
      .reply(200, response2);
    expect.assertions(2);
    try {
      await StartupApi.initiateRestart({ state });
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe('Not ready! Current status: restarting');
    }
  });
});
