'use strict';
// What a CommonJS program may do with the object that require() returns: patch it, replace members, add and delete
// keys. None of it reaches the importers: `import` shows the module namespace, whose named exports do not change.
const { report, fail, PKG } = require('./h.js');
(async () => {
  try {
    const lib = require(PKG);
    const originalFrodo = lib.frodo;
    const originalState = lib.state;

    // nested patching of the facade and of the state
    const getTokens = lib.frodo.login.getTokens;
    lib.frodo.login.getTokens = () => 'stub';
    const nested = lib.frodo.login.getTokens() === 'stub';
    lib.frodo.login.getTokens = getTokens;

    // assigning, defining, adding and deleting top-level keys
    const stub = { stub: true };
    lib.frodo = stub;
    Object.defineProperty(lib, 'state', { value: stub, configurable: true });
    lib.extra = 1;
    delete lib.FrodoError;
    const changed =
      lib.frodo === stub &&
      lib.state === stub &&
      lib.extra === 1 &&
      !('FrodoError' in lib);

    const ns = await import(PKG);
    const importersUnaffected =
      ns.frodo === originalFrodo &&
      ns.state === originalState &&
      ns.frodo !== stub;
    report('p03-mutate', nested && changed && importersUnaffected, {
      nested,
      changed,
      importersUnaffected,
    });
  } catch (e) {
    fail('p03-mutate', e);
  }
})();
