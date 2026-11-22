'use strict';
// A CommonJS program that a bundler turns into one file (esbuild): import.meta.url is undefined in such a bundle,
// and the package must still load and run.
const { frodo, state, FrodoError } = require('@rockcarver/frodo-lib');
state.setHost('https://openam-matrix.example.com/am');
const ok =
  typeof frodo.login.getTokens === 'function' &&
  state.getHost() === 'https://openam-matrix.example.com/am' &&
  new FrodoError('x') instanceof Error;
console.log('RESULT ' + JSON.stringify({ id: 'bundle-app', ok }));
if (!ok) process.exitCode = 1;
