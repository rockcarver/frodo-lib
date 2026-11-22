'use strict';
// T11: record and replay (FRODO_MOCK) works through the packed package, against a fake classic AM on 127.0.0.1. No
// tenant and nothing committed: Polly records into a folder this probe creates and removes.
//   1. replay on an empty folder: the login fails with Polly's "recording not found" and the fake AM sees nothing, so
//      no request goes out before Polly is set up (the library sets it up after the load);
//   2. record: the login reaches the fake AM and a recording is written;
//   3. replay on another port, from a program that changes its command line right after it loaded the library (a
//      command line program does): the login works from the recording and the fake AM sees nothing. A recording is
//      named after the command line, so this fails when the library reads it later than it was loaded.
// Run without a role, this probe is the parent that judges; with P08_ROLE=login it is a child that logs in once.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { report, fail, PKG } = require('./h.js');
const { start } = require('../fakeAm.cjs');

const NOT_FOUND = 'Recording for the following request is not found';

/** The message of an error and of every error it wraps (a FrodoError lists them in originalErrors). */
function messagesOf(error, depth = 0) {
  if (!error || depth > 4) return [];
  return [
    String(error.message ?? error),
    ...(error.originalErrors ?? []).flatMap((e) => messagesOf(e, depth + 1)),
    ...messagesOf(error.cause, depth + 1),
  ];
}

/** The child: one login against the fake AM named in P08_HOST; prints one `CHILD {json}` line. */
async function login() {
  const { frodo } = require(PKG);
  if (process.env.P08_LATE) process.argv.push('--late');
  const out = {};
  try {
    const instance = frodo.createInstance({
      host: `${process.env.P08_HOST}/am`,
      username: 'amadmin',
      password: 'secret',
      deploymentType: 'classic',
    });
    out.login = !!(await instance.login.getTokens());
  } catch (e) {
    out.login = false;
    out.notFound = messagesOf(e).some((m) => m.includes(NOT_FOUND));
    out.error = String(e.message ?? e)
      .split('\n')[0]
      .slice(0, 200);
  }
  console.log('CHILD ' + JSON.stringify(out));
}

/** Run this file as the child of one step and wait for it to end (a recording run ends when Polly has stopped). */
function runChild(env, timeoutMs) {
  return new Promise((resolve) => {
    const clean = { ...process.env };
    for (const key of Object.keys(clean)) {
      if (/^(FRODO_(MOCK|TEST_NAME|POLLY)|P08_)/.test(key)) delete clean[key];
    }
    const child = spawn(process.execPath, [__filename], {
      env: { ...clean, P08_ROLE: 'login', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      const line = stdout
        .split('\n')
        .filter((l) => l.startsWith('CHILD '))
        .pop();
      resolve({
        status,
        signal,
        result: line ? JSON.parse(line.slice('CHILD '.length)) : null,
        output: `${stdout}\n${stderr}`.trim().slice(-600),
      });
    });
  });
}

/** The recordings below `dir`. */
function recordings(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...recordings(full));
    else if (entry.name === 'recording.har') found.push(full);
  }
  return found;
}

async function judge() {
  const dir = fs.mkdtempSync(path.join(os.homedir(), 'mock-roundtrip-'));
  const fakes = [];
  const step = async (name, mock, extra, timeoutMs) => {
    const fake = await start();
    fakes.push(fake);
    const host = `http://127.0.0.1:${fake.port}`;
    const r = await runChild(
      {
        FRODO_MOCK: mock,
        FRODO_MOCK_DIR: dir,
        FRODO_MOCK_HOSTS: host,
        FRODO_MOCK_DEDICATED_AUTH: '1',
        FRODO_NO_CACHE: '1',
        P08_HOST: host,
        ...extra,
      },
      timeoutMs
    );
    if (r.status !== 0 || !r.result) {
      throw new Error(
        `${name}: the child exited ${r.status ?? r.signal} without a result: ${r.output}`
      );
    }
    return { ...r.result, requests: fake.log.length };
  };
  try {
    const gate = await step('replay on an empty folder', '1', {}, 60_000);
    if (gate.login || !gate.notFound || gate.requests !== 0) {
      throw new Error(
        `replay on an empty folder must fail with "${NOT_FOUND}" and send nothing, got ${JSON.stringify(gate)}`
      );
    }
    const record = await step('record', 'record', {}, 90_000);
    const written = recordings(dir).length;
    if (!record.login || record.requests === 0 || written === 0) {
      throw new Error(
        `record must log in through the fake AM and write a recording, got ${JSON.stringify(record)} and ${written} recording(s)`
      );
    }
    const replay = await step('replay', '1', { P08_LATE: '1' }, 60_000);
    if (!replay.login || replay.requests !== 0) {
      throw new Error(
        `replay must log in from the recording and send nothing, got ${JSON.stringify(replay)}`
      );
    }
    report('p08-mock-roundtrip', true, {
      gateRequests: gate.requests,
      recordRequests: record.requests,
      recordings: written,
      replayRequests: replay.requests,
    });
  } finally {
    for (const fake of fakes) fake.server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

(process.env.P08_ROLE === 'login' ? login() : judge()).catch((e) =>
  fail('p08-mock-roundtrip', e)
);
