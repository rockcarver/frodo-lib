'use strict';
// One copy of the library per process: require twice and import() give the same state, facade and error class.
const { report, fail, PKG, HOST } = require('./h.js');
(async () => {
  try {
    const a = require(PKG);
    const b = require(PKG);
    const ns = await import(PKG);
    a.state.setHost(HOST);
    const keys = Object.keys(ns).sort();
    const ok =
      a === b &&
      ns.state === a.state &&
      ns.frodo === a.frodo &&
      ns.FrodoError === a.FrodoError &&
      ns['module.exports'] === a &&
      ns.state.getHost() === HOST &&
      keys.join() === 'FrodoError,frodo,module.exports,state' &&
      !('default' in ns);
    report('p04-single-state', ok, { keys });
  } catch (e) {
    fail('p04-single-state', e);
  }
})();
