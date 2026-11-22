// T10 for an ES module program: import() of the package without FRODO_MOCK does not run Polly (record and replay of
// HTTP traffic). Run without an argument, this probe judges; run with `measure`, it is the child that is measured.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const PKG = '@rockcarver/frodo-lib';
const { report, fail, measurePollyCore, checkPollyLoadedLazily } =
  createRequire(import.meta.url)('../cjs/h.js');
const measuring = process.argv[2] === 'measure';
try {
  if (measuring) {
    await measurePollyCore(() => import(PKG));
  } else {
    const result = checkPollyLoadedLazily(fileURLToPath(import.meta.url));
    report('m02-polly-lazy', result.ok, result);
  }
} catch (e) {
  if (measuring) {
    console.error(e && e.stack);
    process.exitCode = 1;
  } else {
    fail('m02-polly-lazy', e);
  }
}
