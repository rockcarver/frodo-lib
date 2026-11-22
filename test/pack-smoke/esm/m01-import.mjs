// An ES module program imports the package: the named exports, the one interoperability slot, no default.
const PKG = '@rockcarver/frodo-lib';
const out = { id: 'm01-import' };
try {
  const ns = await import(PKG);
  const keys = Object.keys(ns).sort();
  out.keys = keys;
  out.ok =
    typeof ns.frodo === 'object' &&
    typeof ns.state === 'object' &&
    typeof ns.FrodoError === 'function' &&
    keys.join() === 'FrodoError,frodo,module.exports,state' &&
    !('default' in ns) &&
    ns['module.exports'].frodo === ns.frodo;
} catch (e) {
  out.ok = false;
  out.code = e.code;
  out.message = String(e.message).split('\n')[0].slice(0, 300);
}
console.log('RESULT ' + JSON.stringify(out));
if (!out.ok) process.exitCode = 1;
