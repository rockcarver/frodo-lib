'use strict';
// A plain CommonJS program: destructure the require() result, build instances, throw and catch FrodoError.
const { report, fail, PKG, HOST } = require('./h.js');
try {
  const { frodo, state, FrodoError } = require(PKG);
  const admin = frodo.createInstanceWithAdminAccount(HOST, 'admin', 'secret');
  const service = frodo.createInstanceWithServiceAccount(
    HOST,
    'service-account-id',
    JSON.stringify({ kty: 'RSA', alg: 'RS256' })
  );
  const plain = frodo.createInstance({
    host: HOST,
    username: 'admin',
    password: 'secret',
  });
  class MyError extends FrodoError {}
  const e = new FrodoError('boom');
  const sub = new MyError('sub');
  const ok =
    typeof frodo === 'object' &&
    typeof state === 'object' &&
    typeof frodo.login.getTokens === 'function' &&
    typeof state.setHost === 'function' &&
    [admin, service, plain].every(
      (i) =>
        typeof i.login.getTokens === 'function' &&
        typeof i.info.getInfo === 'function'
    ) &&
    e instanceof FrodoError &&
    e instanceof Error &&
    sub instanceof FrodoError &&
    e.message.includes('boom');
  report('p01-destructure', ok, { errorName: FrodoError.name });
} catch (e) {
  fail('p01-destructure', e);
}
