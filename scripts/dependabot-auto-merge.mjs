#!/usr/bin/env node
/*
 * Arms auto-merge on Dependabot pull requests, under the policy of core record 0023
 * (decisions/core/0023-dependency-updates-arrive-late-and-only-tooling-merges-without-a-person.md).
 *
 *   node scripts/dependabot-auto-merge.mjs --repo <owner/name> --pr <number> [--dry-run] [--as-of <iso>] [--min-days <n>]
 *   node scripts/dependabot-auto-merge.mjs --repo <owner/name> --sweep [--dry-run]
 *
 * A pull request is armed (`gh pr merge --auto --squash`) only when ALL of these hold:
 *  - every commit of it is by Dependabot, and the commit message carries the Dependabot metadata that says what was
 *    updated (no metadata, no arming);
 *  - every update belongs to the Dependabot group TOOLING_GROUP of dependabot.yml (the named list of packages that do
 *    not end up in what we ship). A bundled package, a GitHub Action and a package that is listed nowhere come as a
 *    pull request of their own, which a person merges;
 *  - every update is a patch or a minor update, and no updated package belongs to the manual set (isManualName);
 *  - every package version that the pull request adds or changes in package-lock.json, direct or transitive, was
 *    published at least MIN_AGE_DAYS days ago according to the npm registry. A registry that cannot be read, a
 *    missing publish time, or a lockfile change that cannot be found means: not armed.
 * A pull request that fails only the age test is looked at again by the next sweep (the workflow runs it daily).
 *
 * The script is a plain Node program with no dependency: `gh` for GitHub, `fetch` for the registry. The decision
 * itself (decide) and its parts are pure functions that the tests import.
 */
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** A published version must be at least this old (days) before a pull request that brings it is armed. */
export const MIN_AGE_DAYS = 7;

/** The Dependabot group of dependabot.yml whose pull requests may be armed. */
export const TOOLING_GROUP = 'tooling';

const DAY_MS = 24 * 60 * 60 * 1000;
const UPDATE_TYPES_ALLOWED = [
  'version-update:semver-patch',
  'version-update:semver-minor',
];
const DEPENDABOT = 'dependabot[bot]';

/**
 * Whether a package name belongs to the manual set: Prettier, TypeScript and ESLint with their plugins, configs and
 * typings stay with a person (core record 0011 and 0023). A name belongs to it when one of its segments, split at `/`,
 * `-` and a leading `@`, is exactly `prettier`, `typescript` or `eslint` (so `eslint-plugin-import-x`,
 * `eslint-config-prettier`, `typescript-eslint`, `@typescript-eslint/parser`, `@eslint/js` and
 * `@ianvs/prettier-plugin-sort-imports` do, and `axios` or `rimraf` do not).
 * @param {string} name npm package name
 * @returns {boolean} true if the name stays manual
 */
export function isManualName(name) {
  return String(name)
    .toLowerCase()
    .split(/[/@-]+/)
    .some((segment) => ['prettier', 'typescript', 'eslint'].includes(segment));
}

/**
 * Read the metadata block that Dependabot appends to its commit message:
 *
 *     ---
 *     updated-dependencies:
 *     - dependency-name: axios
 *       dependency-version: 1.21.1
 *       dependency-type: direct:development
 *       update-type: version-update:semver-patch
 *       dependency-group: dev-minor-patch
 *     ...
 * @param {string} message commit message
 * @returns {{name:string,version?:string,type?:string,updateType?:string,group?:string}[] | null} the updated
 *   dependencies, or null when the message has no such block
 */
export function parseDependabotMetadata(message) {
  const text = String(message ?? '');
  const start = text.indexOf('updated-dependencies:');
  if (start === -1) return null;
  const items = [];
  let current = null;
  for (const raw of text.slice(start).split('\n').slice(1)) {
    const line = raw.replace(/\r$/, '');
    const item = /^-\s+dependency-name:\s*(.+?)\s*$/.exec(line);
    if (item) {
      current = { name: unquote(item[1]) };
      items.push(current);
      continue;
    }
    const field = /^\s+([a-z-]+):\s*(.*?)\s*$/.exec(line);
    if (field && current) {
      const value = unquote(field[2]);
      if (field[1] === 'dependency-version') current.version = value;
      else if (field[1] === 'dependency-type') current.type = value;
      else if (field[1] === 'update-type') current.updateType = value;
      else if (field[1] === 'dependency-group') current.group = value;
      continue;
    }
    // the closing `...` of the block, or anything else that is neither an item nor a field of one, ends it
    if (line.trim() !== '') break;
  }
  return items.length > 0 ? items : null;
}

