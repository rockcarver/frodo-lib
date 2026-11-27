// Record Keeper, the audit run: asks GitHub for the evidence the audit needs, plans, writes the log branch and the incident issues (docs/audit-run.md).
//
// One file, no dependencies. It is the only part of the kit that writes to GitHub, and it is not the one that reads for a pull request: that
// one, check-pull-request.mjs, has no code that writes. It never runs, installs or checks out anything that is not in the clone it runs in.
//
//   node run-audit.mjs --repo <owner/name> [--dry-run]
//
// The token is read from GITHUB_TOKEN and the address of the API from GITHUB_API_URL (default https://api.github.com). The working directory
// is a clone of the default branch with its whole history, whose `origin` is the repository. Exit status: 0 when no violation stands, 1 when
// one does, 2 when the run could not be made.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Unreadable, printable, run, runGit } from './record-keeper.mjs';

const DEFAULT_API = 'https://api.github.com';
const MAX_PAGES = 200;
const MAX_COMMITS = 300;
const TIMEOUT_MS = 30_000;
const CHECK_NAME = 'Records integrity';
const CHECK_APP = 'github-actions';
const BOT_LOGIN = 'github-actions[bot]';
export const LOG_BRANCH = 'record-keeper/log';
const LOG_REF = `refs/heads/${LOG_BRANCH}`;
const LOG_LOCAL = 'refs/record-keeper/log';
const PUSH_ATTEMPTS = 3;
// A connection that the server closed while the program was computing, and that the program then used again.
const RESET = new Set(['ECONNRESET', 'EPIPE', 'UND_ERR_SOCKET']);
// What git says when another writer was first (the branch moved, or was made in between), and what it says when a rule or a hook refuses.
const LOST_RACE = /non-fast-forward|fetch first|\[rejected\]|cannot lock ref|failed to update ref|reference already exists|incorrect old value/;
const REFUSED = /GH0\d\d|rule violations|declined|permission denied|denied/i;
const BOT_IDENTITY = { GIT_AUTHOR_NAME: BOT_LOGIN, GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com' };
const EVIDENCE_FILE = 'evidence.json';
const ISSUES_FILE = 'issues.json';
const LOGINS_FILE = 'logins.json';
const ANNOUNCEMENT_PAUSE_MS = 1000;
const UTC_TIME = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/;
const USAGE = 'Usage:\n  run-audit.mjs --repo <owner/name> [--dry-run]\n';
const LOG_README = `# Record Keeper log

Written by the audit of this repository (run-audit.mjs), never by hand.

- \`incidents.jsonl\`: one JSON document on each line for every incident issue that the audit opened, changed, reopened or closed.
- \`announcements.jsonl\`: one JSON document on each line for every announcement issue that the audit opened; the first announcement makes the file.
- \`last-run.json\`: the record of the last run of the audit.

The history of this branch is not to be rewritten. The audit does not read it back: it judges the history of the default branch again at every run.
`;

/** Why the run could not be made: the answer is no pass and no fail of the records, it is no answer. */
export class CannotRun extends Error {}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value) => Number.isSafeInteger(value) && value > 0 && value < 1e15;

