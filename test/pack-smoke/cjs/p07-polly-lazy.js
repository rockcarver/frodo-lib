'use strict';
// T10: a CommonJS program that requires the package and does not set FRODO_MOCK does not run Polly (record and replay of
// HTTP traffic). Run without an argument, this probe judges; run with `measure`, it is the child that is measured.
const {
  report,
  fail,
  PKG,
  measurePollyCore,
  checkPollyLoadedLazily,
} = require('./h.js');
(async () => {
  try {
    if (process.argv[2] === 'measure') {
      await measurePollyCore(async () => require(PKG));
      return;
    }
    const result = checkPollyLoadedLazily(__filename);
    report('p07-polly-lazy', result.ok, result);
  } catch (e) {
    if (process.argv[2] === 'measure') {
      console.error(e && e.stack);
      process.exitCode = 1;
    } else {
      fail('p07-polly-lazy', e);
    }
  }
})();
