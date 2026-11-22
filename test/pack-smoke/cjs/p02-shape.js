'use strict';
// The shape of what require() returns: three keys, a plain object, no default, no __esModule.
const { report, fail, PKG } = require('./h.js');
try {
  const lib = require(PKG);
  const keys = Object.keys(lib).sort();
  const ok =
    keys.join() === 'FrodoError,frodo,state' &&
    typeof lib.frodo === 'object' &&
    typeof lib.state === 'object' &&
    typeof lib.FrodoError === 'function' &&
    !('default' in lib) &&
    lib.__esModule === undefined &&
    Object.getPrototypeOf(lib) === Object.prototype &&
    lib.hasOwnProperty('frodo') &&
    Object.hasOwn(lib, 'state') &&
    String(lib) === '[object Object]' &&
    Object.keys({ ...lib })
      .sort()
      .join() === keys.join() &&
    Object.keys(Object.assign({}, lib)).sort().join() === keys.join();
  report('p02-shape', ok, { keys });
} catch (e) {
  fail('p02-shape', e);
}