function unquote(value) {
  const v = String(value).trim();
  return (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
    ? v.slice(1, -1)
    : v;
}

/**
 * The kind of update from the title of a Dependabot pull request, `bump x from 1.16.1 to 1.16.2`. Dependabot leaves
 * `update-type` out of the metadata of an indirect dependency (a package that only the lockfile names), and
 * `dependabot/fetch-metadata` then works it out from the title in the same way.
 * @param {string} title pull request title
 * @returns {string | undefined} `version-update:semver-patch`, `-minor`, `-major` or `-prerelease`; undefined when the
 *   title has no such pair of versions or a version is not a plain semantic version
 */
export function updateTypeFromTitle(title) {
  const m = /from (\S+) to (\S+?)\.?$/.exec(String(title ?? '').trim());
  if (!m) return undefined;
  const parse = (v) =>
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(v);
  const from = parse(m[1]);
  const to = parse(m[2]);
  if (!from || !to) return undefined;
  if (from[1] !== to[1]) return 'version-update:semver-major';
  if (from[2] !== to[2]) return 'version-update:semver-minor';
  if (from[3] !== to[3]) return 'version-update:semver-patch';
  return from[4] !== to[4] ? 'version-update:semver-prerelease' : undefined;
}

/**
 * Fill in the update type that the metadata of a single-dependency pull request lacks, from its title. A pull
 * request with several dependencies is not touched: what is not stated stays unknown, and unknown is not armed.
 * @param {{name:string,updateType?:string}[] | null} metadata result of parseDependabotMetadata
 * @param {string} title pull request title
 * @returns {{name:string,updateType?:string}[] | null} the metadata, with the update type filled in where it can be
 */
export function withUpdateTypes(metadata, title) {
  if (!metadata || metadata.length !== 1 || metadata[0].updateType) {
    return metadata;
  }
  const updateType = updateTypeFromTitle(title);
  return updateType ? [{ ...metadata[0], updateType }] : metadata;
}

/**
 * The package name of an entry of the `packages` map of package-lock.json: the part after the last `node_modules/`.
 * @param {string} key key of the entry, for example `node_modules/rimraf/node_modules/glob`
 * @returns {string} the package name, `''` for the root entry or a key that is not an installed package
 */
export function lockEntryName(key) {
  const marker = 'node_modules/';
  const at = String(key).lastIndexOf(marker);
  return at === -1 ? '' : key.slice(at + marker.length);
}

/**
 * The package versions that the head lockfile adds or changes compared with the base lockfile.
 * @param {object} baseLock parsed base package-lock.json
 * @param {object} headLock parsed head package-lock.json
 * @returns {{key:string,name:string,version:string}[]} entries of the head that are new or have another version
 */
export function lockChanges(baseLock, headLock) {
  const base = baseLock?.packages ?? {};
  const head = headLock?.packages ?? {};
  const changes = [];
  for (const [key, entry] of Object.entries(head)) {
    const name = lockEntryName(key);
    if (!name || !entry || entry.link || typeof entry.version !== 'string') {
      continue;
    }
    if (base[key]?.version !== entry.version) {
      changes.push({ key, name, version: entry.version });
    }
  }
  return changes;
}

/**
 * URL of the registry document of a package (scoped names use the encoded slash).
 * @param {string} name package name
 * @returns {string} URL
 */
export function registryUrl(name) {
  return `https://registry.npmjs.org/${name.replace('/', '%2f')}`;
}

/**
 * Read the publish time of package versions from the registry. Sequential per package, a few in parallel.
 * @param {{name:string,version:string}[]} changes the versions to look up
 * @param {(url:string, init?:object)=>Promise<{ok:boolean,status:number,json:()=>Promise<any>}>} fetchImpl fetch
 * @returns {Promise<Map<string,string>>} `name@version` to the ISO publish time; a version that could not be read has
 *   no entry
 */
export async function fetchPublishTimes(changes, fetchImpl = fetch) {
  const names = [...new Set(changes.map((c) => c.name))];
  const times = new Map();
  let next = 0;
  async function worker() {
    while (next < names.length) {
      const name = names[next++];
      let doc;
      for (let attempt = 0; attempt < 3 && !doc; attempt++) {
        try {
          const response = await fetchImpl(registryUrl(name), {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(60000),
          });
          if (response.ok) doc = await response.json();
        } catch {
          // retried, then the versions of this package stay unknown
        }
      }
      for (const c of changes.filter((x) => x.name === name)) {
        const published = doc?.time?.[c.version];
        if (typeof published === 'string') {
          times.set(`${c.name}@${c.version}`, published);
        }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(5, names.length) }, () => worker())
  );
  return times;
}

/**
 * The age test: which of the changed versions are younger than `minDays` or have an unknown publish time.
 * @param {{name:string,version:string}[]} changes versions added or changed by the pull request
 * @param {Map<string,string>} times `name@version` to the ISO publish time
 * @param {number} now milliseconds since the epoch of the moment that counts
 * @param {number} minDays minimum age in days
 * @returns {{name:string,version:string,ageDays:number|null}[]} the versions that fail (empty when all pass)
 */
export function tooYoung(changes, times, now, minDays = MIN_AGE_DAYS) {
  const failing = [];
  const seen = new Set();
  for (const c of changes) {
    const id = `${c.name}@${c.version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const published = Date.parse(times.get(id) ?? '');
    if (Number.isNaN(published)) {
      failing.push({ name: c.name, version: c.version, ageDays: null });
    } else if (now - published < minDays * DAY_MS) {
      failing.push({
        name: c.name,
        version: c.version,
        ageDays: Math.floor(((now - published) / DAY_MS) * 10) / 10,
      });
    }
  }
  return failing;
}

/**
 * The reasons why a pull request is never armed, however old its versions are (what a later look cannot change).
 * @param {object} input what is known about the pull request
 * @param {{name:string,updateType?:string,group?:string}[] | null} input.metadata Dependabot metadata, null if none
 * @param {string[]} input.commitAuthors login of the author of each commit of the pull request
 * @returns {string[]} the reasons, empty when none applies
 */
export function permanentRefusals({ metadata, commitAuthors }) {
  if (!metadata) return ['no Dependabot metadata in the commit message'];
  const reasons = [];
  const others = (commitAuthors ?? []).filter((a) => a !== DEPENDABOT);
  if (!commitAuthors?.length || others.length > 0) {
    reasons.push(
      `commits not made by Dependabot: ${others.join(', ') || 'none found'}`
    );
  }
  for (const dep of metadata) {
    if (dep.group !== TOOLING_GROUP) {
      reasons.push(
        `${dep.name}: not in the ${TOOLING_GROUP} group (a bundled package, a GitHub Action or a package that is not listed): a person merges it`
      );
    }
    if (!UPDATE_TYPES_ALLOWED.includes(dep.updateType)) {
      reasons.push(
        `${dep.name}: ${dep.updateType ?? 'unknown update type'} is not a patch or minor update`
      );
    }
    if (isManualName(dep.name)) {
      reasons.push(`${dep.name}: belongs to the manual set`);
    }
  }
  return reasons;
}

/**
 * Decide whether a Dependabot pull request may be armed. Pure: everything it needs is passed in.
 * @param {object} input what is known about the pull request
 * @param {{name:string,updateType?:string,group?:string}[] | null} input.metadata Dependabot metadata, null if none
 * @param {string[]} input.commitAuthors login of the author of each commit of the pull request
 * @param {{name:string,version:string}[] | null} input.changes lockfile versions added or changed, null if unknown
 * @param {Map<string,string>} input.times `name@version` to the ISO publish time
 * @param {number} input.now milliseconds since the epoch
 * @param {number} [input.minDays] minimum age in days
 * @returns {{arm:boolean,retryLater:boolean,reasons:string[]}} the verdict; `retryLater` is true when the only thing
 *   that fails is the age of a version, so that a later look can pass
 */
export function decide({
  metadata,
  commitAuthors,
  changes,
  times,
  now,
  minDays = MIN_AGE_DAYS,
}) {
  const refusals = permanentRefusals({ metadata, commitAuthors });
  if (refusals.length > 0) {
    return { arm: false, retryLater: false, reasons: refusals };
  }
  if (!changes || changes.length === 0) {
    return {
      arm: false,
      retryLater: false,
      reasons: ['no change of package-lock.json found'],
    };
  }
  const young = tooYoung(changes, times, now, minDays);
  if (young.length > 0) {
    return {
      arm: false,
      retryLater: true,
      reasons: young.map((y) =>
        y.ageDays === null
          ? `${y.name}@${y.version}: publish time unknown`
          : `${y.name}@${y.version}: ${y.ageDays} days old, less than ${minDays}`
      ),
    };
  }
  return {
    arm: true,
    retryLater: false,
    reasons: [
      `${new Set(changes.map((c) => `${c.name}@${c.version}`)).size} lockfile versions, all at least ${minDays} days old`,
    ],
  };
}

async function gh(args, options = {}) {
  const { stdout } = await execFileAsync('gh', args, {
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
  return stdout;
}

async function ghJson(args) {
  return JSON.parse(await gh(args));
}

async function lockAt(repo, ref) {
  const raw = await gh([
    'api',
    '-H',
    'Accept: application/vnd.github.raw',
    `repos/${repo}/contents/package-lock.json?ref=${ref}`,
  ]);
  return JSON.parse(raw);
}

/**
 * Collect what is known about a pull request and decide.
 * @param {string} repo owner/name
 * @param {number} pr pull request number
 * @param {{asOf?: number, minDays?: number}} [options] the moment that counts and the minimum age
 * @returns {Promise<{pr:number, title:string, verdict:object, alreadyArmed:boolean}>} the verdict
 */
export async function evaluatePullRequest(repo, pr, options = {}) {
  const info = await ghJson([
    'pr',
    'view',
    String(pr),
    '-R',
    repo,
    '--json',
    'title,state,baseRefName,headRefOid,autoMergeRequest',
  ]);
  const commits = await ghJson([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repo}/pulls/${pr}/commits`,
  ]).then((pages) => pages.flat());
  const metadata = withUpdateTypes(
    parseDependabotMetadata(commits[0]?.commit?.message),
    info.title
  );
  const commitAuthors = commits.map((c) => c.author?.login ?? '');
  const refusals = permanentRefusals({ metadata, commitAuthors });
  if (refusals.length > 0) {
    // no need to read the lockfile or the registry for a pull request that a person merges anyway
    return {
      pr,
      title: info.title,
      alreadyArmed: !!info.autoMergeRequest,
      verdict: { arm: false, retryLater: false, reasons: refusals },
    };
  }
  let changes = null;
  let times = new Map();
  try {
    const compare = await ghJson([
      'api',
      `repos/${repo}/compare/${info.baseRefName}...${info.headRefOid}`,
    ]);
    const [baseLock, headLock] = await Promise.all([
      lockAt(repo, compare.merge_base_commit.sha),
      lockAt(repo, info.headRefOid),
    ]);
    changes = lockChanges(baseLock, headLock);
    times = await fetchPublishTimes(changes);
  } catch (error) {
    return {
      pr,
      title: info.title,
      alreadyArmed: !!info.autoMergeRequest,
      verdict: {
        arm: false,
        retryLater: true,
        reasons: [
          `could not read the lockfile or the registry: ${String(error.message ?? error).split('\n')[0]}`,
        ],
      },
    };
  }
  return {
    pr,
    title: info.title,
    alreadyArmed: !!info.autoMergeRequest,
    verdict: decide({
      metadata,
      commitAuthors,
      changes,
      times,
      now: options.asOf ?? Date.now(),
      minDays: options.minDays ?? MIN_AGE_DAYS,
    }),
  };
}

