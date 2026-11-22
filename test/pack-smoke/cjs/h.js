'use strict';
// Helpers of the CommonJS probes. Each probe prints one line, `RESULT {json}`, and sets the exit code:
// scripts/pack-smoke.mjs reads the line and the exit code. The probes run in a scratch consumer folder
// where the packed package is installed under node_modules.
exports.PKG = '@rockcarver/frodo-lib';
exports.HOST = 'https://openam-matrix.example.com/am';

exports.report = (id, ok, detail = {}) => {
  console.log('RESULT ' + JSON.stringify({ id, ok, ...detail }));
  if (!ok) process.exitCode = 1;
};

exports.fail = (id, e) => {
  console.log(
    'RESULT ' +
      JSON.stringify({
        id,
        ok: false,
        code: e && e.code,
        message: String((e && e.message) || e)
          .split('\n')[0]
          .slice(0, 300),
      })
  );
  process.exitCode = 1;
};
