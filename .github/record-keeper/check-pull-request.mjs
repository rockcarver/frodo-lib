// Record Keeper, the pull request check: reads a pull request from GitHub and runs `check-pr` on it (docs/workflow.md).
//
// One file, no dependencies. It is the only part of the kit that uses the network, and it only reads: the pull request, its reviews, and the
// commits of both sides through git. It never runs, installs or checks out anything the pull request holds.
//
//   node check-pull-request.mjs --repo <owner/name> --pr <number>
//
// It also asks `record-keeper needs` what the change cites or waits for, looks the issues and pull requests up, and finds when the
// first run of the check on the head commit began (docs/errata-and-deviations.md).
//
// The token is read from GITHUB_TOKEN and the address of the API from GITHUB_API_URL (default https://api.github.com). The working
// directory is a clone whose `origin` is the repository. Exit status: that of `check-pr` (0, 1 or 2), or 2 when the check could not run.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Unreadable, printable, run, runGit } from './record-keeper.mjs';

const DEFAULT_API = 'https://api.github.com';
const MAX_PAGES = 200;
const TIMEOUT_MS = 30_000;
const REVIEWS_FILE = 'reviews.json';
const CASES_FILE = 'cases.json';
const MAX_CASES = 50;
const CHECK_NAME = 'Records integrity';
const CHECK_APP = 'github-actions';
const UTC_TIME = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/;
const HEAD_REF = 'refs/record-keeper/head';
const BASE_REF = 'refs/record-keeper/base';
const COMMIT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const USAGE = 'Usage:\n  check-pull-request.mjs --repo <owner/name> --pr <number>\n';

/** Why the check could not run: the answer is no pass and no fail of the records, it is no answer. */
export class CannotRun extends Error {}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** A GitHub id as `check-pr --author` takes it: a positive integer of at most 15 digits. */
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

/** One GET. A redirect is never followed, so the token cannot be sent to another place. */
async function get(context, url, absent = []) {
  const where = printable(url.slice(context.base.length));
  let response;
  try {
    response = await context.fetch(url, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${context.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'record-keeper' },
      redirect: 'error',
      signal: AbortSignal.timeout(context.timeout),
    });
  } catch (error) {
    throw new CannotRun(`GET ${where} failed: ${printable(error.cause?.message || error.cause?.code || error.message).slice(0, 200)}`);
  }
  if (absent.includes(response.status)) return { body: null, link: null, absent: true };
  if (response.status !== 200) throw new CannotRun(`GET ${where} answered ${response.status}`);
  try {
    return { body: await response.json(), link: response.headers.get('link') };
  } catch {
    throw new CannotRun(`the answer to ${where} is not what the check needs`);
  }
}

/** What `record-keeper needs` printed: the issues and pull requests to look up, and whether the clock is wanted. */
export function readNeeds(text) {
  const cited = [];
  let clock = false;
  for (const line of text.split('\n').filter((l) => l !== '')) {
    const found = /^case (issue|pull) ([1-9][0-9]{0,8})$/.exec(line);
    if (found) cited.push({ kind: found[1], number: Number(found[2]) });
    else if (line === 'clock') clock = true;
    else throw new CannotRun('record-keeper needs printed something that is not a need');
  }
  if (cited.length > MAX_CASES) throw new CannotRun(`more than ${MAX_CASES} cases to look up`);
  return { cited, clock };
}

