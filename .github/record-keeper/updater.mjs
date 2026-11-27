// Record Keeper, the updater: keeps a repository on a released version of the kit (docs/updater.md).
//
// One file, no dependencies. It reads the pin `.github/record-keeper.yml`, asks the source repository for its releases, checks the release manifest as untrusted
// data, downloads every file of the release at the commit of its tag and verifies it against the manifest, and then either writes the files into the working
// tree (`--local`, the first adoption) or rebuilds the branch `record-keeper/update` and opens or updates the one pull request (in Actions). It downloads data and
// never runs it.
//
//   node updater.mjs                          update to the newest release of the pinned channel (a pull request)
//   node updater.mjs --dry-run                say what would change, change nothing
//   node updater.mjs --target v1.2.0          a specific release (the pinned one repairs a drift)
//   node updater.mjs --local                  write the verified files and the pin into the working tree: no branch, no push, no pull request
//   node updater.mjs --local --source <owner/name> [--target <tag>] [--channel stable|prerelease]     the first adoption
//
// The token is read from RECORD_KEEPER_TOKEN, the repository from GITHUB_REPOSITORY and the address of the API from GITHUB_API_URL (default
// https://api.github.com). Exit status: 0 when it is done or there is nothing to do, 1 when it refused or failed, 2 for wrong usage.
//
// The file is in two parts. The first is pure: it takes the pin, the releases, the manifest and the digests, and returns the plan or the reason for a refusal
// (reference/update_ref.py is a second implementation of it). The second part is the runner: HTTP and git.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PIN_PATH = '.github/record-keeper.yml';
export const BRANCH = 'record-keeper/update';
export const MANIFEST_ASSET = 'release-manifest.json';
export const CHANNELS = ['stable', 'prerelease'];
export const LIMITS = { files: 100, file: 4 * 1024 * 1024, total: 16 * 1024 * 1024, manifest: 1024 * 1024, pin: 64 * 1024, page: 8 * 1024 * 1024, pages: 50, notes: 6000, tag: 80, agents: 1024 * 1024 };
/** The kinds of file a release installs (docs/install.md): replaced by every update, copied once, or a block between two markers of a file that the repository owns. */
export const KINDS = ['managed', 'template', 'block'];
/** The files of the agents (docs/agent-files.md): the skill is a managed file, the block is rewritten between two markers of AGENTS.md, and CLAUDE.md is a template. */
export const AGENTS_PATH = 'AGENTS.md';
export const CLAUDE_PATH = 'CLAUDE.md';
export const SKILL_PATH = '.claude/skills/record-a-decision/SKILL.md';
export const BLOCK_BEGIN = '<!-- record-keeper:begin -->';
export const BLOCK_END = '<!-- record-keeper:end -->';

