#!/usr/bin/env node
// Compares the core decision records of this repository with the sibling's
// (core 0018): the same files must be in `core/` of frodo-cli and frodo-lib.
// No dependencies. This file is identical in both repositories.
//
// Usage: node check-core-records-drift.mjs [--self owner/repo] [--local dir]
//                                          [--sibling-dir dir] [--ref ref]
//   --self         the repository running the check (default: GITHUB_REPOSITORY)
//   --local        this repository's core folder (default: from --self)
//   --sibling-dir  compare with a local checkout of the sibling's core folder
//                  instead of asking the GitHub API
//   --ref          the sibling's branch or tag (default: main)
// GITHUB_TOKEN, when set, is sent with the API request (public repositories
// need none). Exit status: 0 identical, 1 drift, 2 the check could not run.
// It only reads and prints; it never opens an issue.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORE_DIRS = {
  'rockcarver/frodo-cli': 'docs/decisions/core',
  'rockcarver/frodo-lib': 'decisions/core',
};

/** The other repository that keeps core records, or undefined. */
export function siblingOf(self) {
  return Object.keys(CORE_DIRS).find((repo) => repo !== self && self in CORE_DIRS);
}

/** The git blob id of some content: the `sha` the GitHub contents API reports. */
export function blobSha(content) {
  const buffer = Buffer.from(content);
  return crypto.createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
}

/** Maps file name to blob id for the files of a folder (not its subfolders). */
export function readFolder(dir) {
  const files = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) files[entry.name] = blobSha(fs.readFileSync(path.join(dir, entry.name)));
  }
  return files;
}

/** Lists a folder of the sibling through the GitHub contents API. */
export async function readRemoteFolder({ repo, dir, ref = 'main', token, fetchImpl = fetch }) {
  const url = `https://api.github.com/repos/${repo}/contents/${dir}?ref=${encodeURIComponent(ref)}`;
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'frodo-core-records-drift' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    const limited = response.status === 403 && response.headers?.get?.('x-ratelimit-remaining') === '0';
    throw new Error(`GET ${url} answered ${response.status}${limited ? ' (the API rate limit is used up: set GITHUB_TOKEN)' : ''}`);
  }
  const entries = await response.json();
  if (!Array.isArray(entries)) throw new Error(`${repo}/${dir} is not a folder`);
  const files = {};
  for (const entry of entries) if (entry.type === 'file') files[entry.name] = entry.sha;
  return files;
}

/** Returns the differences between two folders as a list of problems, empty when identical. */
export function compareFolders({ local, remote, self, sibling }) {
  const problems = [];
  for (const name of Object.keys(local).sort()) {
    if (!(name in remote)) problems.push(`${name} is in ${self} but missing in ${sibling}`);
    else if (local[name] !== remote[name]) problems.push(`${name} differs between ${self} and ${sibling}`);
  }
  for (const name of Object.keys(remote).sort()) {
    if (!(name in local)) problems.push(`${name} is in ${sibling} but missing in ${self}`);
  }
  return problems;
}

export async function run(argv, env, io = console, fetchImpl = fetch) {
  const option = (name) => {
    const at = argv.indexOf(name);
    return at < 0 ? undefined : argv[at + 1];
  };
  const self = option('--self') ?? env.GITHUB_REPOSITORY;
  const sibling = siblingOf(self);
  if (!sibling) {
    io.error(`::error::--self or GITHUB_REPOSITORY must be one of ${Object.keys(CORE_DIRS).join(', ')} (got "${self ?? ''}")`);
    return 2;
  }
  const localDir = option('--local') ?? CORE_DIRS[self];
  if (!fs.existsSync(localDir)) {
    io.error(`::error::${localDir} does not exist`);
    return 2;
  }
  let remote;
  try {
    const siblingDir = option('--sibling-dir');
    remote = siblingDir
      ? readFolder(siblingDir)
      : await readRemoteFolder({ repo: sibling, dir: CORE_DIRS[sibling], ref: option('--ref'), token: env.GITHUB_TOKEN, fetchImpl });
  } catch (error) {
    io.error(`::error::could not read the core records of ${sibling}: ${error.message}`);
    return 2;
  }
  const problems = compareFolders({ local: readFolder(localDir), remote, self, sibling });
  for (const problem of problems) io.error(`::error::${problem}`);
  io.log(problems.length === 0 ? `core records of ${self} and ${sibling}: identical` : `${problems.length} difference(s) between the core records of ${self} and ${sibling}`);
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await run(process.argv.slice(2), process.env));
}