function apiBase(address) {
  let url;
  try {
    url = new URL(address);
  } catch {
    throw new CannotRun('API address: not an address');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const plain = url.protocol === 'https:' || (url.protocol === 'http:' && local);
  if (!plain || url.username !== '' || url.password !== '' || /[?#]/.test(address)) {
    throw new CannotRun('API address: must be an https address without credentials, query or fragment');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

const notWhatItNeeds = (context, url) => new CannotRun(`the answer to ${printable(url.slice(context.base.length))} is not what the audit needs`);

/**
 * One request. A redirect is never followed, so the token cannot be sent to another place. A body is sent as JSON. A GET whose connection was
 * reset is made once more; a request that writes is never repeated.
 */
async function request(context, method, url, { body, ok = [200] } = {}) {
  const where = printable(url.slice(context.base.length));
  let response;
  for (let attempt = 1; response === undefined; attempt++) {
    try {
      response = await context.fetch(url, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${context.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'record-keeper',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(context.timeout),
      });
    } catch (error) {
      if (method === 'GET' && attempt === 1 && RESET.has(error.cause?.code)) continue;
      throw new CannotRun(`${method} ${where} failed: ${printable(error.cause?.message || error.cause?.code || error.message).slice(0, 200)}`);
    }
  }
  if (!ok.includes(response.status)) throw new CannotRun(`${method} ${where} answered ${response.status}`);
  try {
    return { body: await response.json(), link: response.headers.get('link'), status: response.status };
  } catch {
    throw notWhatItNeeds(context, url);
  }
}

/** The page after this one, or null: the `Link` header of GitHub, `rel="next"`, which must stay on the API. */
function nextPage(context, link, current, seen) {
  const next = [...(link ?? '').matchAll(/<([^>]*)>([^<]*)/g)].find(([, , parameters]) => /;\s*rel="([^"]*\s)?next(\s[^"]*)?"/.test(parameters));
  if (next === undefined) return null;
  let url;
  try {
    url = new URL(next[1], current).href;
  } catch {
    throw new CannotRun('the link to the next page is not the API');
  }
  if (!url.startsWith(`${context.base}/`) || seen.has(url)) throw new CannotRun('the link to the next page is not the API');
  return url;
}

/** Every page of a listing, as a list of the arrays that `take` picks out of each answer (a null from `take` is an answer that does not fit). */
async function readPages(context, first, noun, take) {
  const pages = [];
  const seen = new Set();
  let url = first;
  while (url !== null) {
    if (pages.length === MAX_PAGES) throw new CannotRun(`more than ${MAX_PAGES} pages of ${noun}`);
    seen.add(url);
    const { body, link } = await request(context, 'GET', url);
    const items = take(body);
    if (!Array.isArray(items)) throw notWhatItNeeds(context, url);
    pages.push(items);
    url = nextPage(context, link, url, seen);
  }
  return pages;
}

/** The name of the default branch of the repository. */
async function readDefaultBranch(context) {
  const url = `${context.base}/repos/${context.repo}`;
  const { body } = await request(context, 'GET', url);
  if (!isObject(body) || typeof body.default_branch !== 'string' || body.default_branch === '') throw notWhatItNeeds(context, url);
  return body.default_branch;
}

/** The pull requests that GitHub names for a commit, each checked to be what the audit reads. */
async function readPulls(context, id) {
  const url = `${context.base}/repos/${context.repo}/commits/${id}/pulls?per_page=100`;
  const pulls = (await readPages(context, url, 'pull requests', (body) => body)).flat();
  for (const pull of pulls) {
    const fits = isObject(pull) && isId(pull.number)
      && (pull.merged_at === null || (typeof pull.merged_at === 'string' && UTC_TIME.test(pull.merged_at)))
      && (pull.merge_commit_sha === null || typeof pull.merge_commit_sha === 'string')
      && isObject(pull.head) && typeof pull.head.sha === 'string' && isObject(pull.base) && typeof pull.base.ref === 'string'
      && (pull.user === null || pull.user === undefined || (isObject(pull.user) && isId(pull.user.id)));
    if (!fits) throw notWhatItNeeds(context, url);
  }
  return pulls;
}

/** The pull request that brought a commit into the default branch, or null (docs/audit-run.md). */
function choosePull(pulls, id, defaultBranch) {
  const merged = pulls.filter((pull) => pull.merged_at !== null && pull.base.ref === defaultBranch).sort((a, b) => a.number - b.number);
  const exact = merged.filter((pull) => pull.merge_commit_sha === id);
  if (exact.length === 1) return exact[0];
  if (merged.length === 1) return merged[0];
  if (merged.length === 0) return null;
  throw new CannotRun(`several merged pull requests name the commit ${id}: ${merged.map((pull) => `#${pull.number}`).join(', ')}`);
}

/** When the check first ran on a commit: the earliest start of a run of it by the app, or null when there is none. */
async function readStarted(context, head) {
  const url = `${context.base}/repos/${context.repo}/commits/${head}/check-runs?check_name=${encodeURIComponent(CHECK_NAME)}&filter=all&per_page=100`;
  const pages = await readPages(context, url, 'check runs', (body) => (isObject(body) ? body.check_runs : null));
  const starts = [];
  for (const checked of pages.flat()) {
    const fits = isObject(checked) && typeof checked.name === 'string' && (checked.started_at === null || (typeof checked.started_at === 'string' && UTC_TIME.test(checked.started_at))) && (checked.app === null || isObject(checked.app));
    if (!fits) throw notWhatItNeeds(context, url);
    if (checked.name === CHECK_NAME && checked.app?.slug === CHECK_APP && checked.started_at !== null) starts.push(checked.started_at);
  }
  return starts.length > 0 ? starts.sort()[0] : null;
}

/** The evidence file for the commits that carry an act (docs/audit-effects.md). */
async function collectEvidence(context, commits, defaultBranch) {
  const evidence = {};
  for (const id of commits) {
    const pull = choosePull(await readPulls(context, id), id, defaultBranch);
    if (pull === null) {
      evidence[id] = { pull: null, started: null, reviews: [] };
      continue;
    }
    const reviews = await readPages(context, `${context.base}/repos/${context.repo}/pulls/${pull.number}/reviews?per_page=100`, 'reviews', (body) => body);
    evidence[id] = {
      pull: { number: pull.number, user: pull.user ? { id: pull.user.id } : null, head: { sha: pull.head.sha }, merged_at: pull.merged_at },
      started: await readStarted(context, pull.head.sha),
      reviews,
    };
  }
  return evidence;
}

function git(cwd, args, options = {}) {
  try {
    return runGit(args, { cwd, ...options });
  } catch (error) {
    if (error instanceof Unreadable) throw new CannotRun(printable(error.message).slice(0, 400));
    throw error;
  }
}

/** The tip of the log branch of the remote as a commit of this clone, or null when the remote has no such branch. */
function fetchLog(cwd) {
  if (git(cwd, ['ls-remote', '--heads', 'origin', LOG_REF]).toString('utf8').trim() === '') return null;
  git(cwd, ['fetch', '--no-tags', '--quiet', '--no-recurse-submodules', 'origin', `+${LOG_REF}:${LOG_LOCAL}`]);
  return git(cwd, ['rev-parse', '--verify', '--quiet', `${LOG_LOCAL}^{commit}`]).toString('utf8').trim();
}

/** The entries of the root tree of a commit: [{ mode, type, id, name }]. */
function listTree(cwd, commit) {
  return git(cwd, ['ls-tree', '-z', commit]).toString('utf8').split('\0').filter((entry) => entry !== '').map((entry) => {
    const [facts, name] = entry.split('\t');
    const [mode, type, id] = facts.split(' ');
    return { mode, type, id, name };
  });
}

const blobOf = (cwd, text) => git(cwd, ['hash-object', '-w', '--stdin'], { input: Buffer.from(text) }).toString('utf8').trim();

/** Appends `lines` to a file of the log: its old text, a line feed if that does not end with one, and the lines. */
const appended = (before, lines) => (before === '' || before.endsWith('\n') ? before + lines : `${before}\n${lines}`);

const count = (number, one, many) => `${number} ${number === 1 ? one : many}`;
const joinAnd = (items) => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/**
 * Adds to the log branch: the lines of the incidents to `incidents.jsonl`, the lines of the announcements to `announcements.jsonl` (made by the
 * first one) and the record of the run as `last-run.json`. Returns nothing; throws CannotRun.
 */
function writeLog(cwd, plan, announced, head, at) {
  const lines = plan.log.map((entry) => `${JSON.stringify(entry)}\n`).join('');
  const announcedLines = announced.log.map((entry) => `${JSON.stringify(entry)}\n`).join('');
  const record = `${JSON.stringify(plan.run)}\n`;
  const message = `Audit of ${head} at ${at}: ${count(plan.run.violations, 'violation', 'violations')}, ${count(plan.log.length, 'entry', 'entries')}${announced.log.length === 0 ? '' : `, ${count(announced.log.length, 'announcement', 'announcements')}`}`;
  for (let attempt = 1; attempt <= PUSH_ATTEMPTS; attempt++) {
    const parent = fetchLog(cwd);
    const kept = parent === null ? [{ mode: '100644', type: 'blob', id: blobOf(cwd, LOG_README), name: 'README.md' }] : listTree(cwd, parent);
    const textOf = (file) => {
      const old = kept.find(({ name }) => name === file);
      return old === undefined ? null : git(cwd, ['cat-file', 'blob', old.id]).toString('utf8');
    };
    const written = [
      { name: 'incidents.jsonl', text: appended(textOf('incidents.jsonl') ?? '', lines) },
      ...(textOf('announcements.jsonl') === null && announcedLines === '' ? [] : [{ name: 'announcements.jsonl', text: appended(textOf('announcements.jsonl') ?? '', announcedLines) }]),
      { name: 'last-run.json', text: record },
    ];
    const entries = [
      ...kept.filter(({ name }) => !written.some((file) => file.name === name)),
      ...written.map(({ name, text }) => ({ mode: '100644', type: 'blob', id: blobOf(cwd, text), name })),
    ].sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)));
    const tree = git(cwd, ['mktree', '-z'], { input: Buffer.from(entries.map(({ mode, type, id, name }) => `${mode} ${type} ${id}\t${name}\0`).join('')) }).toString('utf8').trim();
    const dates = { GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at };
    const identity = { ...BOT_IDENTITY, GIT_COMMITTER_NAME: BOT_IDENTITY.GIT_AUTHOR_NAME, GIT_COMMITTER_EMAIL: BOT_IDENTITY.GIT_AUTHOR_EMAIL, ...dates };
    const commit = git(cwd, ['commit-tree', tree, ...(parent === null ? [] : ['-p', parent]), '-m', message], { env: identity }).toString('utf8').trim();
    try {
      git(cwd, ['push', '--quiet', 'origin', `${commit}:${LOG_REF}`]);
      return;
    } catch (error) {
      if (!(error instanceof CannotRun) || !LOST_RACE.test(error.message) || REFUSED.test(error.message)) throw error;
    }
  }
  throw new CannotRun(`could not push the log after ${PUSH_ATTEMPTS} attempts`);
}

/** The current login of an account by its id: the text, or null for an account that GitHub does not know (404). */
async function readLogin(context, id) {
  const url = `${context.base}/user/${id}`;
  const { body, status } = await request(context, 'GET', url, { ok: [200, 404] });
  if (status === 404) return null;
  if (!isObject(body) || typeof body.login !== 'string') throw notWhatItNeeds(context, url);
  return body.login;
}

/** What the kit's own command said, as the reason for not running. */
function refused(result) {
  return new CannotRun(`the audit could not read the history: ${printable(result.stderr.replace(/^record-keeper: /, '').trim()).slice(0, 400)}`);
}

/**
 * Runs the audit. Returns { code, stdout, stderr } like the command line of record-keeper.mjs.
 * `fetch` is the one of Node, `timeout` the milliseconds for one request, `now` the clock, `maxCommits` the limit of commits with acts, `pause` the
 * milliseconds between two announcements and `sleep` how to wait; the tests replace them.
 */
export async function runAudit({ repo, dryRun = false, token, api = DEFAULT_API, cwd = '.', fetch = globalThis.fetch, timeout = TIMEOUT_MS, now = Date.now, maxCommits = MAX_COMMITS, pause = ANNOUNCEMENT_PAUSE_MS, sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }) }) {
  try {
    if (typeof token !== 'string' || !/^\S+$/.test(token)) throw new CannotRun('no token');
    const parts = typeof repo === 'string' ? repo.split('/') : [];
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9._-]{1,100}$/.test(part) && part !== '.' && part !== '..')) {
      throw new CannotRun('repository: must be owner/name');
    }
    const context = { base: apiBase(api), repo, token, fetch, timeout };
    const defaultBranch = await readDefaultBranch(context);
    const history = ['--repo', cwd, '--head', 'HEAD', '--adopted'];
    const listed = run(['audit', ...history, '--json']);
    if (listed.code !== 0) throw refused(listed);
    const commits = [...new Set(JSON.parse(listed.stdout).acts.map(({ commit }) => commit))];
    if (commits.length > maxCommits) throw new CannotRun(`more than ${maxCommits} commits with acts`);
    const evidence = await collectEvidence(context, commits, defaultBranch);
    const issuePages = await readPages(context, `${context.base}/repos/${context.repo}/issues?state=all&creator=${encodeURIComponent(BOT_LOGIN)}&per_page=100`, 'issues', (body) => body);
    const files = new Map([[EVIDENCE_FILE, Buffer.from(JSON.stringify(evidence))], [ISSUES_FILE, Buffer.from(JSON.stringify(issuePages))], [LOGINS_FILE, Buffer.from('{}')]]);
    const readFile = (file) => files.get(file) ?? fs.readFileSync(file);
    const at = new Date(now()).toISOString().replace(/\.\d+Z$/, 'Z');
    const planned = run(['audit-plan', ...history, '--evidence', EVIDENCE_FILE, '--issues', ISSUES_FILE, '--now', at], { readFile });
    if (planned.code !== 0) throw refused(planned);
    const plan = JSON.parse(planned.stdout);
    const said = run(['audit', ...history, '--evidence', EVIDENCE_FILE], { readFile });
    if (said.code === 2) throw refused(said);
    const announce = async () => {
      const made = run(['announce-plan', ...history, '--evidence', EVIDENCE_FILE, '--issues', ISSUES_FILE, '--logins', LOGINS_FILE, '--now', at], { readFile });
      if (made.code !== 0) throw refused(made);
      return JSON.parse(made.stdout);
    };
    let announced = await announce();
    if (announced.lookups.length > 0) {
      const logins = {};
      for (const id of announced.lookups) logins[id] = await readLogin(context, id);
      files.set(LOGINS_FILE, Buffer.from(JSON.stringify(logins)));
      announced = await announce();
    }
    const lines = [];
    if (dryRun) {
      for (const action of plan.issues) lines.push(`would ${action.action} ${action.key}${action.number === undefined ? '' : ` #${action.number}`}\n`);
      for (const item of announced.announcements) lines.push(`would announce ${item.key}\n`);
      lines.push('dry run: nothing was written\n');
      return { code: plan.failed ? 1 : 0, stdout: said.stdout + lines.join(''), stderr: said.stderr };
    }
    writeLog(cwd, plan, announced, plan.run.head, at);
    // The audit and the log took their time and the connection of the reads may have been closed meanwhile: a read makes a fresh one before the first write.
    await request(context, 'GET', `${context.base}/repos/${context.repo}`);
    const duplicate = (index) => plan.log[index].duplicate !== undefined;
    for (const [index, action] of plan.issues.entries()) {
      const issues = `${context.base}/repos/${context.repo}/issues`;
      let number = action.number;
      if (action.action === 'open') {
        const { body } = await request(context, 'POST', issues, { body: { title: action.title, body: action.body }, ok: [201] });
        if (!isObject(body) || !isId(body.number)) throw notWhatItNeeds(context, issues);
        number = body.number;
      } else {
        const change = action.action === 'close' ? { state: 'closed', state_reason: duplicate(index) ? 'not_planned' : 'completed', body: action.body }
          : { ...(action.action === 'reopen' ? { state: 'open' } : {}), title: action.title, body: action.body };
        await request(context, 'PATCH', `${issues}/${number}`, { body: change });
      }
      lines.push(`${{ open: 'opened', update: 'updated', reopen: 'reopened', close: 'closed' }[action.action]} ${action.key} #${number}\n`);
    }
    for (const [index, item] of announced.announcements.entries()) {
      if (index > 0) await sleep(pause);
      const issues = `${context.base}/repos/${context.repo}/issues`;
      const { body } = await request(context, 'POST', issues, { body: { title: item.title, body: item.body }, ok: [201] });
      if (!isObject(body) || !isId(body.number)) throw notWhatItNeeds(context, issues);
      lines.push(`announced ${item.key} #${body.number}\n`);
    }
    const kinds = [...(plan.log.length === 0 ? [] : [count(plan.log.length, 'entry', 'entries')]), ...(announced.log.length === 0 ? [] : [count(announced.log.length, 'announcement', 'announcements')]), 'the record of the run'];
    lines.push(`log: ${joinAnd(kinds)} pushed to ${LOG_BRANCH}\n`);
    return { code: plan.failed ? 1 : 0, stdout: said.stdout + lines.join(''), stderr: said.stderr };
  } catch (error) {
    if (!(error instanceof CannotRun)) throw error;
    return { code: 2, stdout: '', stderr: `Records audit could not run: ${error.message}\n` };
  }
}

/** The command line, without the process around it. Returns { code, stdout, stderr }. */
export async function runCli(argv, env, options = {}) {
  const usage = { code: 2, stdout: '', stderr: USAGE };
  let repo;
  let dryRun = false;
  for (let at = 0; at < argv.length; at++) {
    if (argv[at] === '--dry-run' && !dryRun) dryRun = true;
    else if (argv[at] === '--repo' && repo === undefined && at + 1 < argv.length) repo = argv[++at];
    else return usage;
  }
  if (repo === undefined) return usage;
  return runAudit({ repo, dryRun, token: env.GITHUB_TOKEN, api: env.GITHUB_API_URL || DEFAULT_API, ...options });
}

// Runs only when this file is the program, also when it is reached through a symbolic link.
function isMain() {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  const { code, stdout, stderr } = await runCli(process.argv.slice(2), process.env);
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = code;
}