function parseArgs(argv) {
  const args = { dryRun: false, sweep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--sweep') args.sweep = true;
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--pr') args.pr = Number(argv[++i]);
    else if (a === '--as-of') args.asOf = Date.parse(argv[++i]);
    else if (a === '--min-days') args.minDays = Number(argv[++i]);
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!args.repo || (!args.sweep && !Number.isInteger(args.pr))) {
    throw new Error(
      'usage: dependabot-auto-merge.mjs --repo <owner/name> (--pr <number> | --sweep) [--dry-run] [--as-of <iso>] [--min-days <n>]'
    );
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let numbers;
  if (args.sweep) {
    const open = await ghJson([
      'pr',
      'list',
      '-R',
      args.repo,
      '--state',
      'open',
      '--author',
      'app/dependabot',
      '--json',
      'number',
      '--limit',
      '100',
    ]);
    numbers = open.map((p) => p.number);
  } else {
    numbers = [args.pr];
  }
  for (const number of numbers) {
    const result = await evaluatePullRequest(args.repo, number, args);
    const { arm, retryLater, reasons } = result.verdict;
    const action = result.alreadyArmed
      ? 'ALREADY ARMED'
      : arm
        ? args.dryRun
          ? 'WOULD ARM'
          : 'ARM'
        : retryLater
          ? 'SKIP (look again later)'
          : 'SKIP (manual)';
    console.log(`#${number} ${action}: ${result.title}`);
    for (const reason of reasons.slice(0, 12)) console.log(`    ${reason}`);
    if (reasons.length > 12)
      console.log(`    ... and ${reasons.length - 12} more`);
    if (arm && !result.alreadyArmed && !args.dryRun) {
      await gh([
        'pr',
        'merge',
        String(number),
        '-R',
        args.repo,
        '--auto',
        '--squash',
      ]);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(String(error.message ?? error));
    process.exit(1);
  });
}