export const DEFAULT_API = 'https://api.github.com';
export const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;
const MAX_WAIT_SECONDS = 60;
const PER_PAGE = 30;
const USAGE = `Usage:
  updater.mjs [--dry-run] [--target <tag>]
  updater.mjs --local --source <owner/name> [--target <tag>] [--channel stable|prerelease]
`;
const TEMPLATES = ['.github/record-keeper/settings.yml', 'docs/decisions/README.md', 'docs/decisions/template.md', CLAUDE_PATH];
const MANIFEST_KEYS = ['commit', 'files', 'generations', 'node', 'requires', 'schema', 'tag', 'version'];
const ENTRY_KEYS = ['kind', 'path', 'sha256', 'size', 'source'];
const PIN_KEYS = ['source', 'version', 'commit', 'channel'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;
const COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SOURCE = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;
/** Whether a text is `owner/name`: the parts are names of GitHub, and neither is . or .., so that the text cannot walk out of /repos/ in a request. */
export const isSource = (value) => typeof value === 'string' && SOURCE.test(value) && !value.split('/').some((part) => part === '.' || part === '..');
const NAME = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const PROGRAM = new RegExp(`^\\.github/record-keeper/${NAME}\\.mjs$`);
const WORKFLOW = new RegExp(`^\\.github/workflows/records-${NAME}\\.yml$`);
const COMPARATOR = /^(>=|<)(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?$/;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The words of the refusals. A refusal is { code, detail }: the code is what the page lists, the detail is the thing it names.

const REASONS = {
  'pin-text': () => 'the pin is not a regular file of text in UTF-8',
  'pin-line': (d) => `the pin has a line that is no comment, no blank line and no "key: value" (line ${d})`,
  'pin-key': (d) => `the pin has a key that is not one of source, version, commit and channel: ${d}`,
  'pin-duplicate': (d) => `the pin names ${d} twice`,
  'pin-missing': (d) => `the pin has no ${d}`,
  'pin-value': (d) => `the pin has a ${d} that is not what it may be`,
  'source-missing': () => 'there is no pin and no --source: the first adoption names the source repository',
  'source-mismatch': (d) => `the pin names another source repository than --source (${d})`,
  'release-none': (d) => `there is no usable release of ${d}`,
  'release-duplicate': (d) => `two releases name the tag ${d}`,
  'release-missing': (d) => `there is no release ${d}`,
  'older-than-pin': (d) => `${d} is older than the pinned release: an update never goes back (revert the update pull request instead)`,
  'release-moved': (d) => `the release ${d} was made from another commit than the pin recorded`,
  'tag-target': (d) => `the tag ${d} does not point at a commit`,
  'manifest-missing': (d) => `the release ${d} has no ${MANIFEST_ASSET}`,
  'manifest-json': () => 'the manifest is not one JSON document in UTF-8 without a byte order mark',
  'manifest-large': () => 'the manifest is larger than the updater takes',
  'manifest-shape': () => 'the manifest is not an object',
  'manifest-schema': () => 'the manifest is not of schema 1',
  'manifest-keys': (d) => `the manifest has a key that it may not have, or lacks one: ${d}`,
  'manifest-tag': () => 'the manifest is not the manifest of this release: its tag differs',
  'manifest-version': () => 'the version of the manifest is not the version of its tag',
  'manifest-commit': () => 'the commit of the manifest is not a full commit id',
  'manifest-commit-moved': () => 'the commit of the manifest is not the commit that the tag points at',
  'manifest-generations': () => 'the generations of the manifest are not a list of generations',
  'manifest-node': (d) => `the range of Node.js versions of the manifest is one that the updater cannot read: ${d}`,
  'manifest-requires': () => 'the requirements of the manifest are not what the updater reads',
  'manifest-files': () => 'the list of files of the manifest is empty, too long or not a list',
  'manifest-entry': (d) => `entry ${d} of the manifest is not an object with the five keys of a file`,
  'manifest-kind': (d) => `entry ${d} of the manifest has a kind that is not managed, template or block`,
  'manifest-path': (d) => `the manifest installs a path that the updater does not install: ${d}`,
  'manifest-source': (d) => `the manifest names a source that is not a path: ${d}`,
  'manifest-digest': (d) => `entry ${d} of the manifest has a digest that is not 64 hexadecimal digits`,
  'manifest-size': (d) => `entry ${d} of the manifest has a size that is not a number of bytes within the limit`,
  'manifest-duplicate': (d) => `the manifest installs one path twice: ${d}`,
  'manifest-too-large': () => 'the files of the manifest are together larger than the updater takes',
  'node-version': (d) => `this Node.js does not satisfy the range that the release names: ${d}`,
  'download-missing': (d) => `the file ${d} of the release was not downloaded`,
  'size-mismatch': (d) => `size mismatch: ${d}`,
  'digest-mismatch': (d) => `digest mismatch: ${d}`,
  'path-blocked': (d) => `something other than a file is in the way of ${d}`,
};

/** The codes of every refusal that the page lists. */
export const CODES = Object.keys(REASONS);

/** A reason to stop that the page lists; the plan of a refusal is its code and its detail. */
export class Refused extends Error {
  constructor(code, detail = null) {
    super(REASONS[code](printable(detail ?? '')));
    this.code = code;
    this.detail = detail;
  }
}

/** A run that failed for a reason outside the rules: the network, git, a write. */
export class Failed extends Error {}

// The code points that can hide a line, a command or the end of a name: controls, soft hyphen, the marks of direction, the separators and the byte order mark.
const HIDING = [[0x00, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x61c, 0x61c], [0x180e, 0x180e], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff], [0xfff9, 0xfffb], [0xfffe, 0xffff]];
const hides = (code) => HIDING.some(([from, to]) => code >= from && code <= to);

/** The text with the characters that can hide a line, a command or the end of a name written as \u{hex}. */
export function printable(text) {
  return Array.from(String(text), (character) => (hides(character.codePointAt(0)) ? `\\u{${character.codePointAt(0).toString(16)}}` : character)).join('');
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const byBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Versions

/** The parts of a tag `v1.2.3-rc.1`, or null when it is not a tag of the kit. */
export function parseTag(tag) {
  if (typeof tag !== 'string' || tag.length > LIMITS.tag || !tag.startsWith('v')) return null;
  const found = SEMVER.exec(tag.slice(1));
  return found === null ? null : { numbers: [found[1], found[2], found[3]], pre: found[4] === undefined ? [] : found[4].split('.') };
}

const compareDigits = (a, b) => (a.length !== b.length ? a.length - b.length : a < b ? -1 : a > b ? 1 : 0);

/** Semantic version precedence of two tags: negative, zero or positive. Both must be tags of the kit. */
export function compareTags(a, b) {
  const left = parseTag(a);
  const right = parseTag(b);
  for (let i = 0; i < 3; i++) {
    const difference = compareDigits(left.numbers[i], right.numbers[i]);
    if (difference !== 0) return Math.sign(difference);
  }
  if (left.pre.length === 0 || right.pre.length === 0) return Math.sign(right.pre.length - left.pre.length);
  for (let i = 0; i < Math.min(left.pre.length, right.pre.length); i++) {
    const [x, y] = [left.pre[i], right.pre[i]];
    const [numberX, numberY] = [/^\d+$/.test(x), /^\d+$/.test(y)];
    if (numberX && numberY) {
      const difference = compareDigits(x, y);
      if (difference !== 0) return Math.sign(difference);
    } else if (numberX !== numberY) return numberX ? -1 : 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return Math.sign(left.pre.length - right.pre.length);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The pin

/** The text of the pin as the updater writes it. */
export function renderPin({ source, version, commit, channel }) {
  return `# Written by the Record Keeper updater. Do not edit it by hand, except the channel, in a pull request.\nsource: ${source}\nversion: ${version}\ncommit: ${commit}\nchannel: ${channel}\n`;
}

const PIN_VALUES = {
  source: isSource,
  version: (value) => parseTag(value) !== null,
  commit: (value) => COMMIT.test(value),
  channel: (value) => CHANNELS.includes(value),
};

/** Reads the text of the pin: { source, version, commit, channel }. Throws Refused. */
export function parsePin(text) {
  const found = new Map();
  for (const [index, line] of text.split('\n').entries()) {
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([a-z]+): ([!-~]+)$/.exec(line);
    if (match === null) throw new Refused('pin-line', index + 1);
    const [, key, value] = match;
    if (!PIN_KEYS.includes(key)) throw new Refused('pin-key', key);
    if (found.has(key)) throw new Refused('pin-duplicate', key);
    if (!PIN_VALUES[key](value)) throw new Refused('pin-value', key);
    found.set(key, value);
  }
  for (const key of PIN_KEYS) if (!found.has(key)) throw new Refused('pin-missing', key);
  return Object.fromEntries(PIN_KEYS.map((key) => [key, found.get(key)]));
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Which release

/** The releases that are tags of the kit and are published: a draft, an entry that is not a release and a tag that is not `v` and a semantic version are left out. */
export function usableReleases(releases) {
  const usable = releases.filter((release) => isObject(release) && release.draft === false && typeof release.prerelease === 'boolean' && parseTag(release.tag_name) !== null);
  const seen = new Set();
  for (const release of usable) {
    if (seen.has(release.tag_name)) throw new Refused('release-duplicate', release.tag_name);
    seen.add(release.tag_name);
  }
  return usable;
}

/**
 * Which release to go to. { status: 'current', latest } when nothing newer than the pin exists on the channel, or { status: 'chosen', release }. A `target`
 * is that release, whatever the channel says; the pinned one is allowed (it repairs a drift), an older one is not. Throws Refused.
 */
export function selectRelease({ pin, channel, target, releases }) {
  const usable = usableReleases(releases);
  if (target !== null && target !== undefined) {
    const release = usable.find((item) => item.tag_name === target);
    if (release === undefined) throw new Refused('release-missing', target);
    if (pin !== null && compareTags(target, pin.version) < 0) throw new Refused('older-than-pin', target);
    return { status: 'chosen', release };
  }
  const wanted = usable.filter((release) => channel === 'prerelease' || (release.prerelease === false && parseTag(release.tag_name).pre.length === 0));
  if (wanted.length === 0) throw new Refused('release-none', channel);
  const best = wanted.reduce((a, b) => (compareTags(b.tag_name, a.tag_name) > 0 ? b : a));
  if (pin !== null && compareTags(best.tag_name, pin.version) <= 0) return { status: 'current', latest: best.tag_name };
  return { status: 'chosen', release: best };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The manifest, as untrusted data

/** The manifest from its bytes (or text): one JSON document in UTF-8 without a byte order mark. Throws Refused. */
export function parseManifest(bytes) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes));
  } catch {
    throw new Refused('manifest-json');
  }
}

/**
 * Whether a text is a path of the kit: printable ASCII, relative, written with `/`, with no backslash or colon and no part that is empty, starts or ends with a
 * space, ends with a dot (which is also what `.` and `..` do) or is `.git` in any case.
 */
export function isKitPath(value) {
  if (typeof value !== 'string' || !/^[\x20-\x7e]+$/.test(value) || value.startsWith('/') || /[\\:]/.test(value)) return false;
  return value.split('/').every((part) => part !== '' && !part.startsWith(' ') && !part.endsWith(' ') && !part.endsWith('.') && part.toLowerCase() !== '.git');
}

/** Whether the updater installs this path for a file of this kind: the only places it writes (docs/updater.md). */
export const mayInstall = (kind, destination) => {
  if (kind === 'managed') return typeof destination === 'string' && (PROGRAM.test(destination) || WORKFLOW.test(destination) || destination === SKILL_PATH);
  return kind === 'block' ? destination === AGENTS_PATH : TEMPLATES.includes(destination);
};

const isIntegral = (value) => typeof value === 'number' && Number.isSafeInteger(value);
const isTextList = (value, pattern) => Array.isArray(value) && value.every((item) => typeof item === 'string' && pattern.test(item)) && new Set(value).size === value.length;

/** The range of Node.js versions of a manifest as [[operator, [major, minor, patch]], ...], or null when it is not one the updater reads. */
export function parseRange(range) {
  if (typeof range !== 'string') return null;
  const comparators = [];
  for (const word of range.split(' ')) {
    const match = COMPARATOR.exec(word);
    if (match === null) return null;
    comparators.push([match[1], [match[2], match[3] ?? '0', match[4] ?? '0']]);
  }
  return comparators;
}

const compareVersions = (a, b) => {
  for (let i = 0; i < 3; i++) {
    const difference = compareDigits(a[i], b[i]);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
};

/** Whether a Node.js version (`22.6.0`) satisfies a range that `parseRange` read. */
export const satisfies = (node, comparators) => comparators.every(([operator, wanted]) => (operator === '>=' ? compareVersions(node.split('.'), wanted) >= 0 : compareVersions(node.split('.'), wanted) < 0));

/**
 * Judges a manifest that was downloaded for the release `tag`, whose tag points at `commit`: the form, the tag, the commit and every file. Returns nothing;
 * throws Refused with the first thing that is wrong. The form is exact: a key that is not on the page, or missing, is a refusal.
 */
export function checkManifest(manifest, { tag, commit }) {
  if (!isObject(manifest)) throw new Refused('manifest-shape');
  if (manifest.schema !== 1) throw new Refused('manifest-schema');
  const keys = Object.keys(manifest).sort(byBytes);
  const unknown = keys.find((key) => !MANIFEST_KEYS.includes(key));
  const lacking = MANIFEST_KEYS.find((key) => !Object.hasOwn(manifest, key));
  if (unknown !== undefined || lacking !== undefined) throw new Refused('manifest-keys', unknown ?? lacking);
  if (manifest.tag !== tag) throw new Refused('manifest-tag');
  if (typeof manifest.version !== 'string' || parseTag(`v${manifest.version}`) === null || `v${manifest.version}` !== tag) throw new Refused('manifest-version');
  if (typeof manifest.commit !== 'string' || !COMMIT.test(manifest.commit)) throw new Refused('manifest-commit');
  if (manifest.commit !== commit) throw new Refused('manifest-commit-moved');
  if (!Array.isArray(manifest.generations) || manifest.generations.length === 0 || !isTextList(manifest.generations, /^g[1-9]\d{0,8}$/)) throw new Refused('manifest-generations');
  if (parseRange(manifest.node) === null) throw new Refused('manifest-node', manifest.node);
  const { requires } = manifest;
  const ruleset = (item) => isObject(item) && Object.keys(item).sort().join() === 'branch,checks,up-to-date' && typeof item.branch === 'string' && /^[A-Za-z0-9 ._/()#:+-]{1,100}$/.test(item.branch)
    && isTextList(item.checks, /^[A-Za-z0-9 ._/()#:+-]{1,100}$/) && typeof item['up-to-date'] === 'boolean';
  if (!isObject(requires) || Object.keys(requires).sort().join() !== 'rulesets,secrets,settings' || !isTextList(requires.secrets, /^[A-Z][A-Z0-9_]{0,99}$/)
    || !isTextList(requires.settings, /^[a-z][a-z-]{0,49}$/) || !Array.isArray(requires.rulesets) || !requires.rulesets.every(ruleset)) throw new Refused('manifest-requires');
  const { files } = manifest;
  if (!Array.isArray(files) || files.length === 0 || files.length > LIMITS.files) throw new Refused('manifest-files');
  for (const [index, entry] of files.entries()) {
    const at = index + 1;
    if (!isObject(entry) || Object.keys(entry).sort().join() !== ENTRY_KEYS.join()) throw new Refused('manifest-entry', at);
    if (!KINDS.includes(entry.kind)) throw new Refused('manifest-kind', at);
    if (!mayInstall(entry.kind, entry.path)) throw new Refused('manifest-path', entry.path);
    if (!isKitPath(entry.source)) throw new Refused('manifest-source', entry.source);
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) throw new Refused('manifest-digest', at);
    if (!isIntegral(entry.size) || entry.size < 0 || entry.size > LIMITS.file) throw new Refused('manifest-size', at);
  }
  const seen = new Set();
  for (const { path: destination } of files) {
    if (seen.has(destination)) throw new Refused('manifest-duplicate', destination);
    seen.add(destination);
  }
  if (files.reduce((sum, { size }) => sum + size, 0) > LIMITS.total) throw new Refused('manifest-too-large');
}

/** Whether this Node.js can run the release: the range of its manifest. Throws Refused. */
export function checkNode(manifest, node) {
  if (!satisfies(node, parseRange(manifest.node))) throw new Refused('node-version', manifest.node);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The block of AGENTS.md (docs/agent-files.md): the one place where the kit writes into a file that the repository owns. It is the text between two marker lines
// and nothing else. These functions are pure and are the only ones that find, replace or compare the block: the updater, the pull request check, the audit and the
// setup check all use them. A file is read as bytes, one byte for one character (latin1), so that what is outside the markers is never decoded and never changes.

const STEMS = ['record-keeper:begin', 'record-keeper:end'];
const NEWLINE = Buffer.from('\n');

/** A fence of Markdown at the start of a line: up to three spaces, then three or more backticks or tildes. { mark, count, info } or null. */
function fenceOf(line) {
  let at = 0;
  while (line[at] === ' ') at++;
  if (at > 3 || (line[at] !== '`' && line[at] !== '~')) return null;
  const mark = line[at];
  let count = 0;
  while (line[at + count] === mark) count++;
  return count < 3 ? null : { mark, count, info: line.slice(at + count) };
}

/**
 * Where the block is in the bytes of a file. A marker is a whole line, with a carriage return allowed at its end, outside every fenced code block. Returns
 * { state: 'none', fenced } when there is no marker (`fenced` says that the file ends inside a code fence), { state: 'one', start, end } for one begin marker and
 * one end marker after it (`start` is the first byte of the begin line, `end` is the byte after the end marker, and the line end after it is not part of the
 * block), or { state: 'refused', why } for anything else: a line that holds the text of a marker and more (`partial-line`), a begin marker with no end
 * (`begin-without-end`), an end marker with no begin (`end-without-begin`), an end before the begin (`reversed`), or two or more of either (`doubled`).
 */
export function readBlock(bytes) {
  const text = Buffer.from(bytes).toString('latin1');
  const marks = [];
  let fence = null;
  for (let from = 0; ;) {
    const newline = text.indexOf('\n', from);
    const raw = text.slice(from, newline === -1 ? text.length : newline);
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const found = fenceOf(line);
    if (fence !== null) {
      if (found !== null && found.mark === fence.mark && found.count >= fence.count && /^[ \t]*$/.test(found.info)) fence = null;
    } else if (found !== null && !(found.mark === '`' && found.info.includes('`'))) fence = found;
    else if (line === BLOCK_BEGIN) marks.push({ kind: 'B', at: from });
    else if (line === BLOCK_END) marks.push({ kind: 'E', at: from + line.length });
    else if (STEMS.some((stem) => line.includes(stem))) return { state: 'refused', why: 'partial-line' };
    if (newline === -1) break;
    from = newline + 1;
  }
  const kinds = marks.map((mark) => mark.kind).join('');
  if (kinds === '') return { state: 'none', fenced: fence !== null };
  if (kinds === 'BE') return { state: 'one', start: marks[0].at, end: marks[1].at };
  return { state: 'refused', why: { B: 'begin-without-end', E: 'end-without-begin', EB: 'reversed' }[kinds] ?? 'doubled' };
}

/** The block of a file, as the bytes between the markers (the markers included), or null when the file has none or its markers are refused. */
export function blockOf(bytes) {
  const found = readBlock(bytes);
  return found.state === 'one' ? Buffer.from(bytes).subarray(found.start, found.end) : null;
}

/**
 * The file `current` (bytes, or null when there is none) with the block `block` in it, or the reason why it cannot be: { ok: true, action, output } where the action is
 * `create` (there was no file), `append` (a file without markers: the block goes at the end, after one blank line), `replace` (the bytes between the markers change)
 * or `current` (they are the block already, and the output is the file as it was); or { ok: false, why }. Outside the markers not a byte changes. The refusals are the
 * why of `readBlock`, `not-text` (no markers, and a zero byte: not a text that can be added to), `fence` (no markers, and the file ends inside a code fence, where the block
 * would be taken for an example) and `invalid-block` (the text to put in is not one begin marker, text and one end marker, and nothing else).
 */
export function spliceBlock(current, block) {
  const text = Buffer.from(block);
  const own = readBlock(text);
  if (own.state !== 'one' || own.start !== 0 || own.end !== text.length) return { ok: false, why: 'invalid-block' };
  if (current === null) return { ok: true, action: 'create', output: Buffer.concat([text, NEWLINE]) };
  const have = Buffer.from(current);
  const found = readBlock(have);
  if (found.state === 'refused') return { ok: false, why: found.why };
  if (found.state === 'one') {
    if (have.subarray(found.start, found.end).equals(text)) return { ok: true, action: 'current', output: have };
    return { ok: true, action: 'replace', output: Buffer.concat([have.subarray(0, found.start), text, have.subarray(found.end)]) };
  }
  if (have.includes(0)) return { ok: false, why: 'not-text' };
  if (found.fenced) return { ok: false, why: 'fence' };
  if (have.length === 0) return { ok: true, action: 'append', output: Buffer.concat([text, NEWLINE]) };
  const tail = have.subarray(-3).toString('latin1');
  const separator = tail.endsWith('\n\n') || tail.endsWith('\n\r\n') ? '' : tail.endsWith('\n') ? '\n' : '\n\n';
  return { ok: true, action: 'append', output: Buffer.concat([have, Buffer.from(separator), text, NEWLINE]) };
}

/**
 * Whether the text that agents read has changed between two versions of AGENTS.md (bytes, or null for no file): the block between the markers, or the markers. A change
 * outside them is nothing. Two files without markers are the same, whatever they say. A file whose markers are refused is compared whole, so that any change to it, and
 * any change between it and a file with a block or none, counts: the check cannot tell what is inside.
 */
export function blockChanged(before, after) {
  const view = (bytes) => {
    if (bytes === null) return { kind: 'none' };
    const found = readBlock(bytes);
    if (found.state === 'none') return { kind: 'none' };
    return found.state === 'one' ? { kind: 'one', bytes: Buffer.from(bytes).subarray(found.start, found.end) } : { kind: 'refused', bytes: Buffer.from(bytes) };
  };
  const [x, y] = [view(before), view(after)];
  return x.kind !== y.kind || (x.kind !== 'none' && !x.bytes.equals(y.bytes));
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The plan

const sorted = (list) => [...list].sort(byBytes);

/** The actions on the block that write AGENTS.md. */
const WRITES = ['create', 'append', 'replace'];

/**
 * What the update does with the block of AGENTS.md: { path, action, why, digest } where the action is `create`, `append`, `replace`, `current` or `refused` (and `why` is then the
 * reason of `spliceBlock`, or `not-a-file` or `too-large` for a place that holds something else, or a file that is larger than the updater reads), and `digest` is the SHA-256
 * of the block that stands in the file now, for a `replace`. `text` is the bytes of the block of the release: they are the bytes that the manifest names, or nothing is done.
 */
function planBlock(entry, here, text) {
  if (text === undefined) throw new Refused('download-missing', entry.source);
  if (sha256(text) !== entry.sha256) throw new Refused('digest-mismatch', entry.path);
  const said = (action, why = null, digest = null) => ({ path: entry.path, action, why, digest });
  if (here.kind === 'large') return said('refused', 'too-large');
  if (here.kind !== 'absent' && here.kind !== 'file') return said('refused', 'not-a-file');
  const result = spliceBlock(here.kind === 'absent' ? null : here.bytes, text);
  if (!result.ok) return said('refused', result.why);
  return said(result.action, null, result.action === 'replace' ? sha256(blockOf(here.bytes)) : null);
}

/**
 * What an update does: the plan of a release, from the pin, the manifest of the release and of the pinned release, the digests of what was downloaded and what the
 * working tree holds. `manifest` and `previous` are bytes or text; `previous` is null when the pinned release has no manifest to read. `downloaded` maps a source
 * to { sha256, size }; `tree` maps a destination to { kind: 'absent' | 'file' | 'large' | 'dir' | 'link' | 'other' | 'blocked', sha256? } (a missing path is absent), and for
 * AGENTS.md a `file` also has its `bytes`; `blocks` maps the source of an entry of the kind `block` to its bytes. Returns { status: 'update' | 'unchanged', ... } or
 * throws Refused.
 */
export function planUpdate({ pin, source, channel, tag, tagCommit, manifest: manifestBytes, previous: previousBytes, node, downloaded, tree, blocks = {}, pinText }) {
  const manifest = parseManifest(manifestBytes);
  checkManifest(manifest, { tag, commit: tagCommit });
  checkNode(manifest, node);
  if (pin !== null && tag === pin.version && manifest.commit !== pin.commit) throw new Refused('release-moved', tag);
  const files = [...manifest.files].sort((a, b) => byBytes(a.path, b.path));
  for (const entry of files) {
    const got = Object.hasOwn(downloaded, entry.source) ? downloaded[entry.source] : undefined;
    if (!isObject(got)) throw new Refused('download-missing', entry.source);
    if (got.size !== entry.size) throw new Refused('size-mismatch', entry.path);
    if (got.sha256 !== entry.sha256) throw new Refused('digest-mismatch', entry.path);
  }
  const state = (destination) => (Object.hasOwn(tree, destination) ? tree[destination] : { kind: 'absent' });
  for (const destination of [PIN_PATH, ...files.filter((entry) => entry.kind === 'managed').map((entry) => entry.path)]) {
    const { kind } = state(destination);
    if (kind !== 'absent' && kind !== 'file') throw new Refused('path-blocked', destination);
  }
  const warnings = [];
  let before = null;
  if (pin !== null && previousBytes === null) warnings.push({ code: 'previous-missing', detail: pin.version });
  else if (pin !== null) {
    try {
      const old = parseManifest(previousBytes);
      checkManifest(old, { tag: pin.version, commit: pin.commit });
      before = old;
    } catch (error) {
      if (!(error instanceof Refused)) throw error;
      warnings.push({ code: 'previous-unusable', detail: error.code });
    }
  }
  const was = new Map((before === null ? [] : before.files.filter((entry) => entry.kind === 'managed')).map((entry) => [entry.path, entry]));
  const wasTemplates = new Set((before === null ? [] : before.files.filter((entry) => entry.kind === 'template')).map((entry) => entry.path));
  const wasBlock = new Map((before === null ? [] : before.files.filter((entry) => entry.kind === 'block')).map((entry) => [entry.path, entry]));
  const added = [];
  const changed = [];
  const unchanged = [];
  const templates = [];
  const kept = [];
  const overwritten = [];
  let block = null;
  for (const entry of files) {
    const here = state(entry.path);
    if (entry.kind === 'block') {
      block = planBlock(entry, here, Object.hasOwn(blocks, entry.source) ? blocks[entry.source] : undefined);
      if (block.action === 'replace' && before !== null && wasBlock.get(entry.path)?.sha256 !== block.digest) overwritten.push(entry.path);
      continue;
    }
    // A template is installed once: at the first adoption, and by the update that brings it. Where the pinned release is not known, nothing tells the two apart.
    if (entry.kind === 'template') (here.kind === 'absent' && (pin === null || (before !== null && !wasTemplates.has(entry.path))) ? templates : kept).push(entry.path);
    else if (here.kind === 'absent') added.push(entry.path);
    else if (here.sha256 === entry.sha256) unchanged.push(entry.path);
    else {
      changed.push(entry.path);
      if (before !== null && was.get(entry.path)?.sha256 !== here.sha256) overwritten.push(entry.path);
    }
  }
  const remove = [];
  const listed = new Set(files.map((entry) => entry.path));
  for (const old of sorted([...was.keys()])) {
    if (listed.has(old) || state(old).kind !== 'file') continue;
    remove.push(old);
    if (state(old).sha256 !== was.get(old).sha256) overwritten.push(old);
  }
  const text = renderPin({ source, version: manifest.tag, commit: manifest.commit, channel });
  const pinChanged = pinText !== text;
  if (block !== null && block.action === 'refused') warnings.push({ code: 'block-refused', detail: block.why });
  return {
    status: added.length + changed.length + templates.length + remove.length > 0 || pinChanged || (block !== null && WRITES.includes(block.action)) ? 'update' : 'unchanged',
    source,
    channel,
    from: pin === null ? null : pin.version,
    to: manifest.tag,
    commit: manifest.commit,
    added,
    changed,
    unchanged,
    templates,
    kept,
    remove,
    block: block === null ? null : { path: block.path, action: block.action, why: block.why },
    overwritten: sorted(overwritten),
    pin: text,
    pinChanged,
    requires: manifest.requires,
    warnings,
  };
}

/**
 * The whole decision in one call, for the tests and the reference: `pinText` (null when there is no pin), the options `source`, `channel` and `target`, the list of
 * `releases`, and for the release that is chosen its `tagCommit`, `manifest`, `previous`, `downloaded` and `tree`. Returns { status: 'refused', code, detail },
 * { status: 'current', latest } or what `planUpdate` returns.
 */
export function plan(input) {
  try {
    const pin = input.pinText === null ? null : parsePin(input.pinText);
    if (pin === null && !input.source) throw new Refused('source-missing');
    if (pin !== null && input.source && input.source !== pin.source) throw new Refused('source-mismatch', pin.source);
    const source = pin === null ? input.source : pin.source;
    const channel = input.channel ?? pin?.channel ?? 'stable';
    const chosen = selectRelease({ pin, channel, target: input.target, releases: input.releases });
    if (chosen.status === 'current') return chosen;
    return planUpdate({ ...input, previous: input.previous ?? null, pin, source, channel, tag: chosen.release.tag_name });
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    return { status: 'refused', code: error.code, detail: error.detail };
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The pull request

/** The title of the pull request. */
export const renderTitle = (from, to) => (from === to ? `chore: repair Record Keeper ${to}` : `chore: update Record Keeper ${from} to ${to}`);

/**
 * The notes of a release as text that is safe to put into a pull request: bounded, with no control or direction character, no @ (so that nobody is mentioned), and
 * in a fence that nothing inside can close, so that no link, image or reference is made live.
 */
export function fenceNotes(notes, limit = LIMITS.notes) {
  let text = Array.from(String(notes ?? '').replace(/\r\n?/g, '\n'), (character) => (character !== '\n' && character !== '\t' && hides(character.codePointAt(0)) ? '?' : character)).join('').replaceAll('@', '(at)');
  const letters = Array.from(text);
  if (letters.length > limit) text = `${letters.slice(0, limit).join('')}\n[cut after ${limit} characters: the whole text is on the page of the release]`;
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}\n${text.replace(/\n+$/, '')}\n${fence}`;
}

const listOf = (title, paths) => (paths.length === 0 ? [] : [`**${title}** (${paths.length})`, '', ...paths.map((item) => `- \`${item}\``), '']);

/** Why the block was not written, in words: the reasons of `spliceBlock`, and of a place that holds something other than a file. */
export const BLOCK_WHY = {
  'partial-line': 'a line holds the text of a marker and more',
  'begin-without-end': 'a begin marker has no end marker',
  'end-without-begin': 'an end marker has no begin marker',
  reversed: 'the end marker comes before the begin marker',
  doubled: 'there is more than one begin marker or more than one end marker',
  'not-text': 'the file holds a zero byte, so it is not text that the updater can add to',
  fence: 'the file ends inside a code fence, where the block would be taken for an example',
  'invalid-block': 'the block of the release is not one begin marker, text and one end marker',
  'not-a-file': `${AGENTS_PATH} is not a regular file`,
  'too-large': `${AGENTS_PATH} is larger than the updater reads (1 MiB)`,
};
const BLOCK_ACTION = {
  create: `${AGENTS_PATH} is created, with the Record Keeper block in it`,
  append: `the Record Keeper block is added at the end of ${AGENTS_PATH}, and nothing else in the file changes`,
  replace: `the Record Keeper block in ${AGENTS_PATH} is replaced, and nothing outside the two markers changes`,
};

/**
 * The body of the pull request from a plan and the notes of the release. A repair (the target is the pinned release) installs nothing new, so its body says what a
 * repair is and links to the page of the release, and leaves the notes out: a repair brings no change that they describe.
 */
export function renderBody(update, notes) {
  const repair = update.from !== null && update.from === update.to;
  const lines = repair
    ? [`Repairs Record Keeper **${update.to}** (\`${update.source}\`, channel \`${update.channel}\`): it restores the files of this repository that differ from release **${update.to}**, and installs nothing newer.`, '',
      `The notes of the release are on its page: https://github.com/${update.source}/releases/tag/${update.to}`, '']
    : [`Updates Record Keeper ${update.from === null ? 'to' : `from **${update.from}** to`} **${update.to}** (\`${update.source}\`, channel \`${update.channel}\`).`, '', '## Release notes', '', fenceNotes(notes), ''];
  lines.push('## Changes in this repository', '');
  const rows = [...listOf('Added', update.added), ...listOf('Changed', update.changed), ...listOf('Removed', update.remove), ...listOf('Templates installed', update.templates),
    ...(update.block !== null && Object.hasOwn(BLOCK_ACTION, update.block.action) ? ['**Block**', '', `- ${BLOCK_ACTION[update.block.action]}`, ''] : [])];
  lines.push(...(rows.length === 0 ? ['Only the pin changes.', ''] : rows));
  if (update.pinChanged) lines.push(`The pin \`${PIN_PATH}\` is rewritten: version \`${update.to}\`, commit \`${update.commit}\`.`, '');
  if (update.overwritten.length > 0) {
    lines.push('## Local changes this update overwrites', '', 'These managed files differ from what the pinned release installed, or were not installed by it. Merging replaces or removes them. A change that should stay belongs in the settings file, which an update never touches, or in a release of the kit:', '', ...update.overwritten.map((item) => `- \`${item}\`${item === AGENTS_PATH ? ' (the text between the two markers)' : ''}`), '');
  }
  const { secrets, settings, rulesets } = update.requires;
  lines.push('## What this release requires', '', 'The updater cannot see secrets, settings or rulesets. Check that these are in place:', '');
  lines.push(...secrets.map((name) => `- the repository secret \`${name}\``), ...settings.map((key) => `- the setting \`${key}\` in the settings file`));
  const names = (list) => (list.length === 1 ? `\`${list[0]}\`` : `${list.slice(0, -1).map((name) => `\`${name}\``).join(', ')} and \`${list.at(-1)}\``);
  for (const rule of rulesets) {
    const wants = [...(rule.checks.length > 0 ? [`the ${rule.checks.length === 1 ? 'check' : 'checks'} ${names(rule.checks)}`] : []), ...(rule['up-to-date'] ? ['branches to be up to date'] : [])];
    lines.push(`- a ruleset on \`${rule.branch}\`${wants.length > 0 ? ` that requires ${wants.join(' and ')}` : ''}`);
  }
  if (secrets.length + settings.length + rulesets.length === 0) lines.push('- nothing');
  lines.push('');
  if (update.warnings.length > 0) {
    lines.push('## Warnings', '');
    for (const { code, detail } of update.warnings) {
      if (code === 'block-refused') lines.push(`- **Problem: the block in ${AGENTS_PATH} was not written** (${BLOCK_WHY[detail]}). The rest of this update is not affected. Until ${AGENTS_PATH} is repaired by hand and the updater has run again, the agents read the block of the older release, or none (docs/agent-files.md of the kit).`);
      else lines.push(code === 'previous-missing' ? `- The pinned release ${printable(detail)} has no manifest that the updater could read, so the local changes this update overwrites, and the files it removes, are not listed.`
        : `- The manifest of the pinned release is not one the updater reads (${printable(detail)}), so the local changes this update overwrites, and the files it removes, are not listed.`);
    }
    lines.push('');
  }
  lines.push('## Approval', '', 'This pull request changes the pin, the workflows and the programs that judge every later pull request, so merging it needs the approval of the owners, like any change of those files. Read the diff of every file in it.', '');
  lines.push('---', `This pull request is rebuilt from scratch on every run of the updater. Do not push to \`${BRANCH}\`; merge it or close it.`);
  return lines.join('\n');
}

/** The commit message of the update. */
export const renderMessage = (update) => `${renderTitle(update.from, update.to)}\n\nsource: ${update.source}\nversion: ${update.to}\ncommit: ${update.commit}\n`;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The command line

/** The options of the command line, or null when it is not one. */
export function parseArgs(argv) {
  const options = { dryRun: false, local: false, target: null, source: null, channel: null };
  const flags = { '--dry-run': 'dryRun', '--local': 'local' };
  const values = { '--target': ['target', (value) => parseTag(value) !== null], '--source': ['source', isSource], '--channel': ['channel', (value) => CHANNELS.includes(value)] };
  const given = new Set();
  for (let at = 0; at < argv.length; at++) {
    const name = argv[at];
    if (given.has(name)) return null;
    given.add(name);
    if (Object.hasOwn(flags, name)) options[flags[name]] = true;
    else if (Object.hasOwn(values, name) && values[name][1](argv[at + 1])) options[values[name][0]] = argv[++at];
    else return null;
  }
  return options;
}

/** The token and everything that was read from a remote place, taken out of a text that is printed. */
export const redact = (text, secrets) => secrets.filter((secret) => secret !== undefined && secret !== '').reduce((out, secret) => out.replaceAll(secret, '***'), text);


// ---------------------------------------------------------------------------------------------------------------------------------------------
// The runner: HTTP

/** The address of the API without a trailing slash: https, or http for localhost only, with no credentials, query or fragment. Throws Failed. */
export function apiBase(address) {
  let url;
  try {
    url = new URL(address);
  } catch {
    throw new Failed('GITHUB_API_URL is not an address');
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const plain = url.protocol === 'https:' || (url.protocol === 'http:' && local);
  if (!plain || url.username !== '' || url.password !== '' || /[?#]/.test(address)) throw new Failed('GITHUB_API_URL must be an https address without credentials, query or fragment');
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** The body of a response, at most `limit` bytes: { bytes, over } where `over` says that there was more, which was not read. */
async function readBounded(response, limit) {
  if (response.body === null) return { bytes: Buffer.alloc(0), over: false };
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > limit) {
    await response.body.cancel();
    return { bytes: Buffer.alloc(0), over: true };
  }
  const chunks = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return { bytes: Buffer.concat(chunks), over: true };
    }
    chunks.push(value);
  }
  return { bytes: Buffer.concat(chunks), over: false };
}

/** Where a download may be sent on to: the API itself, and, for GitHub, the host that holds its release assets. It is sent there without the token. */
export function mayFollow(base, location, from) {
  let to;
  try {
    to = new URL(location, from);
  } catch {
    return false;
  }
  if (to.username !== '' || to.password !== '') return false;
  if (to.origin === new URL(base).origin) return true;
  return base === DEFAULT_API && to.protocol === 'https:' && (to.hostname === 'githubusercontent.com' || to.hostname.endsWith('.githubusercontent.com'));
}

/**
 * One request to the API. A redirect is never followed here, so the token cannot be sent to another place (a download that GitHub sends on is followed by the
 * caller, once, without the token). A GET is repeated, at most `ATTEMPTS` times in all, when the connection failed, GitHub answered 5xx or asked to wait for a
 * moment (the secondary limit); a request that writes is never repeated.
 */
export async function request(context, method, target, { accept = 'application/vnd.github+json', body, ok = [200], limit = LIMITS.page, redirects = false, authorize = true } = {}) {
  const url = target.startsWith('http') ? target : context.base + target;
  const where = printable(url.startsWith(context.base) ? url.slice(context.base.length) : new URL(url).origin);
  for (let attempt = 1; ; attempt++) {
    let response;
    try {
      response = await context.fetch(url, {
        method,
        headers: {
          Accept: accept,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': context.agent ?? 'record-keeper-updater',
          ...(authorize && context.token !== undefined ? { Authorization: `Bearer ${context.token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
        signal: AbortSignal.timeout(context.timeout),
      });
    } catch (error) {
      if (method === 'GET' && attempt < ATTEMPTS) {
        await context.sleep(1000 * attempt);
        continue;
      }
      throw new Failed(`${method} ${where} failed: ${printable(error.cause?.message || error.cause?.code || error.message).slice(0, 200)}`);
    }
    if (redirects && [301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (location === null) throw new Failed(`${method} ${where} answered ${response.status} and did not say where the download is`);
      return { location };
    }
    if (!ok.includes(response.status)) {
      const said = printable((await readBounded(response, 2000)).bytes.toString('utf8').replace(/\s+/g, ' ')).slice(0, 200);
      const limited = (response.status === 403 || response.status === 429) && response.headers.get('x-ratelimit-remaining') === '0';
      const after = Number(response.headers.get('retry-after'));
      const asked = (response.status === 403 || response.status === 429) && Number.isFinite(after) && after > 0 && after <= MAX_WAIT_SECONDS;
      if (method === 'GET' && attempt < ATTEMPTS && !limited && (response.status >= 500 || asked)) {
        await context.sleep(asked ? after * 1000 : 1000 * attempt);
        continue;
      }
      if (limited) {
        const reset = Number(response.headers.get('x-ratelimit-reset'));
        throw new Failed(`${method} ${where} answered ${response.status}: the rate limit is used up${Number.isFinite(reset) && reset > 0 && reset < 1e11 ? ` and resets at ${new Date(reset * 1000).toISOString()}` : ''}; run again later, with a token`);
      }
      throw new Failed(`${method} ${where} answered ${response.status}${said === '' ? '' : `: ${said}`}`);
    }
    const read = await readBounded(response, limit);
    return { status: response.status, headers: response.headers, bytes: read.bytes, over: read.over, location: null };
  }
}

export async function getJson(context, target) {
  const answer = await request(context, 'GET', target);
  const where = printable(target.startsWith(context.base) ? target.slice(context.base.length) : target);
  if (answer.over) throw new Failed(`the answer to ${where} is larger than the updater takes`);
  try {
    return { body: JSON.parse(answer.bytes.toString('utf8')), headers: answer.headers };
  } catch {
    throw new Failed(`the answer to ${where} is not JSON`);
  }
}

/** The page after this one, or null: the `Link` header of GitHub, `rel="next"`, which must stay on the API. */
export function nextPage(context, link, seen) {
  const next = [...(link ?? '').matchAll(/<([^>]*)>([^<]*)/g)].find(([, , parameters]) => /;\s*rel="([^"]*\s)?next(\s[^"]*)?"/.test(parameters));
  if (next === undefined) return null;
  let url;
  try {
    url = new URL(next[1], `${context.base}/`).href;
  } catch {
    throw new Failed('the link to the next page is not the API');
  }
  if (!url.startsWith(`${context.base}/`)) throw new Failed('the link to the next page is not the API');
  if (seen.has(url)) throw new Failed('the link to the next page goes back to a page that was read');
  return url;
}

/** Every release of the source, all pages. */
export async function listReleases(context, source) {
  const releases = [];
  const seen = new Set();
  let url = `/repos/${source}/releases?per_page=${PER_PAGE}`;
  while (url !== null) {
    if (seen.size === LIMITS.pages) throw new Failed(`more than ${LIMITS.pages} pages of releases`);
    seen.add(url.startsWith('http') ? url : context.base + url);
    const { body, headers } = await getJson(context, url);
    if (!Array.isArray(body)) throw new Failed('the list of releases is not a list');
    releases.push(...body);
    url = nextPage(context, headers.get('link'), seen);
  }
  return releases;
}

const objectOf = (value) => (isObject(value) && isObject(value.object) && ['commit', 'tag'].includes(value.object.type) && COMMIT.test(String(value.object.sha)) ? value.object : null);

/** The commit that a tag points at, through annotated tags. Throws Refused when it is not a commit. */
async function tagCommit(context, source, tag) {
  let object = objectOf((await getJson(context, `/repos/${source}/git/ref/tags/${encodeURIComponent(tag)}`)).body);
  for (let depth = 0; object !== null && object.type === 'tag' && depth < 5; depth++) object = objectOf((await getJson(context, `/repos/${source}/git/tags/${object.sha}`)).body);
  if (object === null || object.type !== 'commit') throw new Refused('tag-target', tag);
  return object.sha;
}

/** The bytes of the manifest of a release, or null when the release has none. A download that GitHub sends on is followed once, to a place `mayFollow` allows, without the token. */
export async function downloadManifest(context, source, release) {
  const asset = Array.isArray(release.assets) ? release.assets.find((item) => isObject(item) && item.name === MANIFEST_ASSET) : undefined;
  if (asset === undefined || !Number.isSafeInteger(asset.id) || asset.id <= 0) return null;
  const route = `/repos/${source}/releases/assets/${asset.id}`;
  let answer = await request(context, 'GET', route, { accept: 'application/octet-stream', limit: LIMITS.manifest, redirects: true });
  if (answer.location !== null) {
    if (!mayFollow(context.base, answer.location, context.base + route)) throw new Failed(`the download of the manifest was sent to a place that the updater does not follow: ${printable(answer.location).slice(0, 100)}`);
    answer = await request(context, 'GET', new URL(answer.location, context.base + route).href, { accept: 'application/octet-stream', limit: LIMITS.manifest, authorize: false });
  }
  if (answer.over) throw new Refused('manifest-large');
  return answer.bytes;
}

/** The bytes of a file of the release at its commit, and their digest and size; a file that is larger than the manifest says is read no further. */
async function downloadFile(context, source, commit, name, size) {
  const route = `/repos/${source}/contents/${name.split('/').map(encodeURIComponent).join('/')}?ref=${commit}`;
  const answer = await request(context, 'GET', route, { accept: 'application/vnd.github.raw+json', limit: size });
  return { bytes: answer.bytes, sha256: answer.over ? null : sha256(answer.bytes), size: answer.over ? size + 1 : answer.bytes.length };
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The runner: the working tree and git

/** What is at a path of the working tree, without following a link: the states that `planUpdate` reads. */
export function inspect(root, relative) {
  let at = root;
  const parts = relative.split('/');
  for (const [index, part] of parts.entries()) {
    at = path.join(at, part);
    let stat;
    try {
      stat = fs.lstatSync(at);
    } catch (error) {
      // Every folder on the way was looked at and is a folder, so what is not there is not there: ENOTDIR cannot happen.
      if (error.code === 'ENOENT') return { kind: 'absent' };
      throw new Failed(`cannot read ${printable(relative)}: ${error.code ?? error.message}`);
    }
    if (index < parts.length - 1) {
      if (!stat.isDirectory()) return { kind: 'blocked' };
    } else if (stat.isSymbolicLink()) return { kind: 'link' };
    else if (stat.isDirectory()) return { kind: 'dir' };
    else if (!stat.isFile()) return { kind: 'other' };
    else return { kind: 'file', sha256: stat.size > 64 * 1024 * 1024 ? null : sha256(fs.readFileSync(at)) };
  }
  // Not reached: a path has at least one part, and the last part returns.
  return { kind: 'absent' };
}

/** What AGENTS.md is in the working tree: as `inspect` says it, and for a file its bytes. A file larger than the updater reads is `large` and is not read. */
export function inspectAgents(root) {
  const here = inspect(root, AGENTS_PATH);
  if (here.kind !== 'file') return here;
  const target = path.join(root, AGENTS_PATH);
  if (fs.statSync(target).size > LIMITS.agents) return { kind: 'large' };
  return { ...here, bytes: fs.readFileSync(target) };
}

/** The text of the pin of a working tree, or null when there is none. Throws Refused when it is there and is not a small file of text. */
export function readPin(root) {
  const here = inspect(root, PIN_PATH);
  if (here.kind === 'absent') return null;
  if (here.kind !== 'file' || fs.statSync(path.join(root, PIN_PATH)).size > LIMITS.pin) throw new Refused('pin-text');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(path.join(root, PIN_PATH)));
  } catch {
    throw new Refused('pin-text');
  }
}

/** Writes a file whole and in one step: a file of its own beside it, then a rename. AGENTS.md is the repository's, so it keeps the mode it has. */
function writeFile(root, relative, bytes) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.updating-${process.pid}`;
  const mode = relative === AGENTS_PATH && fs.existsSync(target) ? fs.statSync(target).mode & 0o777 : 0o644;
  fs.writeFileSync(temporary, bytes, { flag: 'wx', mode });
  fs.chmodSync(temporary, mode);
  fs.renameSync(temporary, target);
}

/** Writes what a plan says into the working tree: the files, the templates that are missing, the removals, and the pin last. */
function writeAll(root, update, contents) {
  for (const [destination, bytes] of contents) writeFile(root, destination, bytes);
  for (const destination of update.remove) fs.rmSync(path.join(root, destination), { force: true });
  writeFile(root, PIN_PATH, update.pin);
}

const GIT_LOCATION = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_NAMESPACE', 'GIT_PREFIX'];
const BOT = { GIT_AUTHOR_NAME: 'github-actions[bot]', GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com', GIT_COMMITTER_NAME: 'github-actions[bot]', GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com' };

/** Runs git in the working tree, with no hook, no signing and no prompt, and with no variable that says which repository it is. Returns what it printed. */
function git(context, args, { allow = [0], env = {} } = {}) {
  const base = Object.fromEntries(Object.entries(context.gitEnv).filter(([name]) => !GIT_LOCATION.includes(name)));
  const result = spawnSync('git', ['--literal-pathspecs', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'core.fsmonitor=false', ...args], { cwd: context.root, env: { ...base, GIT_TERMINAL_PROMPT: '0', ...env }, encoding: 'utf8' });
  if (result.error !== undefined || !allow.includes(result.status)) {
    throw new Failed(`git ${args[0]} failed: ${printable(`${result.stderr ?? ''}${result.error?.message ?? ''}`.trim().replace(/\s+/g, ' ')).slice(0, 300)}`);
  }
  return result.stdout.trim();
}

/** Pushes the update branch, and no other: the one place that writes to a branch of the repository. */
export function pushBranch(context, name, commit) {
  if (name !== BRANCH) throw new Failed(`the updater pushes ${BRANCH} and no other branch (asked for ${printable(name).slice(0, 80)})`);
  if (!/^[0-9a-f]{40,64}$/.test(commit)) throw new Failed('the updater pushes a commit id');
  git(context, ['push', '--quiet', '--force', 'origin', `${commit}:refs/heads/${BRANCH}`]);
}

const remoteTip = (context, branch) => git(context, ['ls-remote', 'origin', `refs/heads/${branch}`]).split(/\s+/)[0] || null;

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The runner: the pull request

/** The open pull request of the update branch against the default branch, or null. */
async function openPull(context, defaultBranch) {
  const owner = context.repo.split('/')[0];
  const { body } = await getJson(context, `/repos/${context.repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${BRANCH}`)}&base=${encodeURIComponent(defaultBranch)}&per_page=100`);
  if (!Array.isArray(body)) throw new Failed('the list of pull requests is not a list');
  const mine = body.filter((pull) => isObject(pull) && Number.isSafeInteger(pull.number) && isObject(pull.head) && pull.head.ref === BRANCH && isObject(pull.base) && pull.base.ref === defaultBranch);
  return mine.sort((a, b) => a.number - b.number)[0] ?? null;
}

/** The one pull request of the update branch: updated when it is open, made when it is not. */
async function upsertPull(context, defaultBranch, title, body) {
  const open = await openPull(context, defaultBranch);
  if (open !== null) {
    await request(context, 'PATCH', `/repos/${context.repo}/pulls/${open.number}`, { body: { title, body } });
    return { number: open.number, created: false };
  }
  const answer = await request(context, 'POST', `/repos/${context.repo}/pulls`, { body: { title, body, head: BRANCH, base: defaultBranch, maintainer_can_modify: false }, ok: [201] });
  let made = null;
  try {
    made = JSON.parse(answer.bytes.toString('utf8'));
  } catch {
    // not JSON: the check below says so
  }
  if (!isObject(made) || !Number.isSafeInteger(made.number)) throw new Failed('the answer to the new pull request is not a pull request');
  return { number: made.number, created: true };
}

/** An update pull request that has nothing to update to any more is closed, with a comment that says why. */
async function retirePull(context, defaultBranch, why, say) {
  const open = await openPull(context, defaultBranch);
  if (open === null) return;
  await request(context, 'POST', `/repos/${context.repo}/issues/${open.number}/comments`, { body: { body: `Closed by the Record Keeper updater: ${why}` }, ok: [201] });
  await request(context, 'PATCH', `/repos/${context.repo}/pulls/${open.number}`, { body: { state: 'closed' } });
  say(`closed pull request #${open.number}: ${why}`);
}

/** Rebuilds the update branch from the default branch, pushes it when it is not the one that is there, and makes or updates the pull request. */
async function publish(context, update, contents, notes, defaultBranch, say) {
  const head = git(context, ['rev-parse', 'HEAD']);
  if (remoteTip(context, defaultBranch) !== head) throw new Failed(`the working tree is not at the head of ${printable(defaultBranch)} on origin: check out that branch, and run again`);
  if (git(context, ['status', '--porcelain', '--untracked-files=all']) !== '') throw new Failed('the working tree has changes that are not committed: the update branch is built from a clean checkout');
  const before = git(context, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allow: [0, 1] }) || head;
  git(context, ['checkout', '--quiet', '-B', BRANCH, head]);
  try {
    writeAll(context.root, update, contents);
    git(context, ['add', '--all', '--', PIN_PATH, ...contents.keys(), ...update.remove]);
    // The commit is made of the base, the tree and the message and has the date of the base, so that the same update on the same base is the same commit: a run
    // that changes nothing pushes nothing, and the checks of the pull request do not start again.
    const date = git(context, ['log', '-1', '--format=%cI', head]);
    git(context, ['commit', '--quiet', '--no-verify', '--message', renderMessage(update)], { env: { ...BOT, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
    const commit = git(context, ['rev-parse', 'HEAD']);
    if (remoteTip(context, BRANCH) === commit) say(`branch ${BRANCH} is up to date`);
    else {
      pushBranch(context, BRANCH, commit);
      say(`pushed ${BRANCH} (${commit.slice(0, 7)})`);
    }
    const pull = await upsertPull(context, defaultBranch, renderTitle(update.from, update.to), renderBody(update, notes));
    say(`${pull.created ? 'opened' : 'updated'} pull request #${pull.number}`);
  } finally {
    // Whatever happened on the update branch, the working tree goes back to where it was. It was clean when the branch was made, so nothing of a person's is lost.
    git(context, ['checkout', '--force', '--quiet', before]);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// The run

const count = (number, one, many) => `${number} ${number === 1 ? one : many}`;

/** The paths of the managed files of a manifest that may be read, or none when it is not one. */
function managedPaths(bytes) {
  try {
    const manifest = parseManifest(bytes);
    return Array.isArray(manifest.files) ? manifest.files.filter((entry) => isObject(entry) && entry.kind === 'managed' && mayInstall('managed', entry.path)).map((entry) => entry.path) : [];
  } catch {
    return [];
  }
}

/** Downloads what the release holds and checks it, and reads the working tree: everything that `planUpdate` is given. */
async function gather(context, { source, release, pin, releases, pinText, node }) {
  const tag = release.tag_name;
  const commit = await tagCommit(context, source, tag);
  const manifestBytes = await downloadManifest(context, source, release);
  if (manifestBytes === null) throw new Refused('manifest-missing', tag);
  const manifest = parseManifest(manifestBytes);
  checkManifest(manifest, { tag, commit });
  checkNode(manifest, node);
  const contents = new Map();
  const downloaded = Object.create(null);
  const held = new Map();
  const blocks = Object.create(null);
  for (const entry of manifest.files) {
    if (!Object.hasOwn(downloaded, entry.source)) {
      const got = await downloadFile(context, source, manifest.commit, entry.source, entry.size);
      downloaded[entry.source] = { sha256: got.sha256, size: got.size };
      held.set(entry.source, got.bytes);
    }
    contents.set(entry.path, held.get(entry.source));
    if (entry.kind === 'block') blocks[entry.source] = held.get(entry.source);
  }
  let previous = null;
  if (pin !== null) {
    const was = tag === pin.version ? release : releases.find((item) => isObject(item) && item.draft === false && item.tag_name === pin.version);
    if (was !== undefined) previous = tag === pin.version ? manifestBytes : await downloadManifest(context, source, was);
  }
  const paths = new Set([PIN_PATH, ...manifest.files.map((entry) => entry.path), ...(previous === null ? [] : managedPaths(previous))]);
  const tree = Object.fromEntries([...paths].map((destination) => [destination, destination === AGENTS_PATH ? inspectAgents(context.root) : inspect(context.root, destination)]));
  return { tag, commit, manifestBytes, previous, contents, downloaded, tree, blocks, pinText, node };
}

/** The words of a warning of the plan. */
const warningText = ({ code, detail }) => {
  if (code === 'block-refused') return `the block in ${AGENTS_PATH} was not written: ${BLOCK_WHY[detail]}`;
  return `${code === 'previous-missing' ? `the pinned release ${printable(detail)} has no manifest to read` : `the manifest of the pinned release is not one the updater reads (${printable(detail)})`}; local changes and removals are not listed`;
};

/** One run: says what it does with `say`, returns the exit status, throws Refused or Failed. */
async function execute(opts, env, options, say) {
  const root = path.resolve(options.cwd ?? process.cwd());
  const mode = opts.dryRun ? 'dry' : opts.local ? 'local' : 'pull';
  const token = env.RECORD_KEEPER_TOKEN === undefined || env.RECORD_KEEPER_TOKEN === '' ? undefined : env.RECORD_KEEPER_TOKEN;
  if (token !== undefined && !/^\S+$/.test(token)) throw new Failed('RECORD_KEEPER_TOKEN is not a token');
  const repo = env.GITHUB_REPOSITORY;
  if (mode === 'pull' && !isSource(repo)) throw new Failed('GITHUB_REPOSITORY must be owner/name');
  const context = { base: apiBase(env.GITHUB_API_URL || DEFAULT_API), token, fetch: options.fetch ?? globalThis.fetch, sleep: options.sleep ?? wait, timeout: options.timeout ?? TIMEOUT_MS, root, repo, gitEnv: options.gitEnv ?? process.env };
  const pinText = readPin(root);
  const pin = pinText === null ? null : parsePin(pinText);
  if (pin === null && (mode === 'pull' || !opts.source)) throw new Refused('source-missing');
  if (pin !== null && opts.source !== null && opts.source !== pin.source) throw new Refused('source-mismatch', pin.source);
  const source = pin === null ? opts.source : pin.source;
  const channel = opts.channel ?? pin?.channel ?? 'stable';
  const acting = mode === 'pull' && token !== undefined;

  const releases = await listReleases(context, source);
  const chosen = selectRelease({ pin, channel, target: opts.target, releases });
  let defaultBranch = null;
  if (acting) {
    defaultBranch = (await getJson(context, `/repos/${repo}`)).body?.default_branch;
    if (typeof defaultBranch !== 'string' || !/^[A-Za-z0-9._/-]{1,200}$/.test(defaultBranch) || defaultBranch === BRANCH) throw new Failed('the default branch of the repository is not what the updater reads');
  }
  if (chosen.status === 'current') {
    say(`current: ${pin.version} is the newest ${channel} release of ${source}${chosen.latest === pin.version ? '' : ` (the newest of the channel is ${chosen.latest})`}`);
    if (acting) await retirePull(context, defaultBranch, `${pin.version} is the newest ${channel} release of ${source}, so there is nothing to update to.`, say);
    return 0;
  }
  const found = await gather(context, { source, release: chosen.release, pin, releases, pinText, node: options.node ?? process.versions.node });
  const update = planUpdate({ pin, source, channel, tag: found.tag, tagCommit: found.commit, manifest: found.manifestBytes, previous: found.previous, node: found.node, downloaded: found.downloaded, tree: found.tree, blocks: found.blocks, pinText });

  say(update.status === 'unchanged' ? `unchanged: ${update.to} is installed and nothing differs` : `update ${update.from === null ? '(nothing installed)' : update.from} to ${update.to} (${channel})`);
  for (const [verb, list] of [['add', update.added], ['change', update.changed], ['remove', update.remove], ['install template', update.templates], ['local change overwritten', update.overwritten]]) for (const item of list) say(`  ${verb} ${item}`);
  if (update.block !== null && WRITES.includes(update.block.action)) say(`  ${update.block.action} the block of ${AGENTS_PATH}`);
  if (update.status === 'update' && update.pinChanged) say(`  write ${PIN_PATH}`);
  for (const warning of update.warnings) say(`warning: ${warningText(warning)}`);
  // With no pin (the first adoption) there is no earlier release to compare with, so the plan cannot know a local change: the line leaves the count out, because a 0 would say that it looked.
  const local = update.from === null ? '' : `, ${count(update.overwritten.length, 'local change', 'local changes')} overwritten`;
  if (update.status === 'update') say(`${count(update.added.length, 'file', 'files')} to add, ${update.changed.length} to change, ${update.remove.length} to remove, ${count(update.templates.length, 'template', 'templates')} to install${local}${update.block !== null && WRITES.includes(update.block.action) ? `, the block of ${AGENTS_PATH} to ${update.block.action}` : ''}`);
  if (mode === 'dry') {
    say('dry run: nothing was written');
    return 0;
  }
  if (update.status === 'unchanged') {
    if (acting) await retirePull(context, defaultBranch, `${update.to} is installed and nothing differs, so there is nothing to update.`, say);
    return 0;
  }
  const written = new Map([...found.contents].filter(([destination]) => [...update.added, ...update.changed, ...update.templates].includes(destination)));
  if (update.block !== null && WRITES.includes(update.block.action)) {
    // The plan has said that the splice works: it is made again here from the same bytes, and nothing else of AGENTS.md is read or written.
    const entry = parseManifest(found.manifestBytes).files.find((item) => item.kind === 'block');
    const here = found.tree[AGENTS_PATH];
    written.set(AGENTS_PATH, spliceBlock(here.kind === 'file' ? here.bytes : null, found.blocks[entry.source]).output);
  }
  if (mode === 'local') {
    writeAll(root, update, written);
    say(`wrote ${count(written.size, 'file', 'files')}, removed ${update.remove.length} and wrote the pin ${PIN_PATH}`);
    return 0;
  }
  if (!acting) {
    say('RECORD_KEEPER_TOKEN is not set: nothing was written (the secret is described in docs/updater.md)');
    return 1;
  }
  await publish(context, update, written, chosen.release.body, defaultBranch, say);
  return 0;
}

/** The command line, without the process around it. Returns { code, stdout, stderr }. `options` replaces what a test must: `fetch`, `cwd`, `sleep`, `node`, `timeout` and `gitEnv`. */
export async function runCli(argv, env, options = {}) {
  const opts = parseArgs(argv);
  if (opts === null) return { code: 2, stdout: '', stderr: USAGE };
  const out = [];
  let code;
  let error = '';
  try {
    code = await execute(opts, env, options, (line) => out.push(`${line}\n`));
  } catch (caught) {
    // A file that cannot be read or written is a failure of the run, said in a line, and not a stack.
    const failure = caught?.code !== undefined && /^E[A-Z0-9]+$/.test(caught.code) && !(caught instanceof Refused) ? new Failed(`${caught.syscall ?? 'a file operation'}${caught.path === undefined ? '' : ` ${printable(caught.path)}`} failed: ${caught.code}`) : caught;
    if (!(failure instanceof Refused) && !(failure instanceof Failed)) throw caught;
    error = `updater: ${failure instanceof Refused ? 'refused' : 'failed'}: ${failure.message}\n`;
    code = 1;
  }
  const secrets = [env.RECORD_KEEPER_TOKEN];
  return { code, stdout: redact(out.join(''), secrets), stderr: redact(error, secrets) };
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