/** The pull request as it is now: its head commit, its base branch and its author. */
async function readPullRequest(context, number) {
  const url = `${context.base}/repos/${context.repo}/pulls/${number}`;
  const { body } = await get(context, url);
  const { number: named, state, head, base, user } = isObject(body) ? body : {};
  const fits = named === number && typeof state === 'string' && isObject(head) && COMMIT_ID.test(head.sha) && isObject(base)
    && typeof base.ref === 'string' && base.ref !== '' && base.ref.length <= 255 && !/[\u0000-\u001f\u007f]/.test(base.ref)
    && (user === null || (isObject(user) && isId(user.id)));
  if (!fits) throw new CannotRun(`the answer to ${printable(url.slice(context.base.length))} is not what the check needs`);
  if (state !== 'open') throw new CannotRun('the pull request is not open');
  if (user === null) throw new CannotRun('the pull request has no author');
  return { head: head.sha, baseRef: base.ref, author: user.id };
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

/** Every page of a listing, as a list of the arrays that `take` picks out of each answer (null from `take` is an answer that does not fit). */
async function readPages(context, first, noun, take) {
  const pages = [];
  const seen = new Set();
  let url = first;
  while (url !== null) {
    if (pages.length === MAX_PAGES) throw new CannotRun(`more than ${MAX_PAGES} pages of ${noun}`);
    seen.add(url);
    const { body, link } = await get(context, url);
    const items = take(body);
    if (!Array.isArray(items)) throw new CannotRun(`the answer to ${printable(url.slice(context.base.length))} is not what the check needs`);
    pages.push(items);
    url = nextPage(context, link, url, seen);
  }
  return pages;
}

/** Every page of the reviews of a pull request, as a list of pages (what `gh api --paginate --slurp` writes). */
const readReviewPages = (context, number) => readPages(context, `${context.base}/repos/${context.repo}/pulls/${number}/reviews?per_page=100`, 'reviews', (body) => body);

/** The issues and pull requests the change cites that exist in the repository, as `check-pr --cases` takes them. */
async function readCases(context, cited) {
  const found = { issue: [], pull: [] };
  for (const { kind, number } of cited) {
    const url = `${context.base}/repos/${context.repo}/issues/${number}`;
    const { body, absent } = await get(context, url, [404, 410]);
    if (absent) continue;
    if (!isObject(body) || body.number !== number || !(body.pull_request === undefined || isObject(body.pull_request))) {
      throw new CannotRun(`the answer to ${printable(url.slice(context.base.length))} is not what the check needs`);
    }
    if ((body.pull_request === undefined) === (kind === 'issue')) found[kind].push(number);
  }
  return found;
}

/** When the first run of the check on the head commit began, as `check-pr --since` takes it (the time given by `now` when none is listed). */
async function readSince(context, head, now) {
  const url = `${context.base}/repos/${context.repo}/commits/${head}/check-runs?check_name=${encodeURIComponent(CHECK_NAME)}&filter=all&per_page=100`;
  const pages = await readPages(context, url, 'check runs', (body) => (isObject(body) ? body.check_runs : null));
  const starts = [];
  for (const run of pages.flat()) {
    const fits = isObject(run) && typeof run.name === 'string' && (run.started_at === null || (typeof run.started_at === 'string' && UTC_TIME.test(run.started_at))) && (run.app === null || isObject(run.app));
    if (!fits) throw new CannotRun(`the answer to ${printable(url.slice(context.base.length))} is not what the check needs`);
    if (run.name === CHECK_NAME && run.app?.slug === CHECK_APP && run.started_at !== null) starts.push(run.started_at);
  }
  return starts.length > 0 ? starts.sort()[0] : new Date(now()).toISOString().replace(/\.\d+Z$/, 'Z');
}

function git(cwd, args) {
  try {
    return runGit(args, { cwd }).toString('utf8').trim();
  } catch (error) {
    if (error instanceof Unreadable) throw new CannotRun(printable(error.message).slice(0, 400));
    throw error;
  }
}

/**
 * Judges a pull request. Returns { code, stdout, stderr } like the command line of record-keeper.mjs.
 * `fetch` is the one of Node and `timeout` the milliseconds for one request; the tests replace them.
 */
export async function checkPullRequest({ repo, number, token, api = DEFAULT_API, cwd = '.', fetch = globalThis.fetch, timeout = TIMEOUT_MS, now = Date.now }) {
  try {
    if (typeof token !== 'string' || !/^\S+$/.test(token)) throw new CannotRun('no token');
    const parts = typeof repo === 'string' ? repo.split('/') : [];
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9._-]{1,100}$/.test(part) && part !== '.' && part !== '..')) {
      throw new CannotRun('repository: must be owner/name');
    }
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1 || number > 999_999_999) {
      throw new CannotRun('pull request number: must be a positive integer of at most 9 digits');
    }
    const context = { base: apiBase(api), repo, token, fetch, timeout };
    const first = await readPullRequest(context, number);
    const pages = await readReviewPages(context, number);
    const second = await readPullRequest(context, number);
    if (second.head !== first.head || second.baseRef !== first.baseRef) throw new CannotRun('the head moved');
    git(cwd, ['fetch', '--no-tags', '--quiet', '--no-recurse-submodules', 'origin', `+refs/pull/${number}/head:${HEAD_REF}`, `+refs/heads/${first.baseRef}:${BASE_REF}`]);
    const head = git(cwd, ['rev-parse', '--verify', '--quiet', `${HEAD_REF}^{commit}`]);
    const base = git(cwd, ['rev-parse', '--verify', '--quiet', `${BASE_REF}^{commit}`]);
    if (head !== first.head) throw new CannotRun('the head moved');
    const needs = run(['needs', '--repo', cwd, '--base', base, '--head', head]);
    if (needs.code !== 0) return needs;
    const { cited, clock } = readNeeds(needs.stdout);
    const files = new Map([[REVIEWS_FILE, Buffer.from(JSON.stringify(pages))]]);
    const extra = [];
    if (cited.length > 0) {
      files.set(CASES_FILE, Buffer.from(JSON.stringify(await readCases(context, cited))));
      extra.push('--cases', CASES_FILE);
    }
    if (clock) extra.push('--since', await readSince(context, head, now));
    const readFile = (file) => files.get(file) ?? fs.readFileSync(file);
    return run(['check-pr', '--repo', cwd, '--base', base, '--head', head, '--reviews', REVIEWS_FILE, '--author', String(first.author), ...extra], { readFile, now });
  } catch (error) {
    if (!(error instanceof CannotRun)) throw error;
    return { code: 2, stdout: '', stderr: `Records integrity could not run: ${error.message}\n` };
  }
}

/** The command line, without the process around it. Returns { code, stdout, stderr }. */
export async function runCli(argv, env, options = {}) {
  const usage = { code: 2, stdout: '', stderr: USAGE };
  const given = new Map();
  for (let at = 0; at < argv.length; at += 2) {
    if (!['--repo', '--pr'].includes(argv[at]) || given.has(argv[at]) || at + 1 >= argv.length) return usage;
    given.set(argv[at], argv[at + 1]);
  }
  if (given.size !== 2 || !/^[1-9][0-9]*$/.test(given.get('--pr')) || given.get('--pr').length > 9) return usage;
  return checkPullRequest({ repo: given.get('--repo'), number: Number(given.get('--pr')), token: env.GITHUB_TOKEN, api: env.GITHUB_API_URL || DEFAULT_API, ...options });
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
