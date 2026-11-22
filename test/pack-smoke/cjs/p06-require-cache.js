'use strict';
// Clearing require.cache does not give a fresh library: the second require() returns the same module, state kept.
// This documents a break against the CommonJS build (see MIGRATION.md); if Node.js changes it, this probe fails.
const { report, fail, PKG, HOST } = require('./h.js');
try {
  const a = require(PKG);
  const file = require.resolve(PKG);
  a.state.setHost(HOST);
  const inCache = !!require.cache[file];
  delete require.cache[file];
  const b = require(PKG);
  const sameObject = a === b;
  const stateKept = b.state.getHost() === HOST;
  report('p06-require-cache', inCache && sameObject && stateKept, {
    inCache,
    sameObject,
    stateKept,
  });
} catch (e) {
  fail('p06-require-cache', e);
}
