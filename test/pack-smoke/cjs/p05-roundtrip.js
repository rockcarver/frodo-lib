'use strict';
// A login round trip against a fake classic AM on 127.0.0.1, through the default state and through a second instance.
const { report, fail, PKG } = require('./h.js');
const { start } = require('../fakeAm.cjs');
(async () => {
  let server;
  try {
    const { frodo, state } = require(PKG);
    const fake = await start();
    server = fake.server;
    const host = `http://127.0.0.1:${fake.port}/am`;
    state.setHost(host);
    state.setDeploymentType('classic');
    state.setUsername('amadmin');
    state.setPassword('secret');
    state.setRealm('/');
    const tokens = await frodo.login.getTokens();
    const instance = frodo.createInstance({
      host,
      username: 'amadmin',
      password: 'secret',
      deploymentType: 'classic',
    });
    const other = await instance.login.getTokens();
    const ok =
      !!tokens &&
      !!other &&
      state.getCookieValue() === 'FAKE-SESSION-TOKEN' &&
      instance.state.getCookieValue() === 'FAKE-SESSION-TOKEN' &&
      instance.state !== state;
    report('p05-roundtrip', ok, { requests: fake.log.length });
  } catch (e) {
    fail('p05-roundtrip', e);
  } finally {
    if (server) server.close();
  }
})();
