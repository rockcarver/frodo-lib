import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { StartupRaw, state } from '../index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mock = new MockAdapter(axios);

state.setHost('https://openam-frodo-dev.forgeblocks.com/am');
state.setRealm('alpha');
state.setCookieName('cookieName');
state.setCookieValue('cookieValue');

describe('StartupApi - getStatus()', () => {
  test('getStatus() 1: Get restart status - expect "ready"', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/StartupApi/getStatus/ready.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/startup')
      .reply(200, response);
    const status = await StartupRaw.getStatus();
    expect(status in StartupRaw.RestartStatus).toBeTruthy();
    expect(status).toBe(StartupRaw.RestartStatus.ready);
  });

  test('getStatus() 2: Get restart status - expect "restarting"', async () => {
    const response = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/StartupApi/getStatus/restarting.json'
        ),
        'utf8'
      )
    );
    mock
      .onGet('https://openam-frodo-dev.forgeblocks.com/environment/startup')
      .reply(200, response);
    const status = await StartupRaw.getStatus();
    expect(status in StartupRaw.RestartStatus).toBeTruthy();
    expect(status).toBe(StartupRaw.RestartStatus.restarting);
  });
});

describe('StartupApi - initiateRestart()', () => {
  test('initiateRestart() 1: Initiate restart - expect "ready" -> "restarting"', async () => {
    const response1 = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/StartupApi/getStatus/ready.json'
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
          '../test/mocks/StartupApi/initiateRestart/restarting.json'
        ),
        'utf8'
      )
    );
    mock
      .onPost(
        'https://openam-frodo-dev.forgeblocks.com/environment/startup?_action=restart'
      )
      .reply(200, response2);
    const status = await StartupRaw.initiateRestart();
    expect(status in StartupRaw.RestartStatus).toBeTruthy();
    expect(status).toBe(StartupRaw.RestartStatus.restarting);
  });

  test('initiateRestart() 2: Initiate restart - expect "restarting" -> exception', async () => {
    const response1 = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../test/mocks/StartupApi/getStatus/restarting.json'
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
          '../test/mocks/StartupApi/initiateRestart/restarting.json'
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
      await StartupRaw.initiateRestart();
    } catch (error) {
      expect(error).toBeTruthy();
      expect(error.message).toBe('Not ready! Current status: restarting');
    }
  });
});
