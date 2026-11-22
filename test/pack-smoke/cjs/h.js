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

// The environment variables that scripts/pack-smoke.mjs removes from the environment of every probe: Node.js options
// and proxy settings of the machine must not reach the code under test. Returns the names that are set.
exports.leakedEnv = () =>
  Object.keys(process.env).filter((key) =>
    /^(https?_proxy|all_proxy|node_options)$/i.test(key)
  );

// ------------------------------------------------------------------------------------------------------------------
// T10: record and replay (Polly) is loaded only by a process that sets FRODO_MOCK.
//
// The probes measure what RAN, not what the bundle contains: V8 precise coverage (function granularity, call counts)
// says how often the module wrapper of @pollyjs/core ran in a process that loaded the package and made one login
// round trip. A variable name of the bundler or a Node.js warning would be a weaker witness (the names change with
// the bundler, the warning exists on one Node.js version only). The control is a process with FRODO_MOCK=1: it must
// run the wrapper, so that the probe cannot pass because it looks at the wrong function.
//
// A second witness is another package of Polly: graceful-fs, which its file persister loads, replaces fs.close and
// fs.closeSync in the process the moment it is evaluated. A process without FRODO_MOCK must leave both alone, the
// control must have replaced them.
//
// The modules these functions need are required inside them, so that the other probes, which share this file, load
// nothing they do not use (a Node.js built without the inspector would otherwise fail every probe).
// ------------------------------------------------------------------------------------------------------------------

/** A string that only @pollyjs/core contains: the error of a request that no recording answers. */
const POLLY_CORE_MARKER = 'Recording for the following request is not found';

const post = (session, method, params = {}) =>
  new Promise((resolve, reject) =>
    session.post(method, params, (err, result) =>
      err ? reject(err) : resolve(result)
    )
  );

/**
 * How many times the module wrapper of @pollyjs/core ran since the coverage was started. The ranges that contain the
 * marker, the largest first: the script itself, then the wrapper that holds the whole module.
 */
async function pollyCoreRuns(session, file) {
  const fs = require('node:fs');
  const { fileURLToPath } = require('node:url');
  const text = fs.readFileSync(file, 'utf8');
  const first = text.indexOf(POLLY_CORE_MARKER);
  if (first < 0 || text.indexOf(POLLY_CORE_MARKER, first + 1) >= 0) {
    throw new Error(
      'the bundle does not hold the marker of @pollyjs/core exactly once'
    );
  }
  const { result } = await post(session, 'Profiler.takePreciseCoverage');
  const script = result.find(
    (s) => s.url.startsWith('file:') && fileURLToPath(s.url) === file
  );
  if (!script) throw new Error(`no coverage was reported for ${file}`);
  const ranges = script.functions
    .map((f) => f.ranges[0])
    .filter((r) => r.startOffset <= first && first < r.endOffset)
    .sort(
      (a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset)
    );
  if (ranges.length < 2) {
    throw new Error(
      `no function other than the script holds the marker (${ranges.length} range(s))`
    );
  }
  return ranges[1].count;
}

/**
 * The measuring side of T10, run in a child: load the package with `load` (a require or an import), make one login
 * round trip against a fake AM and print one `MEASURE {json}` line. Coverage is started before the load, so the
 * count covers everything that ran from the load on.
 */
exports.measurePollyCore = async (load) => {
  const fs = require('node:fs');
  const inspector = require('node:inspector');
  const { start } = require('../fakeAm.cjs');
  const file = fs.realpathSync(require.resolve(exports.PKG));
  const closeBefore = [fs.close, fs.closeSync];
  const session = new inspector.Session();
  session.connect();
  await post(session, 'Profiler.enable');
  await post(session, 'Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: false,
  });
  const { frodo } = await load();
  const fake = await start();
  const out = {};
  try {
    const instance = frodo.createInstance({
      host: `http://127.0.0.1:${fake.port}/am`,
      username: 'amadmin',
      password: 'secret',
      deploymentType: 'classic',
    });
    out.login = !!(await instance.login.getTokens());
  } catch (e) {
    out.login = false;
    out.error = String((e && e.message) || e)
      .split('\n')[0]
      .slice(0, 200);
  } finally {
    fake.server.close();
  }
  out.requests = fake.log.length;
  out.fsClosePatched =
    fs.close !== closeBefore[0] || fs.closeSync !== closeBefore[1];
  out.pollyCoreRuns = await pollyCoreRuns(session, file);
  session.disconnect();
  console.log('MEASURE ' + JSON.stringify(out));
};

/** The environment of a child: the one of this process, without any record and replay variable, plus `extra`. */
function envWithout(extra = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^FRODO_(MOCK|TEST_NAME|POLLY)/.test(key)) delete env[key];
  }
  return { ...env, ...extra };
}

/**
 * The judging side of T10: run `probeFile measure` twice. Without FRODO_MOCK the module wrapper of @pollyjs/core must
 * not have run, fs.close and fs.closeSync must be the ones of Node.js and the login must work; with FRODO_MOCK=1 (the
 * control, an empty recordings folder of its own) the wrapper must have run and both functions must be replaced. Where the control prints the localStorage warning of Node.js 26 (it comes from a package of Polly),
 * the run without FRODO_MOCK must not print it.
 */
exports.checkPollyLoadedLazily = (probeFile) => {
  const { spawnSync } = require('node:child_process');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const recordings = fs.mkdtempSync(path.join(os.homedir(), 'polly-lazy-'));
  const measure = (label, extra) => {
    const r = spawnSync(process.execPath, [probeFile, 'measure'], {
      env: envWithout(extra),
      encoding: 'utf8',
      timeout: 90_000,
    });
    const line = r.stdout
      .split('\n')
      .filter((l) => l.startsWith('MEASURE '))
      .pop();
    if (r.status !== 0 || !line) {
      throw new Error(
        `${label} exited ${r.status ?? r.signal}: ${`${r.stdout}\n${r.stderr}`.trim().slice(-600)}`
      );
    }
    return { ...JSON.parse(line.slice('MEASURE '.length)), stderr: r.stderr };
  };
  try {
    const plain = measure('the run without FRODO_MOCK', {});
    const control = measure('the control run', {
      FRODO_MOCK: '1',
      FRODO_MOCK_DIR: recordings,
    });
    const warning = /localStorage is not available/;
    const warned = warning.test(plain.stderr);
    const controlWarned = warning.test(control.stderr);
    const ok =
      plain.login === true &&
      plain.pollyCoreRuns === 0 &&
      control.pollyCoreRuns >= 1 &&
      plain.fsClosePatched === false &&
      control.fsClosePatched === true &&
      !(controlWarned && warned);
    return {
      ok,
      pollyCoreRuns: plain.pollyCoreRuns,
      controlPollyCoreRuns: control.pollyCoreRuns,
      fsClosePatched: plain.fsClosePatched,
      controlFsClosePatched: control.fsClosePatched,
      login: plain.login,
      requests: plain.requests,
      warned,
      controlWarned,
    };
  } finally {
    fs.rmSync(recordings, { recursive: true, force: true });
  }
};
