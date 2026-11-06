/**
 * Lets a plain `node` child process load the TypeScript sources: every `.ts`
 * file is transpiled to CommonJS when it is required. Used by the tests that
 * start several real processes (see `src/ops/TokenCacheOps.concurrency.test.ts`),
 * which cannot run inside the test runner's own module loader.
 */
const fs = require('fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
