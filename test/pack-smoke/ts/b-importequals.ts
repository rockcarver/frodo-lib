// `import x = require()`: the whole object that require() returns.
import lib = require('@rockcarver/frodo-lib');

export const host = lib.state.getHost();
export const instance = lib.frodo.createInstance({
  host: 'https://openam-matrix.example.com/am',
});
