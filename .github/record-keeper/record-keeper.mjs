// Record Keeper: reads a decision record, puts it into canonical form, seals it and verifies a seal, and checks the
// format of the records in a folder.
//
// One file, no dependencies, no network, except that it imports from `updater.mjs`, which stands beside it, the one function that says whether the block of AGENTS.md
// changed (docs/agent-files.md): the updater is fetched alone for the first adoption and cannot import this file, so the function lives there. It implements generation g1 exactly as docs/generation-g1.md
// describes it, and the format of a record and its folder as docs/record-format.md describes it; test/vectors/g1 and
// test/fixtures/validate hold the answers it must give. It writes a file only for `seal --adopt --write`, which adds the seal line to records of a folder
// (docs/install.md): every other command only prints.
//
//   node record-keeper.mjs seal <file>             print the seal of a record
//   node record-keeper.mjs seal --verify <file>    check the `seal:` line of a record against its text
//   node record-keeper.mjs seal --adopt [folder] [--write]
//                                                  the first sealing of the records that existed before the kit: a dry run, unless --write
//   node record-keeper.mjs validate [folder]       check the format of the records in a folder (default docs/decisions)
//   node record-keeper.mjs validate --commit <rev> check the folder as it is in a commit (docs/reading-a-commit.md)
//
// Exit status: 0 success, 1 a record is rejected, a seal does not verify, a folder has problems or a record cannot be sealed, 2 wrong usage or
// unreadable file. Only `validate --commit` runs another program (git); nothing else does, and only `seal --adopt --write` writes a file.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS_PATH, SKILL_PATH, blockChanged } from './updater.mjs';

export const GENERATION = 'g1';
export const SEAL_PREFIX = `sha256-${GENERATION}:`;

/** What each rule of docs/generation-g1.md rejects, as a clause that follows "rejected by G1-NN:". */
export const RULES = {
  'G1-01': 'the bytes are not valid UTF-8',
  'G1-02': 'the text contains U+FEFF (a byte order mark)',
  'G1-03': 'the text contains a control character other than tab, line feed and carriage return',
  'G1-04': 'the text contains a line or paragraph separator or a bidirectional control',
  'G1-05': 'a carriage return is not directly followed by a line feed',
  'G1-06': 'the text contains <!--',
  'G1-07': 'line 1 is not ---',
  'G1-08': 'the front matter is never closed by a line that is ---',
  'G1-09': 'a front matter line is neither a key line nor a continuation line',
  'G1-10': 'two front matter keys are the same apart from case',
  'G1-11': 'status, date or seal is written with a capital letter',
  'G1-12': 'status, date or seal has no value, or has continuation lines',
  'G1-13': 'a front matter value starts with &, *, !, | or >',
  'G1-14': 'a ~~~ fence or an indented ``` fence outside a code block',
  'G1-15': 'a code fence is never closed',
  'G1-16': 'a line starts a raw HTML block',
  'G1-17': 'a setext underline turns the line above it into a heading',
  'G1-18': 'a line looks like the heading of an excluded section but is not exactly that heading, or is in a code block',
  'G1-19': 'an excluded heading occurs twice, or Errata comes before Known deviations',
  'G1-20': 'the line before an excluded heading is not empty',
};

/** Thrown when a record breaks a rule: `rule` is the first rule it breaks, in the order of the numbers. */
export class Reject extends Error {
  constructor(rule) {
    super(`${rule}: ${RULES[rule]}`);
    this.name = 'Reject';
    this.rule = rule;
  }
}

const EXCLUDED_KEYS = ['status', 'date', 'seal'];
const EXCLUDED_SECTIONS = new Map([
  ['known deviations', '## Known deviations'],
  ['errata', '## Errata'],
]);
const EXCLUDED_HEADINGS = [...EXCLUDED_SECTIONS.values()];

// Characters by code unit; every one of them lies in the Basic Multilingual Plane.
const BOM = 0xfeff;
const CONTROLS = [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0x7f, 0x9f]]; // not tab, line feed, carriage return
const SEPARATORS_AND_BIDI = [[0x061c, 0x061c], [0x200e, 0x200f], [0x2028, 0x2029], [0x202a, 0x202e], [0x2066, 0x2069]];
const inRanges = (code, ranges) => ranges.some(([from, to]) => code >= from && code <= to);

const KEY_LINE = /^([A-Za-z][A-Za-z0-9_-]*):(?: (.*))?$/;
const CONTINUATION_LINE = /^ +[^ \t]/;
const FENCE_OPEN = /^(`{3,})[^`]*$/;
const FENCE_CLOSE = /^(`+)$/;
const NOT_A_FENCE = [/^[ \t]*~{3,}/, /^[ \t]+`{3,}/]; // G1-14: fences that only some readers recognise
const HTML_START = /^ {0,3}<[A-Za-z/!?]/;
const AUTOLINK = /^ {0,3}<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^ \t<>]*>/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)$/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const SECTION_HEADING = /^ {0,3}#{1,2}(?:[ \t]|$)/; // the lines that end a section (level 1 and 2)

const asciiLower = (s) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());

function decode(bytes) {
  try {
    // ignoreBOM keeps a byte order mark in the text, so that G1-02 can see it.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Reject('G1-01');
  }
}

/** G1-02 to G1-06: the characters. Every rule is looked at before the first is reported, so the order holds. */
function checkCharacters(text) {
  let bom = false;
  let control = false;
  let separatorOrBidi = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === BOM) bom = true;
    else if (inRanges(code, CONTROLS)) control = true;
    else if (inRanges(code, SEPARATORS_AND_BIDI)) separatorOrBidi = true;
  }
  if (bom) throw new Reject('G1-02');
  if (control) throw new Reject('G1-03');
  if (separatorOrBidi) throw new Reject('G1-04');
  if (/\r(?!\n)/.test(text)) throw new Reject('G1-05');
  if (text.includes('<!--')) throw new Reject('G1-06');
}

/** Step 1 of the canonical form: CRLF becomes LF, and no line ends in a space or a tab. */
const normalizedLines = (text) => text.replace(/\r\n/g, '\n').split('\n').map((line) => line.replace(/[ \t]+$/, ''));

/** G1-07 to G1-09: the front matter. Returns the index of its closing line and its key lines with what they own. */
function parseFrontMatter(lines) {
  if (lines[0] !== '---') throw new Reject('G1-07');
  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Reject('G1-08');
  const entries = [];
  for (let at = 1; at < end; at++) {
    const key = KEY_LINE.exec(lines[at]);
    if (key) entries.push({ key: key[1], value: (key[2] ?? '').replace(/^ +/, ''), at, owned: [] });
    else if (entries.length && CONTINUATION_LINE.test(lines[at])) entries.at(-1).owned.push(lines[at]);
    else throw new Reject('G1-09');
  }
  return { end, entries };
}

/** G1-10 to G1-13: the keys. Each rule is a pass of its own, so that the lowest number is reported. */
function checkKeys(entries) {
  const seen = new Set();
  for (const { key } of entries) {
    const lower = asciiLower(key);
    if (seen.has(lower)) throw new Reject('G1-10');
    seen.add(lower);
  }
  for (const { key } of entries) {
    const lower = asciiLower(key);
    if (EXCLUDED_KEYS.includes(lower) && key !== lower) throw new Reject('G1-11');
  }
  for (const { key, value, owned } of entries) {
    if (EXCLUDED_KEYS.includes(key) && (value === '' || owned.length > 0)) throw new Reject('G1-12');
  }
  for (const { value, owned } of entries) {
    const starts = [value, ...owned.map((line) => line.replace(/^ +/, '').replace(/^- +/, ''))];
    if (starts.some((start) => start !== '' && '&*!|>'.includes(start[0]))) throw new Reject('G1-13');
  }
}

/** Which lines of the body are fenced, and whether a fence is of a kind this page does not know (G1-14) or unclosed (G1-15). */
function scanFences(body) {
  const fenced = [];
  let strange = false;
  let opening = 0; // the length of the backtick run that opened the fence we are in, or 0 outside a fence
  for (const line of body) {
    if (opening === 0) {
      if (NOT_A_FENCE.some((pattern) => pattern.test(line))) strange = true;
      opening = FENCE_OPEN.exec(line)?.[1].length ?? 0;
      fenced.push(opening > 0);
    } else {
      fenced.push(true);
      const closing = FENCE_CLOSE.exec(line);
      if (closing && closing[1].length >= opening) opening = 0;
    }
  }
  return { fenced, strange, unclosed: opening > 0 };
}

/** G1-16 and G1-17: what makes a reader see a different structure than the one this page cuts by. */
function checkStructure(body, fenced) {
  body.forEach((line, i) => {
    if (!fenced[i] && HTML_START.test(line) && !AUTOLINK.test(line)) throw new Reject('G1-16');
  });
  body.forEach((line, i) => {
    if (fenced[i] || i === 0 || !SETEXT_UNDERLINE.test(line)) return;
    const above = body[i - 1];
    if (above !== '' && !fenced[i - 1] && !HEADING.test(above)) throw new Reject('G1-17');
  });
}

/** G1-18 to G1-20: the excluded sections. Looks at every line of the record, front matter and code blocks included. */
function checkSections(lines, end, fenced) {
  const found = new Map(); // 'known deviations' | 'errata' to the indexes of its heading lines
  lines.forEach((line, i) => {
    const name = asciiLower(line.replace(/^[ \t#]+/, '').replace(/[ \t#]+$/, ''));
    const heading = EXCLUDED_SECTIONS.get(name);
    if (!heading) return;
    const inCodeBlock = i > end && fenced[i - end - 1];
    if (line !== heading || inCodeBlock) throw new Reject('G1-18');
    found.set(name, [...(found.get(name) ?? []), i]);
  });
  const deviations = found.get('known deviations');
  const errata = found.get('errata');
  if ([...found.values()].some((at) => at.length > 1)) throw new Reject('G1-19');
  if (deviations && errata && errata[0] < deviations[0]) throw new Reject('G1-19');
  for (const at of found.values()) {
    if (lines[at[0] - 1] !== '') throw new Reject('G1-20');
  }
}

/**
 * Applies the rules to the bytes of a record, in the order of their numbers.
 * Returns the record as the canonical form needs it, or throws Reject with the first rule it breaks.
 */
export function parse(bytes) {
  const text = decode(bytes);
  checkCharacters(text);
  const lines = normalizedLines(text);
  const { end, entries } = parseFrontMatter(lines);
  checkKeys(entries);
  const body = lines.slice(end + 1);
  const { fenced, strange, unclosed } = scanFences(body);
  if (strange) throw new Reject('G1-14');
  if (unclosed) throw new Reject('G1-15');
  checkStructure(body, fenced);
  checkSections(lines, end, fenced);
  return { lines, end, entries, fenced };
}

/**
 * Which lines of a body lie in an excluded section: the heading line, and every line up to, not including, the next section heading.
 * For a record that parse() accepted, so that a line that is exactly an excluded heading and not fenced is one.
 */
function excludedLines(body, fenced) {
  let cutting = false;
  return body.map((line, i) => {
    if (!fenced[i] && SECTION_HEADING.test(line)) cutting = EXCLUDED_HEADINGS.includes(line);
    return cutting;
  });
}

/** Steps 2 to 5 of the canonical form, for a record that parse() accepted. Returns the canonical text. */
export function canonicalize({ lines, end, entries, fenced }) {
  const cutKeys = new Set(entries.filter(({ key }) => EXCLUDED_KEYS.includes(key)).map(({ at }) => at));
  const head = lines.slice(0, end + 1).filter((_, i) => !cutKeys.has(i));
  const cut = excludedLines(lines.slice(end + 1), fenced);
  const body = [];
  let afterEmpty = false;
  lines.slice(end + 1).forEach((line, i) => {
    if (cut[i]) return;
    const empty = line === '' && !fenced[i];
    if (empty && afterEmpty) return;
    afterEmpty = empty;
    body.push(line);
  });
  while (body.length > 0 && body.at(-1) === '') body.pop();
  return [...head, ...body].join('\n') + '\n';
}

/** The seal of a record under g1: `sha256-g1:` and the SHA-256 of its canonical text. Throws Reject. */
export function seal(bytes) {
  return SEAL_PREFIX + createHash('sha256').update(canonicalize(parse(bytes)), 'utf8').digest('hex');
}

/**
 * Checks the `seal:` line of a record against its text. Never throws for a bad record.
 * Returns { ok: true, seal } or { ok: false, reason, ... } where reason is one of
 * 'rejected' (with rule), 'not-sealed', 'malformed' (with stored), 'unknown-generation' (with generation)
 * and 'mismatch' (with stored and computed).
 */
export function verify(bytes) {
  let record;
  try {
    record = parse(bytes);
  } catch (error) {
    if (error instanceof Reject) return { ok: false, reason: 'rejected', rule: error.rule };
    throw error;
  }
  const entry = record.entries.find(({ key }) => key === 'seal');
  if (!entry) return { ok: false, reason: 'not-sealed' };
  const stored = entry.value;
  if (!/^sha256-g[0-9]+:[0-9a-f]{64}$/.test(stored)) return { ok: false, reason: 'malformed', stored };
  if (!stored.startsWith(SEAL_PREFIX)) return { ok: false, reason: 'unknown-generation', generation: stored.slice(7, stored.indexOf(':')) };
  const computed = SEAL_PREFIX + createHash('sha256').update(canonicalize(record), 'utf8').digest('hex');
  return stored === computed ? { ok: true, seal: computed } : { ok: false, reason: 'mismatch', stored, computed };
}

// ---- the format of a record and of its folder: docs/record-format.md ----------------------------------------------------

/** What each rule of docs/record-format.md says, as what is wrong with the file (or the folder) it is reported for. */
export const FORMAT_RULES = {
  'V-01': 'does not exist or is not a directory',
  'V-02': 'is missing',
  'V-03': 'is missing',
  'V-04': 'is a symbolic link, or is neither a regular file nor a directory',
  'V-05': 'is not README.md, template.md or a record file named NNNN-short-title.md in lower case with hyphens',
  'V-06': 'is a subfolder that is not the shared folder',
  'V-07': 'has the number of an earlier record',
  'V-08': 'has record numbers that are not 0001, 0002, 0003 and so on without a gap',
  'V-09': 'breaks a rule of generation g1',
  'V-10': 'is longer than 60 lines, not counting its Known deviations and Errata sections',
  'V-11': 'looks like it contains a credential',
  'V-12': 'contains an e-mail address; records are public',
  'V-13': 'has a key that is not a standard key and not an extra key',
  'V-14': 'has a key of the wrong kind',
  'V-15': 'has a key with no value',
  'V-16': 'has a key whose lines are neither one value nor a list of items',
  'V-17': 'is missing a required key',
  'V-18': 'has a status that is not proposed, accepted, rejected or "superseded by NNNN"',
  'V-19': 'has the status deprecated; a record ends only by a successor',
  'V-20': 'is superseded by a record that does not exist or does not have a higher number',
  'V-21': 'has a date that is not a real date written YYYY-MM-DD',
  'V-22': 'has a seal that is not sha256-gN: and 64 lower case hexadecimal digits',
  'V-23': 'has an issue that is not written owner/repo#N',
  'V-24': 'does not start with a "# Title" heading',
  'V-25': 'has a section that is not one of the six',
  'V-26': 'is missing a required section',
  'V-27': 'has its sections out of order, or one of them twice',
  'V-28': 'has a section with no content',
  'V-29': 'has no "## Index" section',
  'V-30': 'has no row in the index',
  'V-31': 'has more than one row in the index',
  'V-32': 'has an index row for a record that does not exist',
  'V-33': 'has an index row that does not show its status',
  'V-34': 'has an index row that does not show its title',
  'V-35': 'has a supersedes entry that is not a number of four digits',
  'V-36': 'supersedes a record that does not exist or does not have a lower number',
  'V-37': 'has an emergency entry of more than 500 characters',
};

/** What each rule of docs/reading-a-commit.md reports, for the folder as it is in a commit. */
export const COMMIT_RULES = {
  'T-01': 'has the executable mode',
  'T-02': 'has a git attribute other than text and eol',
  'T-03': 'is not the only folder that holds records',
};

const STANDARD_KEYS = ['status', 'date', 'decision-makers', 'applies-to', 'issues', 'supersedes', 'seal', 'emergency'];
const LIST_KEYS = ['decision-makers', 'applies-to', 'issues', 'supersedes'];
const VALUE_KEYS = ['status', 'date', 'seal', 'emergency'];
const REQUIRED_KEYS = ['status', 'date', 'decision-makers'];
const SECTIONS = ['Context and problem statement', 'Decision', 'Consequences', 'Known deviations', 'Alternatives considered', 'Errata'];
const REQUIRED_SECTIONS = SECTIONS.slice(0, 3);
const MAX_LINES = 60;
const RECORD_FILE = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const CREDENTIAL = /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const STATUS_FORM = /^(?:proposed|accepted|rejected|superseded by (\d{4}))$/;
const SEAL_FORM = /^sha256-g[0-9]+:[0-9a-f]{64}$/;
const ISSUE_FORM = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[0-9]+$/;
const NUMBER_FORM = /^\d{4}$/;
const ITEM = /^ +- +(\S.*)$/;
const TITLE = /^# \S/;
const INDEX_LINK = /\]\((\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md)\)/;

function isRealDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

/**
 * Where a records folder is read from: `exists()`, `list()` (the entries of the folder, each { name, type } with the type
 * 'file', 'directory', 'symlink' or 'other') and `read(name)` (the bytes of a file of the folder).
 */
function folderSource(folder) {
  return {
    exists() {
      try {
        return fs.statSync(folder).isDirectory();
      } catch {
        return false;
      }
    },
    list() {
      return fs.readdirSync(folder).map((name) => {
        const stat = fs.lstatSync(path.join(folder, name));
        return { name, type: stat.isSymbolicLink() ? 'symlink' : stat.isFile() ? 'file' : stat.isDirectory() ? 'directory' : 'other' };
      });
    },
    read: (name) => fs.readFileSync(path.join(folder, name)),
  };
}

/** V-01 to V-08. Returns the record files of the folder, in name order, with their numbers. */
function checkFolder(source, sharedFolder, report) {
  const records = [];
  let readme = false;
  let template = false;
  for (const { name, type } of source.list().filter((entry) => !entry.name.startsWith('.')).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (type === 'directory') {
      if (name !== sharedFolder) report(name, 'V-06');
    } else if (type !== 'file') report(name, 'V-04');
    else if (name === 'README.md') readme = true;
    else if (name === 'template.md') template = true;
    else if (RECORD_FILE.test(name)) records.push({ name, number: Number(name.slice(0, 4)) });
    else report(name, 'V-05');
  }
  if (!readme) report('README.md', 'V-02');
  if (!template) report('template.md', 'V-03');
  const seen = new Set();
  for (const { name, number } of records) {
    if (seen.has(number)) report(name, 'V-07');
    seen.add(number);
  }
  const gap = [...seen].sort((a, b) => a - b).findIndex((number, i) => number !== i + 1);
  if (gap >= 0) report(null, 'V-08');
  return { records, readme };
}

/** How the entry of a key is shaped: 'empty', 'single', 'list' (with its items) or 'mixed'. */
function shapeOf({ value, owned }) {
  const items = owned.map((line) => ITEM.exec(line));
  if (value === '' && owned.length === 0) return { shape: 'empty' };
  if (owned.length === 0) return { shape: 'single' };
  if (value === '' && items.every(Boolean)) return { shape: 'list', items: items.map((item) => item[1]) };
  return { shape: 'mixed' };
}

/** V-13 to V-23, V-35 and V-36. Returns the status as the index can judge it (undefined when it is missing or reported). */
function checkFrontMatter(name, number, entries, numbers, extraKeys, report) {
  const shaped = entries.map((entry) => ({ ...entry, ...shapeOf(entry) }));
  const byKey = new Map(shaped.map((entry) => [entry.key, entry]));
  for (const { key } of shaped) if (!STANDARD_KEYS.includes(key) && !extraKeys.includes(key)) report(name, 'V-13', key);
  for (const { key, shape } of shaped) {
    if ((LIST_KEYS.includes(key) && shape === 'single') || (VALUE_KEYS.includes(key) && shape === 'list')) report(name, 'V-14', `${key} must be ${LIST_KEYS.includes(key) ? 'a list' : 'a single value'}`);
  }
  for (const { key, shape } of shaped) if (shape === 'empty') report(name, 'V-15', key);
  for (const { key, shape } of shaped) if (shape === 'mixed') report(name, 'V-16', key);
  for (const key of REQUIRED_KEYS) if (!byKey.has(key)) report(name, 'V-17', key);
  const single = (key) => (byKey.get(key)?.shape === 'single' ? byKey.get(key).value : undefined);

  const status = single('status');
  let judged;
  if (status === 'deprecated') report(name, 'V-19');
  else if (status !== undefined) {
    const form = STATUS_FORM.exec(status);
    if (!form) report(name, 'V-18', status);
    else {
      judged = status;
      if (form[1] !== undefined && (!numbers.has(Number(form[1])) || Number(form[1]) <= number)) report(name, 'V-20', form[1]);
    }
  }
  const date = single('date');
  if (date !== undefined && !isRealDate(date)) report(name, 'V-21', date);
  const seal = single('seal');
  if (seal !== undefined && !SEAL_FORM.test(seal)) report(name, 'V-22', seal);
  const emergency = single('emergency');
  if (emergency !== undefined && [...emergency].length > 500) report(name, 'V-37');
  const issues = byKey.get('issues');
  if (issues?.shape === 'list') for (const item of issues.items) if (!ISSUE_FORM.test(item)) report(name, 'V-23', item);
  const supersedes = byKey.get('supersedes');
  if (supersedes?.shape === 'list') {
    for (const item of supersedes.items) {
      if (!NUMBER_FORM.test(item)) report(name, 'V-35', item);
      else if (!numbers.has(Number(item)) || Number(item) >= number) report(name, 'V-36', item);
    }
  }
  return judged;
}

/** V-24 to V-28. Returns the title as the index can judge it (undefined when there is none). */
function checkBody(name, body, fenced, report) {
  const first = body.find((line) => line !== '');
  const titled = first !== undefined && TITLE.test(first);
  if (!titled) report(name, 'V-24');
  const headings = [];
  body.forEach((line, i) => {
    if (!fenced[i] && line.startsWith('## ')) headings.push({ at: i, name: line.slice(3) });
  });
  for (const heading of headings) if (!SECTIONS.includes(heading.name)) report(name, 'V-25', heading.name);
  for (const section of REQUIRED_SECTIONS) if (!headings.some((heading) => heading.name === section)) report(name, 'V-26', section);
  const order = headings.filter((heading) => SECTIONS.includes(heading.name)).map((heading) => SECTIONS.indexOf(heading.name));
  if (order.some((position, i) => i > 0 && position <= order[i - 1])) report(name, 'V-27');
  headings.forEach((heading, i) => {
    const until = i + 1 < headings.length ? headings[i + 1].at : body.length;
    if (body.slice(heading.at + 1, until).every((line) => line === '')) report(name, 'V-28', heading.name);
  });
  return titled ? first.slice(2) : undefined;
}

/**
 * The length that V-10 counts: the lines of the record without the lines of its excluded sections (`## Known deviations` and `## Errata`,
 * which grow after acceptance), not counting the empty line after a final line feed of what is left. For a record that parse() accepted.
 */
function lengthAsAccepted(lines, end, fenced) {
  const body = lines.slice(end + 1);
  const cut = excludedLines(body, fenced);
  const kept = [...lines.slice(0, end + 1), ...body.filter((_, i) => !cut[i])];
  return kept.length - (kept.at(-1) === '' ? 1 : 0);
}

/** V-09 to V-28 for one record. Returns what the index can judge: { status, title }. */
function checkRecord(source, { name, number }, numbers, extraKeys, report) {
  let record;
  try {
    record = parse(source.read(name));
  } catch (error) {
    if (!(error instanceof Reject)) throw error;
    report(name, 'V-09', `${error.rule}: ${RULES[error.rule]}`, error.rule);
    return {};
  }
  const { lines, end, entries, fenced } = record;
  const text = lines.join('\n');
  if (lengthAsAccepted(lines, end, fenced) > MAX_LINES) report(name, 'V-10');
  if (CREDENTIAL.test(text)) report(name, 'V-11');
  if (EMAIL.test(text)) report(name, 'V-12');
  const status = checkFrontMatter(name, number, entries, numbers, extraKeys, report);
  const title = checkBody(name, lines.slice(end + 1), fenced, report);
  return { status, title };
}

/** V-29 to V-34: README.md against the records. */
function checkIndex(source, records, facts, report) {
  const lines = source.read('README.md').toString('utf8').replace(/\r\n/g, '\n').split('\n').map((line) => line.replace(/[ \t]+$/, ''));
  const { fenced } = scanFences(lines);
  const start = lines.findIndex((line, i) => !fenced[i] && line === '## Index');
  if (start < 0) {
    report('README.md', 'V-29');
    return;
  }
  let stop = lines.findIndex((line, i) => i > start && !fenced[i] && (line.startsWith('# ') || line.startsWith('## ')));
  if (stop < 0) stop = lines.length;
  const rowsOf = new Map();
  for (const row of lines.slice(start + 1, stop).filter((line) => line.startsWith('|'))) {
    const link = INDEX_LINK.exec(row);
    if (link) rowsOf.set(link[1], [...(rowsOf.get(link[1]) ?? []), row]);
  }
  const known = new Set(records.map(({ name }) => name));
  for (const [target, rows] of rowsOf) if (!known.has(target)) rows.forEach(() => report('README.md', 'V-32', target));
  for (const { name } of records) {
    const rows = rowsOf.get(name) ?? [];
    if (rows.length === 0) {
      report(name, 'V-30');
      continue;
    }
    if (rows.length > 1) report(name, 'V-31');
    const pieces = rows[0].split('|').slice(1);
    if (pieces.length > 0 && pieces.at(-1).trim() === '') pieces.pop();
    const cells = pieces.map((cell) => cell.trim());
    const { status, title } = facts.get(name);
    if (status !== undefined && !cells.includes(status)) report(name, 'V-33');
    const linkTexts = [...rows[0].matchAll(/\[([^\]]*)\]\(/g)].map((match) => match[1]);
    if (title !== undefined && !cells.includes(title) && !linkTexts.includes(title)) report(name, 'V-34');
  }
}

/**
 * Checks the format of the records in a folder against docs/record-format.md.
 * Returns the problems as [{ file, rule, detail?, g1? }]; `file` is null for a problem of the folder as a whole.
 * Settings: `extraKeys`, the front matter keys beyond the standard ones, and `sharedFolder`, the subfolder not looked at.
 */
export function validate(folder, settings) {
  return validateSource(folderSource(folder), settings);
}

function validateSource(source, { extraKeys = [], sharedFolder = 'shared' } = {}) {
  const problems = [];
  const report = (file, rule, detail, g1) => problems.push({ file, rule, ...(detail ? { detail } : {}), ...(g1 ? { g1 } : {}) });
  if (!source.exists()) {
    report(null, 'V-01');
    return problems;
  }
  const { records, readme } = checkFolder(source, sharedFolder, report);
  const numbers = new Set(records.map(({ number }) => number));
  const facts = new Map(records.map((record) => [record.name, checkRecord(source, record, numbers, extraKeys, report)]));
  if (readme) checkIndex(source, records, facts, report);
  return problems;
}

// ---- the first sealing of the records that existed before the kit: docs/install.md ---------------------------------------

const SEALABLE_STATUS = /^(?:accepted|superseded by \d{4})$/;

/**
 * Puts the line `seal: <value>` into the bytes of a record as the last line of its front matter, directly before the closing delimiter, with the line
 * ending of the line before it. Nothing else is touched: the bytes of the record are kept, and only the bytes of the new line are added. `end` is the index
 * of the closing delimiter, which is also the number of the physical line, because a record that g1 accepts has no carriage return that is not part of a CRLF.
 * Returns { bytes, at, added }: the new bytes, where the line starts and what was added.
 */
function insertSealLine(bytes, end, value) {
  let at = 0;
  for (let line = 0; line < end; line++) at = bytes.indexOf(0x0a, at) + 1;
  const added = Buffer.from(`seal: ${value}${bytes[at - 2] === 0x0d ? '\r\n' : '\n'}`);
  return { bytes: Buffer.concat([bytes.subarray(0, at), added, bytes.subarray(at)]), at, added };
}

/** A record that `seal --adopt` leaves as it is and lists: `rule` is the rule it is listed under (null for none) and `why` says it in words. */
const cannot = (rule, why) => ({ state: 'cannot', rule, why });

/**
 * The first sealing of one record, as `seal --adopt` does it (docs/install.md). Never throws for a bad record, and never changes the bytes it is given. Returns
 *   { state: 'cannot', rule, why }  g1 rejects the record (rule is the rule of g1), or the line cannot be added without a change that `validate` would see;
 *   { state: 'skip', why }          its status is not `accepted` and not `superseded by NNNN`;
 *   { state: 'has-seal' }           it has a `seal:` line already, valid or not: such a record is never rewritten;
 *   { state: 'seal', bytes }        the bytes of the record with the line `seal: sha256-g1:<hex>` added, and every other byte as it was.
 * `place` puts the line into the bytes (it is a parameter so that the checks after it can be tried with a placement that does not hold).
 */
export function adoptRecord(bytes, place = insertSealLine) {
  let record;
  try {
    record = parse(bytes);
  } catch (error) {
    if (!(error instanceof Reject)) throw error;
    return cannot(error.rule, RULES[error.rule]);
  }
  const status = record.entries.find(({ key }) => key === 'status')?.value;
  if (status === undefined) return { state: 'skip', why: 'no status' };
  if (!SEALABLE_STATUS.test(status)) return { state: 'skip', why: `status ${status}` };
  if (record.entries.some(({ key }) => key === 'seal')) return { state: 'has-seal' };
  const value = seal(bytes);
  const { bytes: next, at, added } = place(bytes, record.end, value);
  // Whatever the placement did, the new bytes must be the old ones with the new line in them, and the seal must verify.
  const kept = Buffer.concat([next.subarray(0, at), next.subarray(at + added.length)]);
  const result = verify(next);
  if (!kept.equals(bytes) || !result.ok || result.seal !== value) return cannot(null, 'the seal line cannot be added without changing another byte of the record');
  // The line is one line more, and a record of exactly the longest length that V-10 allows would be too long with it: `validate` would report a problem that it did not.
  const grown = parse(next);
  if (lengthAsAccepted(record.lines, record.end, record.fenced) <= MAX_LINES && lengthAsAccepted(grown.lines, grown.end, grown.fenced) > MAX_LINES) {
    return cannot('V-10', `the seal line would make the record longer than ${MAX_LINES} lines`);
  }
  return { state: 'seal', bytes: next };
}

/**
 * What `seal --adopt` does with the records of a folder, without writing: one entry for each file that is looked at, in name order, as { name, ...adoptRecord }.
 * A subfolder, a name that starts with a dot, and `README.md` and `template.md` when they are files are not looked at. A file that is not a record file is `skip`ped,
 * and an entry that is a symbolic link or neither a file nor a folder is a `cannot` (V-04), as in `validate`, whatever its name: it is never read and never written.
 * Throws Unreadable.
 */
export function adopt(folder) {
  const source = folderSource(folder);
  if (!source.exists()) throw new Unreadable(`${printable(folder)} does not exist or is not a directory`);
  const results = [];
  for (const { name, type } of source.list().filter((entry) => !entry.name.startsWith('.')).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (type === 'directory') continue;
    if (type !== 'file') results.push({ name, ...cannot('V-04', `the entry ${FORMAT_RULES['V-04']}`) });
    else if (name === 'README.md' || name === 'template.md') continue;
    else if (!RECORD_FILE.test(name)) results.push({ name, state: 'skip', why: 'not a record file' });
    else results.push({ name, ...adoptRecord(source.read(name)) });
  }
  return results;
}

/** Why a commit cannot be read: no git, not a repository, not a revision, not a folder of the tree. Wrong usage, not a problem of the records. */
export class Unreadable extends Error {}

const KINDS = { '100644': 'file', '100755': 'executable', '040000': 'directory', '120000': 'symlink', '160000': 'submodule' };
/** The folders where tools look for records by convention (docs/reading-a-commit.md). */
const CONVENTIONAL_FOLDERS = ['docs/decisions', 'docs/adr', 'docs/adrs', 'docs/architecture/decisions', 'doc/adr', 'doc/decisions', 'decisions', 'adr', 'adrs'];

/** Runs git with nothing of the caller's git environment, and returns what it printed. */
export function runGit(args, { cwd, env = {}, input } = {}) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const result = spawnSync('git', args, { cwd, input, env: { ...inherited, GIT_TERMINAL_PROMPT: '0', ...env }, maxBuffer: 1 << 30 });
  if (result.error) throw new Unreadable(`cannot run git: ${result.error.message}`);
  if (result.status !== 0) throw new Unreadable(`git ${args[args[0] === '-C' ? 2 : 0]} failed: ${result.stderr.toString('utf8').trim()}`);
  return result.stdout;
}

/** The contents of blobs, by id, in one call of git. */
function readBlobs(repo, ids) {
  const wanted = [...new Set(ids)];
  const blobs = new Map();
  if (wanted.length === 0) return blobs;
  const out = runGit(['-C', repo, 'cat-file', '--batch'], { input: `${wanted.join('\n')}\n` });
  let at = 0;
  for (const id of wanted) {
    const eol = out.indexOf(0x0a, at);
    const header = eol < 0 ? [] : out.toString('latin1', at, eol).split(' ');
    if (header.length !== 3 || header[0] !== id || header[1] !== 'blob') throw new Unreadable(`cannot read the object ${id}`);
    const size = Number(header[2]);
    blobs.set(id, out.subarray(eol + 1, eol + 1 + size));
    at = eol + 1 + size + 1;
  }
  return blobs;
}

/**
 * Opens a commit without checking it out: `commit` is its id, `kind(path)` the kind of an entry ('file', 'executable',
 * 'directory', 'symlink', 'submodule' or 'other'), `children(path)` the entries directly in a directory and `read(path)`
 * the bytes of a file, read from the object database.
 */
/** The tree of nothing, as the base of a first commit: it has the interface of an open commit and holds no entry. */
export function emptyCommit() {
  return {
    commit: '0'.repeat(40),
    empty: true,
    attributeFiles: false,
    kind: () => undefined,
    children: () => [],
    prefetch: () => {},
    leaves: () => new Map(),
    read(entryPath) {
      throw new Unreadable(`${entryPath} is not a file of the empty tree`);
    },
    attributes: (paths) => new Map(paths.map((entryPath) => [entryPath, []])),
  };
}

export function openCommit(repo, rev) {
  if (typeof rev !== 'string' || rev === '' || rev.startsWith('-')) throw new Unreadable(`not a revision: ${rev}`);
  const commit = runGit(['-C', repo, 'rev-parse', '--verify', `${rev}^{commit}`]).toString('utf8').trim();
  const entries = new Map();
  const byParent = new Map();
  let attributeFiles = false;
  for (const record of runGit(['-C', repo, 'ls-tree', '-r', '-t', '-z', '--full-tree', commit]).toString('latin1').split('\0')) {
    if (record === '') continue;
    const match = /^(\d{6}) \w+ ([0-9a-f]+)\t([^]*)$/.exec(record);
    if (!match) throw new Unreadable(`cannot read the tree of ${commit}`);
    const entryPath = Buffer.from(match[3], 'latin1').toString('utf8');
    const kind = KINDS[match[1]] ?? 'other';
    const slash = entryPath.lastIndexOf('/');
    const parent = slash < 0 ? '' : entryPath.slice(0, slash);
    const name = entryPath.slice(slash + 1);
    entries.set(entryPath, { kind, id: match[2] });
    byParent.set(parent, [...(byParent.get(parent) ?? []), { name, kind, id: match[2] }]);
    if (name === '.gitattributes') attributeFiles = true;
  }
  const cache = new Map();
  const fetch = (paths) => {
    const missing = paths.map((entryPath) => entries.get(entryPath)).filter((entry) => entry && !cache.has(entry.id)).map((entry) => entry.id);
    for (const [id, bytes] of readBlobs(repo, missing)) cache.set(id, bytes);
  };
  return {
    commit,
    attributeFiles,
    kind: (entryPath) => entries.get(entryPath)?.kind,
    children: (dir) => byParent.get(dir) ?? [],
    prefetch: fetch,
    /** Every entry that is not a directory: Map path -> 'kind id'. */
    leaves: () => new Map([...entries].filter(([, entry]) => entry.kind !== 'directory').map(([entryPath, entry]) => [entryPath, `${entry.kind} ${entry.id}`])),
    read(entryPath) {
      const entry = entries.get(entryPath);
      if (!entry || !['file', 'executable', 'symlink'].includes(entry.kind)) throw new Unreadable(`${entryPath} is not a file of ${commit}`);
      fetch([entryPath]);
      return cache.get(entry.id);
    },
    /** The git attributes of some paths as the `.gitattributes` of this commit set them, and nothing of the machine: Map path -> [[name, value]]. */
    attributes(paths) {
      const result = new Map(paths.map((entryPath) => [entryPath, []]));
      if (!attributeFiles || paths.length === 0) return result;
      const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'record-keeper-attributes-'));
      try {
        const objects = path.resolve(repo, runGit(['-C', repo, 'rev-parse', '--git-path', 'objects']).toString('utf8').trim());
        const env = { GIT_DIR: scratch, GIT_ALTERNATE_OBJECT_DIRECTORIES: objects, GIT_ATTR_NOSYSTEM: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devnull, HOME: scratch, XDG_CONFIG_HOME: scratch };
        runGit(['init', '-q', '--bare', scratch], { cwd: scratch, env });
        runGit(['read-tree', commit], { cwd: scratch, env });
        const out = runGit(['check-attr', '--cached', '-a', '-z', '--stdin'], { cwd: scratch, env, input: `${paths.join('\0')}\0` }).toString('utf8').split('\0');
        for (let i = 0; i + 2 < out.length; i += 3) result.get(out[i])?.push([out[i + 1], out[i + 2]]);
      } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
      }
      return result;
    },
  };
}

function commitSource(commit, folder) {
  return {
    exists: () => commit.kind(folder) === 'directory',
    list: () => commit.children(folder).map(({ name, kind }) => ({ name, type: kind === 'executable' ? 'file' : kind === 'directory' || kind === 'file' ? kind : 'other' })),
    read: (name) => commit.read(`${folder}/${name}`),
  };
}

/**
 * Checks the records folder of a commit: the rules of docs/record-format.md on the files of the commit, and the rules of
 * docs/reading-a-commit.md. `folder` is a path of the tree. Returns the problems like `validate`; throws Unreadable.
 */
export function validateCommit(repo, rev, folder = 'docs/decisions', settings) {
  const parts = folder.split('/').filter((part) => part !== '' && part !== '.');
  if (parts.length === 0 || parts.includes('..')) throw new Unreadable(`not a folder of the repository: ${folder}`);
  return validateOpened(openCommit(repo, rev), parts.join('/'), settings);
}

/** `validateCommit` for a commit that is open already; `where` is a clean path of the tree. */
function validateOpened(commit, where, settings) {
  const source = commitSource(commit, where);
  if (source.exists()) commit.prefetch(source.list().filter(({ name, type }) => type === 'file' && (name === 'README.md' || RECORD_FILE.test(name))).map(({ name }) => `${where}/${name}`));
  const problems = validateSource(source, settings);
  if (!source.exists()) return problems;
  const files = commit.children(where).filter(({ name, kind }) => !name.startsWith('.') && (kind === 'file' || kind === 'executable'));
  for (const { name, kind } of files) if (kind === 'executable') problems.push({ file: name, rule: 'T-01' });
  const attributes = commit.attributes(files.map(({ name }) => `${where}/${name}`));
  for (const { name } of files) {
    const set = attributes.get(`${where}/${name}`).filter(([attribute]) => attribute !== 'text' && attribute !== 'eol').sort((a, b) => (a[0] < b[0] ? -1 : 1));
    if (set.length > 0) problems.push({ file: name, rule: 'T-02', detail: set.map(([attribute, value]) => `${attribute}: ${value}`).join(', ') });
  }
  for (const other of CONVENTIONAL_FOLDERS) {
    if (other === where || other.startsWith(`${where}/`)) continue;
    if (commit.children(other).some(({ name, kind }) => (kind === 'file' || kind === 'executable') && (name === 'README.md' || RECORD_FILE.test(name)))) problems.push({ file: null, rule: 'T-03', detail: other });
  }
  return problems;
}

/** The settings file of a repository (docs/settings.md). */
export const SETTINGS_PATH = '.github/record-keeper/settings.yml';

export const SETTINGS_RULES = {
  'S-01': 'is not a regular file of the commit, or a link or a file stands in front of it',
  'S-02': 'is not text that the kit reads',
  'S-03': 'has a line that is not in the subset of YAML that the kit reads',
  'S-04': 'sets a key that another line also sets',
  'S-05': 'has a key that is not a setting',
  'S-06': 'gives a key a value of the wrong kind',
  'S-07': 'gives a key a value that it cannot take',
};

/** Every setting: the kind of its value, the form a value must have and the field it fills. A Map, so that `constructor` is not a setting. */
const SETTINGS = new Map([
  ['folder', { kind: 'single', form: 'folder', field: 'folder' }],
  ['shared-folder', { kind: 'single', form: 'part', field: 'sharedFolder' }],
  ['extra-keys', { kind: 'list', form: 'key', field: 'extraKeys' }],
  ['owners', { kind: 'list', form: 'owner', field: 'owners' }],
  ['approvals', { kind: 'single', form: 'count', field: 'approvals' }],
  ['witnesses', { kind: 'list', form: 'owner', field: 'witnesses' }],
  ['shared-changes', { kind: 'single', form: 'refuse-or-allow', field: 'sharedChanges' }],
]);

const defaultSettings = () => ({ folder: 'docs/decisions', sharedFolder: 'shared', extraKeys: [], owners: [], approvals: 2, witnesses: [], sharedChanges: 'refuse' });

const SETTING_KEY = /^([A-Za-z][A-Za-z0-9_-]*):/;
const SETTING_ENTRY = /^[A-Za-z][A-Za-z0-9_-]*:(?: +([^]*))?$/;
const PLAIN_SCALAR = /(?:[A-Za-z_]|\.[A-Za-z])[A-Za-z0-9_./-]*/y;
const INTEGER_SCALAR = /0|[1-9][0-9]{0,8}/y;
const RESERVED_WORD = /^(?:null|true|false|yes|no|on|off|y|n|\.inf|\.nan)$/i;
const KEY_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
const OWNER_FORM = /^([A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38})\/([1-9][0-9]{0,14})$/;

const cutDetail = (text) => [...text].slice(0, 40).join('');
const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/** S-02: the text of a settings file, or why it is not read: { text } or { reason, line }. */
function readText(bytes) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return { reason: 'not UTF-8', line: null };
  }
  const first = (test) => {
    for (let i = 0; i < text.length; i++) if (test(text.charCodeAt(i), i)) return i;
    return -1;
  };
  const found = [
    ['byte order mark', first((code) => code === BOM)],
    ['control character', first((code) => inRanges(code, CONTROLS) || code === 0xfffe || code === 0xffff)],
    ['separator or direction control', first((code) => inRanges(code, SEPARATORS_AND_BIDI))],
    ['bare carriage return', first((code, i) => code === 0x0d && text.charCodeAt(i + 1) !== 0x0a)],
  ].find(([, index]) => index >= 0);
  return found ? { reason: found[0], line: lineAt(text, found[1]) } : { text };
}

/** A scalar of the subset at `pos`: { value, end }, or null. The value is a string, or a number for an integer. */
function readScalar(text, pos) {
  const quote = text[pos];
  if (quote === "'" || quote === '"') {
    let value = '';
    for (let i = pos + 1; ; ) {
      if (i >= text.length || text[i] === '\t') return null;
      if (text[i] === quote) {
        if (quote === "'" && text[i + 1] === "'") {
          value += "'";
          i += 2;
        } else return { value, end: i + 1 };
      } else if (quote === '"' && text[i] === '\\') {
        if (text[i + 1] !== '"' && text[i + 1] !== '\\') return null;
        value += text[i + 1];
        i += 2;
      } else value += text[i++];
    }
  }
  INTEGER_SCALAR.lastIndex = pos;
  const integer = INTEGER_SCALAR.exec(text);
  if (integer) return { value: Number(integer[0]), end: pos + integer[0].length };
  PLAIN_SCALAR.lastIndex = pos;
  const match = PLAIN_SCALAR.exec(text);
  return match && !RESERVED_WORD.test(match[0]) ? { value: match[0], end: pos + match[0].length } : null;
}

const skipSpaces = (text, pos) => {
  while (text[pos] === ' ') pos++;
  return pos;
};

/** One line that is not blank and not a comment: { key, kind, value }, or { key, broken: true } (key is null when the line has none). */
function readEntry(line) {
  const key = SETTING_KEY.exec(line)?.[1] ?? null;
  const entry = SETTING_ENTRY.exec(line);
  if (!entry) return { key, broken: true };
  const rest = entry[1] ?? '';
  if (rest === '' || rest.startsWith('#')) return { key, kind: 'none' };
  let kind = 'single';
  let value;
  let pos;
  if (rest[0] === '[') {
    kind = 'list';
    value = [];
    pos = skipSpaces(rest, 1);
    if (rest[pos] === ']') pos++;
    else {
      for (;;) {
        const item = readScalar(rest, pos);
        if (!item) return { key, broken: true };
        value.push(item.value);
        pos = skipSpaces(rest, item.end);
        if (rest[pos] === ',') pos = skipSpaces(rest, pos + 1);
        else if (rest[pos] === ']') {
          pos++;
          break;
        } else return { key, broken: true };
      }
    }
  } else {
    const scalar = readScalar(rest, 0);
    if (!scalar) return { key, broken: true };
    ({ value, end: pos } = scalar);
  }
  const tail = rest.slice(pos);
  return /^ *$/.test(tail) || /^ +#/.test(tail) ? { key, kind, value } : { key, broken: true };
}

const goodPart = (part) => part !== '' && part !== '.' && part !== '..' && !/^\.[gG][iI][tT]$/.test(part) && !part.includes('\\');
const isOwner = (value) => typeof value === 'string' && OWNER_FORM.test(value);
const ownerOf = (value) => {
  const [, login, id] = OWNER_FORM.exec(value);
  return { login, id: Number(id) };
};
/** The form a value must have, given the items of the list before it: a number is acceptable only where a number is asked for. */
const FORMS = {
  folder: (value) => typeof value === 'string' && value.split('/').every(goodPart),
  part: (value) => typeof value === 'string' && !value.includes('/') && goodPart(value),
  key: (value) => typeof value === 'string' && KEY_NAME.test(value),
  owner: (value, before) => isOwner(value) && !before.some((other) => isOwner(other) && ownerOf(other).id === ownerOf(value).id),
  count: (value) => typeof value === 'number' && value >= 1 && value <= 99,
  'refuse-or-allow': (value) => value === 'refuse' || value === 'allow',
};

/**
 * Reads the bytes of a settings file. Returns { settings, problems }: `settings` is { folder, sharedFolder, extraKeys, owners,
 * approvals, witnesses, sharedChanges } (an owner and a witness are { login, id }), each at its default when the file does not set it or has a problem with it, and `problems` are { line, rule, detail } in the
 * order of the lines (line is null when a problem has none).
 */
export function parseSettings(bytes) {
  const settings = defaultSettings();
  const { text, reason, line: where } = readText(bytes);
  if (text === undefined) return { settings, problems: [{ line: where, rule: 'S-02', detail: reason }] };
  const problems = [];
  const byKey = new Map();
  text.split('\n').forEach((raw, index) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (/^ *(?:#|$)/.test(line)) return;
    const entry = readEntry(line);
    const number = index + 1;
    if (entry.broken) problems.push({ line: number, rule: 'S-03', detail: cutDetail(line.replace(/ +$/, '')) });
    if (entry.key === null) return;
    if (!byKey.has(entry.key)) byKey.set(entry.key, []);
    byKey.get(entry.key).push({ number, ...entry });
  });
  for (const [key, occurrences] of byKey) {
    const setting = SETTINGS.get(key);
    const readable = occurrences.filter((entry) => !entry.broken);
    if (!setting) {
      for (const { number } of readable) problems.push({ line: number, rule: 'S-05', detail: cutDetail(key) });
    } else if (occurrences.length > 1) {
      for (const { number } of readable) problems.push({ line: number, rule: 'S-04', detail: cutDetail(key) });
    } else if (readable.length === 1) {
      const [{ number, kind, value }] = readable;
      const items = kind === 'list' ? value : [value];
      const bad = kind === setting.kind ? items.findIndex((item, i) => !FORMS[setting.form](item, items.slice(0, i))) : -1;
      if (kind !== setting.kind) problems.push({ line: number, rule: 'S-06', detail: cutDetail(key) });
      else if (bad >= 0) problems.push({ line: number, rule: 'S-07', detail: cutDetail(String(items[bad])) });
      else settings[setting.field] = setting.form === 'owner' ? value.map(ownerOf) : value;
    }
  }
  return { settings, problems: problems.sort((a, b) => a.line - b.line) };
}

/**
 * The settings of an opened commit (see `openCommit`): { settings, problems }, like `parseSettings`, with each problem
 * naming its file. A commit without the file has every default; a link or the wrong kind of entry on the way is S-01.
 */
export function readSettings(commit) {
  const parts = SETTINGS_PATH.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const where = parts.slice(0, i).join('/');
    const kind = commit.kind(where);
    if (kind === undefined) return { settings: defaultSettings(), problems: [] };
    const fine = i === parts.length ? kind === 'file' || kind === 'executable' : kind === 'directory';
    if (!fine) return { settings: defaultSettings(), problems: [{ file: SETTINGS_PATH, line: null, rule: 'S-01', detail: where }] };
  }
  const { settings, problems } = parseSettings(commit.read(SETTINGS_PATH));
  return { settings, problems: problems.map((problem) => ({ file: SETTINGS_PATH, ...problem })) };
}

// ---- checking a change: docs/checking-a-change.md ---------------------------------------------------------------------------

/** What each rule of docs/checking-a-change.md says, as what is wrong with the file (or the folder) it is reported for. */
export const CHANGE_RULES = {
  'P-01': 'was deleted, renamed or moved; a record is never removed',
  'P-02': 'is sealed and its text has changed',
  'P-03': 'is sealed and its status was changed in a way that is not allowed',
  'P-04': 'is superseded by a record that does not vouch for it',
  'P-05': 'lists a record in supersedes that is not superseded by it',
  'P-06': 'says it is accepted and has no seal that verifies',
  'P-07': 'has a seal and is not accepted',
  'P-08': 'is in the shared folder, which this version does not check',
  'P-09': 'is not on top of the base: the base is not an ancestor of the head',
  'P-10': 'is sealed and its Errata section is not a chain of erratum entries',
  'P-11': 'has an erratum entry that does not follow from the base',
  'P-12': 'has an erratum that changes a key an erratum may not change',
  'P-13': 'has an erratum that changes the sealed text and has not been open for 48 hours',
  'P-14': 'has a deviation entry that is not allowed',
  'P-15': 'has a workflow other than the kit\'s that names the check',
  'P-16': 'has an emergency key and does not replace a protocol record',
  'P-17': 'has an applies-to item that no file matches',
  'P-18': 'has an applies-to item that this change leaves without a file',
};

/** The pin of a repository: which release of the kit it wants. Its content is not read; a change to it is an act. */
export const PIN_PATH = '.github/record-keeper.yml';

/**
 * The files that make the check (docs/protected-files.md): a change to one is an act, and no other workflow may name the check. The programs are
 * guarded in both places they can stand: at the root, where the kit keeps them, and in `.github/record-keeper/`, where a repository that installs
 * the kit keeps them (docs/install.md). The workflows stand at the same paths in both.
 */
export const WORKFLOW_FILES = [
  '.github/workflows/records-integrity.yml',
  '.github/workflows/records-audit.yml',
  '.github/workflows/records-setup-check.yml',
  '.github/workflows/records-updater.yml',
];
const PROGRAMS = ['record-keeper.mjs', 'check-pull-request.mjs', 'run-audit.mjs', 'setup-check.mjs', 'updater.mjs'];
export const CODE_FILES = [...PROGRAMS, ...PROGRAMS.map((name) => `.github/record-keeper/${name}`)];
/**
 * The files that agents read (docs/agent-files.md): the skill, which is a managed file and guarded like a workflow file, and AGENTS.md, of which only the block between the
 * two markers is guarded (`blockChanged` is the one function that says what that is). A change to either is the act `instructions`.
 */
export const INSTRUCTION_FILES = [SKILL_PATH, AGENTS_PATH];
const WORKFLOW_FOLDER = '.github/workflows';
const NAMES_THE_CHECK = /records[ _-]?integrity/i;

/** Rules of the format page that judge what a sealed record says; a change that leaves a sealed record's text alone cannot bring them. */
const CONTENT_RULES = new Set([
  'V-09', 'V-10', 'V-11', 'V-12', 'V-13', 'V-14', 'V-15', 'V-16', 'V-17', 'V-18', 'V-19',
  'V-21', 'V-22', 'V-23', 'V-24', 'V-25', 'V-26', 'V-27', 'V-28', 'V-35', 'V-36', 'V-37',
]);
const ACT_ORDER = ['accept', 'erratum', 'deviation', 'settings', 'owners', 'amendment', 'pin', 'workflow', 'code', 'instructions'];
/** The acts that the amendment bar governs (docs/amendments.md). */
const BAR_KINDS = new Set(['owners', 'amendment']);
const SUPERSEDED = /^superseded by (\d{4})$/;

/** The UTF-8 order of two texts; null sorts first. */
function byBytes(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return Buffer.compare(Buffer.from(String(a), 'utf8'), Buffer.from(String(b), 'utf8'));
}

/** What the check needs to know of one record file: whether it is readable, its status, its supersedes, and whether it is sealed. */
function readRecord(bytes) {
  let record;
  try {
    record = parse(bytes);
  } catch (error) {
    if (error instanceof Reject) return { bytes, readable: false, sealed: false, claims: false };
    throw error;
  }
  const entry = (key) => record.entries.find((candidate) => candidate.key === key);
  const status = entry('status')?.value;
  const supersedes = entry('supersedes');
  const items = supersedes && shapeOf(supersedes).shape === 'list' ? shapeOf(supersedes).items : [];
  const claims = status !== undefined && (status === 'accepted' || SUPERSEDED.test(status));
  const check = verify(bytes);
  return {
    bytes,
    parsed: record,
    chain: readChain(record),
    readable: true,
    status,
    statusAt: entry('status')?.at,
    sealAt: entry('seal')?.at,
    hasEmergency: entry('emergency') !== undefined,
    emergency: entry('emergency') && shapeOf(entry('emergency')).shape === 'single' && [...entry('emergency').value].length <= 500 ? entry('emergency').value : undefined,
    seal: entry('seal')?.value,
    supersedes: items.filter((item) => NUMBER_FORM.test(item)).map(Number),
    claims,
    sealed: claims && check.ok,
    check,
  };
}

/** True when the record says it is accepted and has no seal, or a seal of g1 that does not match (P-06 `no seal`, `seal does not match`). */
const lacksSeal = (record) => record.claims && !record.sealed && (record.check.reason === 'not-sealed' || record.check.reason === 'mismatch');

/** The record files of a commit's records folder, by name, read once for each blob. */
function recordsOf(commit, folder, cache) {
  const files = commit.children(folder).filter(({ name, kind }) => (kind === 'file' || kind === 'executable') && RECORD_FILE.test(name)).sort((a, b) => byBytes(a.name, b.name));
  commit.prefetch(files.map(({ name }) => `${folder}/${name}`));
  return new Map(files.map(({ name, id }) => {
    if (!cache.has(id)) cache.set(id, readRecord(commit.read(`${folder}/${name}`)));
    return [name, cache.get(id)];
  }));
}

/** P-04 to P-07: what one commit says about the status of its records. */
function stateProblems(records) {
  const first = new Map();
  for (const name of records.keys()) if (!first.has(Number(name.slice(0, 4)))) first.set(Number(name.slice(0, 4)), name);
  const out = [];
  for (const [name, record] of records) {
    if (!record.readable) continue;
    const number = Number(name.slice(0, 4));
    const successor = SUPERSEDED.exec(record.status ?? '');
    if (successor && first.has(Number(successor[1])) && Number(successor[1]) > number) {
      const other = records.get(first.get(Number(successor[1])));
      if (!other.readable || !other.sealed) out.push({ file: name, rule: 'P-04', detail: `${successor[1]}: not sealed` });
      else if (!other.supersedes.includes(number)) out.push({ file: name, rule: 'P-04', detail: `${successor[1]}: does not list this record` });
    }
    if (record.sealed) {
      for (const listed of [...new Set(record.supersedes)].sort((a, b) => a - b)) {
        if (!first.has(listed) || listed >= number) continue;
        const other = records.get(first.get(listed));
        if (!other.readable || other.status !== `superseded by ${String(number).padStart(4, '0')}`) out.push({ file: name, rule: 'P-05', detail: String(listed).padStart(4, '0') });
      }
    }
    if (record.claims && !record.sealed) {
      const { reason, generation } = record.check;
      if (reason === 'not-sealed') out.push({ file: name, rule: 'P-06', detail: 'no seal' });
      else if (reason === 'unknown-generation') out.push({ file: name, rule: 'P-06', detail: `unknown generation ${generation}` });
      else if (reason === 'mismatch') out.push({ file: name, rule: 'P-06', detail: 'seal does not match' });
    }
    if (record.seal !== undefined && (record.status === 'proposed' || record.status === 'rejected')) out.push({ file: name, rule: 'P-07' });
    if (record.sealed && record.chain.reason !== null) out.push({ file: name, rule: 'P-10', detail: record.chain.reason });
  }
  return out;
}

const splitLines = (bytes) => {
  const lines = [];
  let at = 0;
  for (let i = bytes.indexOf(0x0a, at); i >= 0; i = bytes.indexOf(0x0a, at)) {
    lines.push(bytes.subarray(at, i));
    at = i + 1;
  }
  lines.push(bytes.subarray(at));
  return lines;
};

const shownStatus = (value) => (value === '' ? '(empty)' : /^[\x20-\x7e]{1,40}$/.test(value) ? value : '(other)');

/** P-02 and P-03 for a record sealed at the base: null when the head's bytes are an allowed version of it, else { rule, detail }. */
function compareSealed(record, headBytes) {
  const before = splitLines(record.bytes);
  const after = splitLines(headBytes);
  if (record.bytes.equals(headBytes)) return null;
  const common = Math.min(before.length, after.length);
  const differing = [];
  for (let i = 0; i < common; i++) if (!before[i].equals(after[i])) differing.push(i);
  if (before.length === after.length && differing.length === 1 && differing[0] === record.statusAt) {
    let line = after[differing[0]].toString('latin1');
    if (line.endsWith('\r')) line = line.slice(0, -1);
    const key = /^status:(?: ([^]*))?$/.exec(line.replace(/[ \t]+$/, ''));
    if (key) {
      const value = (key[1] ?? '').replace(/^ +/, '');
      if (value !== record.status) {
        if (record.status === 'accepted' && /^superseded by [0-9]{4}$/.test(value)) return null;
        return { rule: 'P-03', detail: `${record.status} -> ${shownStatus(value)}` };
      }
    }
  }
  return { rule: 'P-02', detail: `line ${(differing.length > 0 ? differing[0] : common) + 1}` };
}

// ---- errata and deviation notes: docs/errata-and-deviations.md --------------------------------------------------------------

const DEVIATIONS_HEADING = '## Known deviations';
const ERRATA_HEADING = '## Errata';
const WAIT_MS = 48 * 60 * 60 * 1000;
const ERRATUM_KEYS = ['date', 'previous entry', 'previous seal', 'seal', 'reason'];
const DEVIATION_KEYS = ['date', 'case', 'reason'];
const ENTRY_HEADING = /^### (Erratum|Deviation) ([1-9][0-9]{0,3})$/;
const ENTRY_ITEM = /^- ([a-z]+(?: [a-z]+)*): (\S(?:.*\S)?)$/;
const G1_SEAL = /^sha256-g1:[0-9a-f]{64}$/;
const CASE_FORM = /^(?:(issue|pull) ([1-9][0-9]{0,8})|commit ([0-9a-f]{40}|[0-9a-f]{64}))$/;
const FIXED_KEYS = ['applies-to', 'repos', 'window', 'supersedes'];
/** The rules of the format page that still judge a record that only gains a deviation note. */
const DEVIATION_RULES = new Set(['V-11', 'V-12', 'V-27', 'V-28']);

/** Where the two excluded sections of a parsed record are, each as [line of the heading, line after the last line] or null. */
function sectionsOf({ lines, end, fenced }) {
  const found = { deviations: null, errata: null };
  lines.forEach((line, i) => {
    if (i <= end || fenced[i - end - 1]) return;
    const which = line === DEVIATIONS_HEADING ? 'deviations' : line === ERRATA_HEADING ? 'errata' : null;
    if (which === null) return;
    let stop = i + 1;
    while (stop < lines.length && (fenced[stop - end - 1] || !SECTION_HEADING.test(lines[stop]))) stop++;
    found[which] = [i, stop];
  });
  return found;
}

/** The entries of a section, from the lines after its heading: the blocks that start at an entry heading of `kind`, and whether any other line is in none. */
function entriesOf(lines, kind) {
  const blocks = [];
  let stray = false;
  let current = null;
  for (const line of lines) {
    if (line.startsWith('### ')) {
      const heading = ENTRY_HEADING.exec(line);
      current = heading && heading[1] === kind ? { number: Number(heading[2]), lines: [line] } : null;
      if (current === null) stray = true;
      else blocks.push(current);
    } else if (current !== null) current.lines.push(line);
    else if (line !== '') stray = true;
  }
  for (const block of blocks) while (block.lines.at(-1) === '') block.lines.pop();
  return { blocks, stray };
}

const hashOf = (block) => `sha256:${createHash('sha256').update(`${block.lines.join('\n')}\n`, 'utf8').digest('hex')}`;
const reasonFits = (text) => [...text].length >= 1 && [...text].length <= 500;

/** The values of an entry whose keys are `keys`, or the first reason it is not that entry as number `number`. */
function readNote(block, keys, number) {
  if (block.number !== number) return { reason: `number: expected ${number}` };
  const body = block.lines.slice(1);
  const items = body.slice(1).map((line) => ENTRY_ITEM.exec(line));
  if (body.length !== keys.length + 1 || body[0] !== '' || items.some((item, i) => item === null || item[1] !== keys[i])) return { reason: `keys: expected ${keys.join(', ')}` };
  const values = Object.fromEntries(items.map((item) => [item[1], item[2]]));
  if (!isRealDate(values.date)) return { reason: 'date: not a date' };
  return { values };
}

/** An erratum entry as number `number`, after an entry whose hash and seal are `previous` (its seal null for the first): { values } or { reason }. */
function readErratum(block, number, previous) {
  const { values, reason } = readNote(block, ERRATUM_KEYS, number);
  if (reason !== undefined) return { reason };
  if (values['previous entry'] !== previous.hash) return { reason: `previous entry: expected ${previous.hash}` };
  if (previous.seal === null ? !G1_SEAL.test(values['previous seal']) : values['previous seal'] !== previous.seal) {
    return { reason: previous.seal === null ? 'previous seal: not a seal' : `previous seal: expected ${previous.seal}` };
  }
  if (!G1_SEAL.test(values.seal)) return { reason: 'seal: not a seal' };
  if (!reasonFits(values.reason)) return { reason: 'reason: empty or too long' };
  return { values };
}

/** The section `Errata` of a parsed record: how many entries it has, and why it is not a chain (null when it is). */
function readChain(parsed) {
  const { errata } = sectionsOf(parsed);
  if (errata === null) return { count: 0, reason: null };
  const { blocks, stray } = entriesOf(parsed.lines.slice(errata[0] + 1, errata[1]), 'Erratum');
  if (stray) return { count: blocks.length, reason: 'text outside an entry' };
  let previous = { hash: 'none', seal: null };
  for (const [i, block] of blocks.entries()) {
    const { values, reason } = readErratum(block, i + 1, previous);
    if (reason !== undefined) return { count: blocks.length, reason: `entry ${i + 1}: ${reason}` };
    previous = { hash: hashOf(block), seal: values.seal };
  }
  const stored = parsed.entries.find(({ key }) => key === 'seal')?.value;
  if (blocks.length > 0 && previous.seal !== stored) return { count: blocks.length, reason: 'seal: the last entry is not the seal of the record' };
  return { count: blocks.length, reason: null };
}

const sameLines = (a, b) => a.length === b.length && a.every((line, i) => line.equals(b[i]));
const inside = (range, i) => range !== null && i >= range[0] && i < range[1];

/** The lines of a record that are in neither excluded section, and the lines of each section, as raw buffers. */
function partsOf(record) {
  const raw = splitLines(record.bytes);
  const sections = sectionsOf(record.parsed);
  const part = (range) => (range === null ? [] : raw.slice(range[0], range[1]));
  const kept = (i) => !inside(sections.deviations, i) && !inside(sections.errata, i);
  return { raw, sections, rest: raw.filter((_, i) => kept(i)), unsealed: raw.filter((_, i) => kept(i) && i !== record.sealAt), deviations: part(sections.deviations), errata: part(sections.errata) };
}

/** Which allowed addition the change of a sealed record is: 'deviation', 'erratum' or null (docs/errata-and-deviations.md, "Which change is which"). */
function additionOf(before, after) {
  if (!after.readable) return null;
  const from = partsOf(before);
  const to = partsOf(after);
  const sameErrata = sameLines(from.errata, to.errata);
  const sameDeviations = sameLines(from.deviations, to.deviations);
  if (sameErrata && !sameDeviations && sameLines(from.rest, to.rest)) return 'deviation';
  if (!sameErrata && sameDeviations) {
    const keyLine = (parts, record, key) => { const found = record.parsed.entries.find((entry) => entry.key === key); return found === undefined ? null : parts.raw[found.at]; };
    const same = (key) => { const a = keyLine(from, before, key); const b = keyLine(to, after, key); return a !== null && b !== null && a.equals(b); };
    if (same('status') && same('date')) return 'erratum';
  }
  return null;
}

/** True when the commit `id` exists in the repository and is `base` or one of its ancestors. */
function commitExists(repo, id) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const result = spawnSync('git', ['-C', repo, 'rev-parse', '--verify', '--quiet', `${id}^{commit}`], { env: { ...inherited, GIT_TERMINAL_PROMPT: '0' } });
  if (result.error) throw new Unreadable(`cannot run git: ${result.error.message}`);
  if (result.status === 1) return false;
  if (result.status !== 0) throw new Unreadable(`git rev-parse failed: ${result.stderr.toString('utf8').trim()}`);
  return true;
}

function commitIn(repo, id, base) {
  return base !== null && commitExists(repo, id) && isAncestor(repo, id, base);
}

/** P-11 to P-13 for an erratum; `needs.clock` is set when the change waits. */
function judgeErratum(before, after, { since, now, needs, assume }) {
  const found = [];
  const from = partsOf(before);
  const to = partsOf(after);
  const reason = (() => {
    if (to.errata.length < from.errata.length || !sameLines(to.errata.slice(0, from.errata.length), from.errata)) return 'earlier entry changed';
    if (after.chain.count !== before.chain.count + 1) return 'not one new entry';
    const { blocks } = entriesOf(after.parsed.lines.slice(to.sections.errata[0] + 1, to.sections.errata[1]), 'Erratum');
    const added = readNote(blocks.at(-1), ERRATUM_KEYS, blocks.length);
    if (added.values !== undefined && added.values['previous seal'] !== before.seal) return `previous seal: expected ${before.seal}`;
    if (sameLines(from.unsealed, to.unsealed)) return 'no change of the text';
    return null;
  })();
  if (reason !== null) found.push({ rule: 'P-11', detail: reason });
  for (const key of FIXED_KEYS) {
    const entry = (record) => { const e = record.parsed.entries.find((candidate) => asciiLower(candidate.key) === key); return e === undefined ? null : [record.parsed.lines[e.at], ...e.owned].join('\n'); };
    if (entry(before) !== entry(after)) found.push({ rule: 'P-12', detail: key });
  }
  if (seal(after.bytes) !== before.seal) {
    needs.clock = true;
    const elapsed = since === undefined ? null : Math.max(0, now - since);
    if (assume === true) { /* the audit without evidence cannot read when the head was first seen */ } else if (elapsed === null) found.push({ rule: 'P-13', detail: 'no clock' });
    else if (elapsed < WAIT_MS) found.push({ rule: 'P-13', detail: `${Math.floor(elapsed / 3_600_000)}h of 48h` });
  }
  return found;
}

/** P-14 for a deviation note; the issues and pull requests it cites are added to `needs.cases`. */
function judgeDeviation(before, after, { repo, base, cases, needs, assume }) {
  const from = partsOf(before);
  const to = partsOf(after);
  if (to.deviations.length < from.deviations.length || !sameLines(to.deviations.slice(0, from.deviations.length), from.deviations)) return [{ rule: 'P-14', detail: 'earlier entry changed' }];
  const [heading, stop] = to.sections.deviations;
  const first = from.sections.deviations === null ? 1 : from.deviations.length;
  const { blocks, stray } = entriesOf(after.parsed.lines.slice(heading + first, stop), 'Deviation');
  if (stray) return [{ rule: 'P-14', detail: 'text outside an entry' }];
  if (blocks.length === 0) return [{ rule: 'P-14', detail: 'no new entry' }];
  const earlier = before.parsed.lines.slice(...(from.sections.deviations ?? [0, 0])).map((line) => /^### Deviation ([1-9][0-9]{0,3})$/.exec(line)).filter(Boolean).map((m) => Number(m[1]));
  const greatest = Math.max(0, ...earlier);
  const found = [];
  blocks.forEach((block, k) => {
    const fail = (reason) => found.push({ rule: 'P-14', detail: `entry ${k + 1}: ${reason}` });
    const { values, reason } = readNote(block, DEVIATION_KEYS, greatest + k + 1);
    if (reason !== undefined) return fail(reason);
    const cited = CASE_FORM.exec(values.case);
    if (cited === null) return fail('case: expected issue N, pull N or commit HEX');
    if (!reasonFits(values.reason)) return fail('reason: empty or too long');
    if (cited[1] !== undefined) {
      const number = Number(cited[2]);
      needs.cases.set(`${cited[1]} ${number}`, { kind: cited[1], number });
      if (!assume && !(cases?.[cited[1]] ?? []).includes(number)) return fail('case does not resolve');
    } else if (!commitIn(repo, cited[3], base)) return fail('case does not resolve');
    return undefined;
  });
  return found;
}

/** The paths of the regular files among the leaves of a commit. */
const regularFiles = (leaves) => [...leaves].filter(([, value]) => /^(?:file|executable) /.test(value)).map(([entryPath]) => entryPath);

/** The items of the `applies-to` list of a parsed record, each different one once, in the order written (none when the entry is not a list). */
function appliesToItems(record) {
  const entry = record.parsed.entries.find(({ key }) => key === 'applies-to');
  return entry && shapeOf(entry).shape === 'list' ? [...new Set(shapeOf(entry).items)] : [];
}

/** The expression for an item of `applies-to` (docs/applies-to.md): `**` + `/` is zero or more folders, `**` any run, `*` a run without `/`. */
export function appliesToPattern(item) {
  let source = '';
  for (let at = 0; at < item.length;) {
    if (item.startsWith('**/', at)) { source += '(?:[^]*/)?'; at += 3; }
    else if (item.startsWith('**', at)) { source += '[^]*'; at += 2; }
    else if (item[at] === '*') { source += '[^/]*'; at += 1; }
    else { source += item[at].replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); at += 1; }
  }
  return new RegExp(`^${source}$`);
}

/** The numbers of the protocol records of a commit: the rows `| gN | [NNNN](...) | ... |` of the README of its records folder (docs/amendments.md). */
export function protocolRecords(commit, folder) {
  const found = new Set();
  const readme = `${folder}/README.md`;
  if (!['file', 'executable'].includes(commit.kind(readme))) return found;
  for (const line of commit.read(readme).toString('utf8').split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.slice(1).split('|').map((cell) => cell.replace(/^[ \t\r]+|[ \t\r]+$/g, ''));
    const link = /\[([0-9]{4})\]\(/.exec(cells[1] ?? '');
    if (/^g[0-9]+$/.test(cells[0]) && link) found.add(Number(link[1]));
  }
  return found;
}

const isRelated = (changed, path) => changed === path || path.startsWith(`${changed}/`) || changed.startsWith(`${path}/`);

/**
 * Whether the change touches what agents read in AGENTS.md. Only a regular file in the same place before and after is read for its block (docs/agent-files.md): a mode that
 * differs between a file and an executable is nothing, a change outside the markers is nothing, and a change to the block or to the markers is the act. A link, a folder or a
 * submodule in that place, before or after, counts as a change, because it can lead anywhere.
 */
function agentsChanged(base, head, leavesOfBase, leavesOfHead, changed) {
  const regular = (leaf) => leaf === undefined || /^(?:file|executable) /.test(leaf);
  const [before, after] = [leavesOfBase.get(AGENTS_PATH), leavesOfHead.get(AGENTS_PATH)];
  if (changed.some((path) => path !== AGENTS_PATH && isRelated(path, AGENTS_PATH)) || !regular(before) || !regular(after)) return true;
  return blockChanged(before === undefined ? null : base.read(AGENTS_PATH), after === undefined ? null : head.read(AGENTS_PATH));
}

/** True when `ancestor` is `descendant` or one of its ancestors. */
function isAncestor(repo, ancestor, descendant) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const result = spawnSync('git', ['-C', repo, 'merge-base', '--is-ancestor', ancestor, descendant], { env: { ...inherited, GIT_TERMINAL_PROMPT: '0' } });
  if (result.error) throw new Unreadable(`cannot run git: ${result.error.message}`);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Unreadable(`git merge-base failed: ${result.stderr.toString('utf8').trim()}`);
}

const sameDetail = ({ rule, detail }) => (rule.startsWith('V-') ? '' : detail ?? '');
const identity = (problem) => JSON.stringify([problem.file, problem.rule, sameDetail(problem)]);

/**
 * Judges the head against the base (docs/checking-a-change.md). Returns { folder, settings, problems, acts, approval }: the records
 * folder, the problems of the settings of the base (and of the head, when the change touches them), the problems of the records, the
 * acts that need the owners' approval, and the count of that approval (docs/approvals.md; null unless `reviews`, as `readReviews`
 * returns them, and the ID of the `author` of the pull request are given), and what the caller could still look up (`needs`:
 * the cited issues and pull requests, and whether the time since the head was first seen matters). `cases` is what exists, as
 * `readCases` returns it; `since` and `now` are milliseconds (docs/errata-and-deviations.md). Throws Unreadable.
 */
export function checkChange(repo, baseRev, headRev, options = {}) {
  return judgeChange(repo, openCommit(repo, baseRev), openCommit(repo, headRev), options);
}

/**
 * checkChange for two commits that are already open (`openCommit`, or `emptyCommit` for the base of a first commit). `cache` is the
 * map of the records read from blobs, which a caller that judges many commits shares; `assume` takes the issues and pull requests that
 * a note cites to exist (`assume: 'cases'`), or that and the 48 hours of an erratum too (`assume: true`; the audit, docs/audit.md and
 * docs/audit-effects.md). `reviewed` is the commit the reviews must name, when it is not `head`: the head of the pull request that was
 * squashed or rebased onto the branch.
 */
export function judgeChange(repo, base, head, { author, reviews, reviewed, cases, since, now = Date.now(), assume = false, cache = new Map() } = {}) {
  const read = readSettings(base);
  const { folder, sharedFolder, extraKeys, sharedChanges } = read.settings;
  const named = reviewed ?? head.commit;
  const approval = reviews === undefined ? null : countApprovals({ owners: read.settings.owners, needed: read.settings.approvals, head: named, author, reviews });
  const needs = { cases: new Map(), clock: false };
  if (!base.empty && !isAncestor(repo, base.commit, head.commit)) return { folder, settings: [], problems: [{ file: null, rule: 'P-09' }], acts: [], approval, bars: [], needs: { cases: [], clock: false } };
  const leavesOfBase = base.leaves();
  const leavesOfHead = head.leaves();
  const changed = [...new Set([...leavesOfBase.keys(), ...leavesOfHead.keys()])].filter((path) => leavesOfBase.get(path) !== leavesOfHead.get(path)).sort(byBytes);
  const settingsTouched = changed.some((path) => isRelated(path, SETTINGS_PATH));
  const headRead = settingsTouched ? readSettings(head) : null;
  const headProblems = headRead ? headRead.problems : [];
  const repair = read.problems.length > 0 && changed.length > 0 && changed.every((path) => isRelated(path, SETTINGS_PATH)) && headProblems.length === 0;

  const settings = [];
  if (!repair) {
    const seen = new Set();
    for (const problem of [...read.problems, ...headProblems]) {
      const key = JSON.stringify([problem.line, problem.rule, problem.detail ?? '']);
      if (!seen.has(key)) settings.push(problem);
      seen.add(key);
    }
    settings.sort((a, b) => (a.line === b.line ? 0 : a.line === null ? -1 : b.line === null ? 1 : a.line - b.line) || byBytes(a.rule, b.rule) || byBytes(a.detail ?? '', b.detail ?? ''));
  }

  const before = recordsOf(base, folder, cache);
  const after = recordsOf(head, folder, cache);
  const entriesOf = (commit) => new Map(commit.children(folder).map(({ name, kind, id }) => [name, `${kind} ${id}`]));
  const entriesBefore = entriesOf(base);
  const entriesAfter = entriesOf(head);
  const sameEntry = (name) => entriesBefore.get(name) === entriesAfter.get(name);

  const problems = [];
  for (const name of before.keys()) if (!after.has(name)) problems.push({ file: name, rule: 'P-01' });
  const sealedKept = new Set([...before].filter(([name, record]) => record.sealed && after.has(name)).map(([name]) => name));
  const additions = new Map();
  for (const name of sealedKept) {
    const got = compareSealed(before.get(name), after.get(name).bytes);
    if (got === null) continue;
    const kind = got.rule === 'P-02' ? additionOf(before.get(name), after.get(name)) : null;
    if (kind === null) {
      problems.push({ file: name, ...got });
      continue;
    }
    additions.set(name, kind);
    const found = kind === 'erratum'
      ? judgeErratum(before.get(name), after.get(name), { since, now, needs, assume })
      : judgeDeviation(before.get(name), after.get(name), { repo, base: base.empty ? null : base.commit, cases, needs, assume });
    for (const problem of found) problems.push({ file: name, ...problem });
  }
  const noted = new Set();
  for (const [name, record] of before) {
    if (!lacksSeal(record) || !after.has(name) || additionOf(record, after.get(name)) !== 'deviation') continue;
    noted.add(name);
    additions.set(name, 'deviation');
    for (const problem of judgeDeviation(record, after.get(name), { repo, base: base.empty ? null : base.commit, cases, needs, assume })) problems.push({ file: name, ...problem });
  }
  // A record that says it is accepted and does not verify, whose only change is its status line, from `accepted` to `superseded by NNNN`:
  // the successor vouches for it (P-04), as for a sealed record, so the old P-06 is not repeated (docs/checking-a-change.md).
  const superseding = new Set();
  for (const [name, record] of before) {
    const next = after.get(name);
    if (!lacksSeal(record) || record.status !== 'accepted' || !next?.readable || record.bytes.equals(next.bytes)) continue;
    if (compareSealed(record, next.bytes) === null) superseding.add(name);
  }
  const shared = `${folder}/${sharedFolder}`;
  if (sharedChanges !== 'allow') for (const path of changed) if (path === shared || path.startsWith(`${shared}/`)) problems.push({ file: path.slice(folder.length + 1), rule: 'P-08' });
  const isWorkflow = (path) => path.startsWith(`${WORKFLOW_FOLDER}/`) && !path.slice(WORKFLOW_FOLDER.length + 1).includes('/') && /\.ya?ml$/i.test(path) && !WORKFLOW_FILES.includes(path);
  const added = changed.filter((path) => isWorkflow(path) && /^(?:file|executable) /.test(leavesOfHead.get(path) ?? ''));
  head.prefetch(added);
  for (const path of added) {
    if (NAMES_THE_CHECK.test(path.slice(WORKFLOW_FOLDER.length + 1)) || NAMES_THE_CHECK.test(head.read(path).toString('latin1'))) problems.push({ file: null, rule: 'P-15', detail: path });
  }

  const known = new Set(validateOpened(base, folder, { extraKeys, sharedFolder }).map(identity));
  for (const problem of validateOpened(head, folder, { extraKeys, sharedFolder })) {
    if (superseding.has(problem.file) && CONTENT_RULES.has(problem.rule)) continue;
    if ((sealedKept.has(problem.file) || noted.has(problem.file)) && CONTENT_RULES.has(problem.rule)) {
      const kind = additions.get(problem.file);
      const applies = kind === 'erratum' ? problem.rule !== 'V-10' : kind === 'deviation' && DEVIATION_RULES.has(problem.rule);
      if (applies && !known.has(identity(problem))) problems.push(problem);
      continue;
    }
    if (known.has(identity(problem)) && (problem.file === null || sameEntry(problem.file))) continue;
    problems.push(problem);
  }
  const knownState = new Set(stateProblems(before).map(identity));
  for (const problem of stateProblems(after)) if (!knownState.has(identity(problem)) || !(sameEntry(problem.file) || additions.get(problem.file) === 'deviation' || superseding.has(problem.file))) problems.push(problem);

  const protocolBefore = protocolRecords(base, folder);
  const protocolAfter = protocolRecords(head, folder);
  const waived = new Set();
  const acts = [];
  for (const [name, record] of after) {
    if (!record.sealed || before.get(name)?.sealed) continue;
    if (record.supersedes.some((number) => protocolBefore.has(number))) {
      acts.push({ kind: 'amendment', path: `${folder}/${name}` });
      if (record.emergency !== undefined) waived.add(`${folder}/${name}`);
    } else {
      acts.push({ kind: 'accept', path: `${folder}/${name}` });
      if (record.hasEmergency) problems.push({ file: name, rule: 'P-16' });
    }
  }
  if (protocolBefore.size !== protocolAfter.size || [...protocolBefore].some((number) => !protocolAfter.has(number))) acts.push({ kind: 'amendment', path: `${folder}/README.md` });
  for (const [name, kind] of additions) acts.push({ kind, path: `${folder}/${name}` });
  if (settingsTouched) {
    acts.push({ kind: 'settings', path: SETTINGS_PATH });
    if (changesOwners(read.settings, headRead.settings)) acts.push({ kind: 'owners', path: SETTINGS_PATH });
  }
  if (changed.some((path) => isRelated(path, PIN_PATH))) acts.push({ kind: 'pin', path: PIN_PATH });
  for (const [kind, files] of [['workflow', WORKFLOW_FILES], ['code', CODE_FILES]]) {
    for (const file of files) if (changed.some((path) => isRelated(path, file))) acts.push({ kind, path: file });
  }
  if (changed.some((path) => isRelated(path, SKILL_PATH))) acts.push({ kind: 'instructions', path: SKILL_PATH });
  if (changed.some((path) => isRelated(path, AGENTS_PATH)) && agentsChanged(base, head, leavesOfBase, leavesOfHead, changed)) acts.push({ kind: 'instructions', path: AGENTS_PATH });

  const filesBefore = regularFiles(leavesOfBase);
  const filesAfter = regularFiles(leavesOfHead);
  for (const [name, record] of after) {
    if (!record.sealed || before.get(name)?.sealed) continue;
    for (const item of appliesToItems(record)) {
      const pattern = appliesToPattern(item);
      if (!filesAfter.some((file) => pattern.test(file))) problems.push({ file: name, rule: 'P-17', detail: item });
    }
  }
  for (const [name, record] of before) {
    const now = after.get(name);
    if (!record.sealed || record.status !== 'accepted' || !now?.readable || now.status !== 'accepted') continue;
    for (const item of appliesToItems(record)) {
      const pattern = appliesToPattern(item);
      if (filesBefore.some((file) => pattern.test(file)) && !filesAfter.some((file) => pattern.test(file))) problems.push({ file: name, rule: 'P-18', detail: item });
    }
  }

  const bars = [];
  for (const act of acts) {
    if (!BAR_KINDS.has(act.kind)) continue;
    const free = act.kind === 'amendment' && waived.has(act.path);
    if (!free) needs.clock = true;
    const result = reviews === undefined
      ? { met: false, reason: 'no reviews were given' }
      : amendmentBar({ owners: read.settings.owners, head: named, author, reviews, since, now, waived: free });
    bars.push({ kind: act.kind, path: act.path, ...result });
  }

  problems.sort((a, b) => byBytes(a.file, b.file) || byBytes(a.rule, b.rule) || byBytes(a.detail ?? '', b.detail ?? ''));
  acts.sort((a, b) => ACT_ORDER.indexOf(a.kind) - ACT_ORDER.indexOf(b.kind) || byBytes(a.path, b.path));
  bars.sort((a, b) => ACT_ORDER.indexOf(a.kind) - ACT_ORDER.indexOf(b.kind) || byBytes(a.path, b.path));
  const wanted = [...needs.cases.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'issue' ? -1 : 1) || a.number - b.number);
  return { folder, settings, problems, acts, approval, bars, needs: { cases: wanted, clock: needs.clock } };
}

// ---- the owners' approval: docs/approvals.md --------------------------------------------------------------------------------

// ---- the audit: docs/audit.md ---------------------------------------------------------------------------------------------------

/** What each rule of the audit says, besides those of the pull request check that it replays. */
export const AUDIT_RULES = {
  'A-01': 'was started or last run from a commit that is not in the history of the head',
  'A-02': 'is a record file under a number that another file name had before',
  'A-03': 'is an act that was not approved as the protocol asks',
  'P-19': 'is accepted and has an applies-to item that no file matches',
};
const FULL_COMMIT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

const gitLines = (repo, args) => runGit(['-C', repo, ...args]).toString('utf8').split('\n').filter((line) => line !== '');
const messageOf = (repo, id) => runGit(['-C', repo, 'log', '-1', '--format=%B', id]).toString('utf8');
const subjectOf = (message) => message.split('\n')[0];
const pullOf = (subject) => {
  const found = /^Merge pull request #([1-9][0-9]{0,8}) /.exec(subject) ?? /\(#([1-9][0-9]{0,8})\)$/.exec(subject);
  return found ? Number(found[1]) : null;
};

/** True when the note (a cited case) names the commit with this message. */
function namesCommit(cited, id, message) {
  if (cited[3] !== undefined) return cited[3] === id;
  const number = cited[2];
  if (cited[1] === 'pull') {
    const subject = subjectOf(message);
    return subject.startsWith(`Merge pull request #${number} `) || subject.endsWith(`(#${number})`);
  }
  return new RegExp(`(?<![0-9A-Za-z_])#${number}(?![0-9])`).test(message);
}

const RECORD_ACTS = new Set(['accept', 'erratum', 'deviation', 'amendment']);

function refuseShallow(repo) {
  if (runGit(['-C', repo, 'rev-parse', '--is-shallow-repository']).toString('utf8').trim() === 'true') {
    throw new Unreadable('the repository is a shallow clone: the audit needs the whole history');
  }
}

/**
 * Audits the history of a repository up to `headRev` (docs/audit.md). `from` is the full id of the commit where the protocol began and
 * `since` that of the last commit audited; neither is judged. With `evidence` (readEvidence, docs/audit-effects.md) the acts of each
 * commit are judged against the reviews of the pull request that brought them in (rule A-03). Returns
 * { head, from, folder, judged, violations, excused, acts, cases }. Throws Unreadable.
 */
export function audit(repo, headRev, { from, since, evidence } = {}) {
  const tip = openCommit(repo, headRev);
  refuseShallow(repo);
  const found = [];
  const bounds = [];
  for (const [which, id] of [['from', from], ['since', since]]) {
    if (id === undefined) continue;
    if (commitExists(repo, id) && isAncestor(repo, id, tip.commit)) bounds.push(id);
    else found.push({ commit: tip.commit, kind: 'history', file: null, rule: 'A-01', detail: `${which} ${id}` });
  }
  const listing = gitLines(repo, ['rev-list', '--first-parent', '--reverse', '--parents', tip.commit, ...bounds.map((id) => `^${id}`)]);
  const order = new Map(listing.map((line, index) => [line.split(' ')[0], index]));

  const cache = new Map();
  const acts = [];
  const cases = [];
  let previous = null;
  for (const line of listing) {
    const [id, parent] = line.split(' ');
    const base = parent === undefined ? emptyCommit() : previous?.commit === parent ? previous : openCommit(repo, parent);
    const commit = id === tip.commit ? tip : openCommit(repo, id);
    let result = judgeChange(repo, base, commit, { assume: true, cache });
    const refused = [];
    if (evidence !== undefined && result.acts.length > 0) {
      const given = evidence.get(id);
      if (given === undefined) throw new Unreadable(`no evidence for the commit ${id}`);
      if (given.pull === null) {
        for (const act of result.acts) refused.push({ act, reason: 'no pull request' });
      } else {
        const { pull } = given;
        const reviews = given.reviews.filter((review) => review.at === null || review.at <= pull.mergedText);
        result = judgeChange(repo, base, commit, { assume: 'cases', author: pull.author, reviews, reviewed: pull.head, since: given.started ?? undefined, now: pull.merged, cache });
        for (const act of result.acts) {
          if (actApproved(act, result.approval, result.bars)) continue;
          const bar = BAR_KINDS.has(act.kind) ? result.bars.find(({ kind, path: barPath }) => kind === act.kind && barPath === act.path) : null;
          refused.push({ act, reason: bar ? bar.reason : `${result.approval.have} of ${result.approval.needed} approvals` });
        }
      }
    }
    for (const { act, reason } of refused) {
      const named = RECORD_ACTS.has(act.kind) && act.path.startsWith(`${result.folder}/`) ? act.path.slice(result.folder.length + 1) : null;
      found.push({ commit: id, kind: 'commit', file: named !== null && RECORD_FILE.test(named) ? named : null, rule: 'A-03', detail: `${act.kind} ${act.path}: ${reason}` });
    }
    for (const problem of result.settings) found.push({ commit: id, kind: 'commit', file: null, rule: problem.rule, detail: problem.detail ?? '', line: problem.line });
    for (const problem of result.problems) found.push({ commit: id, kind: 'commit', file: problem.file, rule: problem.rule, detail: problem.detail ?? '' });
    for (const act of result.acts) acts.push({ commit: id, kind: act.kind, path: act.path });
    for (const cited of result.needs.cases) cases.push({ commit: id, kind: cited.kind, number: cited.number });
    previous = commit;
  }

  const folder = readSettings(tip).settings.folder;
  const names = new Map();
  let at = null;
  for (const line of gitLines(repo, ['log', '--first-parent', '--reverse', '--diff-merges=first-parent', '--no-renames', '--raw', '--format=%x01%H', tip.commit, '--', folder])) {
    if (line.startsWith('\x01')) {
      at = line.slice(1);
      continue;
    }
    const entry = /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ [A-Z]\t(.*)$/.exec(line);
    if (!entry) continue;
    const [, oldMode, newMode, file] = entry;
    const regular = (mode) => mode === '100644' || mode === '100755';
    if (!regular(newMode) || regular(oldMode) || !file.startsWith(`${folder}/`)) continue;
    const name = file.slice(folder.length + 1);
    if (name.includes('/') || !RECORD_FILE.test(name)) continue;
    const number = Number(name.slice(0, 4));
    if (!names.has(number)) names.set(number, name);
    else if (names.get(number) !== name && order.has(at)) found.push({ commit: at, kind: 'register', file: name, rule: 'A-02', detail: `${name.slice(0, 4)}: ${names.get(number)} -> ${name}` });
  }

  const records = recordsOf(tip, folder, cache);
  const seen = new Set(found.filter(({ kind }) => kind === 'commit').map(({ file, rule, detail }) => JSON.stringify([file, rule, detail])));
  for (const problem of stateProblems(records)) {
    if (!seen.has(JSON.stringify([problem.file, problem.rule, problem.detail ?? '']))) found.push({ commit: tip.commit, kind: 'state', file: problem.file, rule: problem.rule, detail: problem.detail ?? '' });
  }
  const files = regularFiles(tip.leaves());
  for (const [name, record] of records) {
    if (!record.sealed || record.status !== 'accepted') continue;
    for (const item of appliesToItems(record)) {
      const pattern = appliesToPattern(item);
      if (!files.some((file) => pattern.test(file)) && !seen.has(JSON.stringify([name, 'P-18', item]))) found.push({ commit: tip.commit, kind: 'state', file: name, rule: 'P-19', detail: item });
    }
  }

  const messages = new Map();
  const message = (id) => {
    if (!messages.has(id)) messages.set(id, messageOf(repo, id));
    return messages.get(id);
  };
  const notes = new Map();
  const notesOf = (name) => {
    if (!notes.has(name)) {
      const record = records.get(name);
      const section = record?.readable ? sectionsOf(record.parsed).deviations : null;
      const blocks = section ? entriesOf(record.parsed.lines.slice(section[0] + 1, section[1]), 'Deviation').blocks : [];
      notes.set(name, blocks.flatMap((block) => {
        const { values } = readNote(block, DEVIATION_KEYS, block.number);
        const cited = values === undefined ? null : CASE_FORM.exec(values.case);
        return cited ? [{ number: block.number, case: values.case, cited }] : [];
      }));
    }
    return notes.get(name);
  };
  const violations = [];
  const excused = [];
  for (const violation of found) {
    const note = (violation.kind === 'commit' || violation.kind === 'register') && violation.file !== null && RECORD_FILE.test(violation.file)
      ? notesOf(violation.file).find(({ cited }) => namesCommit(cited, violation.commit, message(violation.commit)))
      : undefined;
    if (note) excused.push({ ...violation, note: { file: violation.file, number: note.number, case: note.case } });
    else violations.push(violation);
  }

  const position = (violation) => (violation.kind === 'history' ? -1 : violation.kind === 'state' ? Infinity : order.get(violation.commit));
  const sorter = (a, b) => (position(a) === position(b) ? 0 : position(a) < position(b) ? -1 : 1) || byBytes(a.file, b.file) || byBytes(a.rule, b.rule) || byBytes(a.detail, b.detail) || (a.line ?? 0) - (b.line ?? 0);
  violations.sort(sorter);
  excused.sort(sorter);
  for (const act of acts) act.pull = pullOf(subjectOf(message(act.commit)));
  return { head: tip.commit, from: from ?? null, folder, judged: listing.length, violations, excused, acts, cases };
}

/** The oldest commit of the first-parent history of `headRev` whose tree holds the settings file as a regular file, or null (docs/audit-effects.md). */
export function findAdoption(repo, headRev) {
  const tip = openCommit(repo, headRev);
  refuseShallow(repo);
  for (const id of gitLines(repo, ['rev-list', '--first-parent', '--reverse', tip.commit])) {
    const listed = gitLines(repo, ['ls-tree', id, '--', SETTINGS_PATH]);
    if (listed.some((line) => /^100(?:644|755) blob [0-9a-f]+\t/.test(line) && line.endsWith(`\t${SETTINGS_PATH}`))) return id;
  }
  return null;
}

const REVIEW_TIME = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/;
const isPositiveInteger = (value) => Number.isSafeInteger(value) && value >= 1;
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Why a decoded entry is not a review, or null. */
function reviewProblem(entry) {
  if (!isObject(entry)) return 'is not an object';
  if (!isPositiveInteger(entry.id)) return 'id is not a positive integer';
  if (entry.user !== null && entry.user !== undefined && !(isObject(entry.user) && isPositiveInteger(entry.user.id))) return 'user is neither null nor an object with a positive integer id';
  if (typeof entry.state !== 'string') return 'state is not text';
  if (entry.commit_id !== null && entry.commit_id !== undefined && typeof entry.commit_id !== 'string') return 'commit_id is neither null nor text';
  if (entry.state !== 'PENDING' && !(typeof entry.submitted_at === 'string' && REVIEW_TIME.test(entry.submitted_at))) return 'submitted_at is not a time like 2026-11-06T12:00:00Z';
  return null;
}

/**
 * The reviews of a pull request from the bytes of a file, as GitHub's REST API returns them (a list of reviews, or a list of pages).
 * Returns [{ id, user, state, commit, at }] with `user` the ID of the account or null. Throws Unreadable with the reason.
 */
export function readReviews(bytes) {
  return reviewsOf(decodeJson(bytes));
}

/** The one JSON document in some bytes. Throws Unreadable. */
function decodeJson(bytes) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  } catch {
    throw new Unreadable('is not one JSON document');
  }
}

/** The reviews of a decoded document: a list of reviews, or a list of pages. Throws Unreadable. */
function reviewsOf(document) {
  if (!Array.isArray(document)) throw new Unreadable('is not a list');
  const pages = document.map((item) => Array.isArray(item));
  if (pages.some(Boolean) && !pages.every(Boolean)) throw new Unreadable('mixes reviews and pages');
  return document.flat().map((entry, index) => {
    const problem = reviewProblem(entry);
    if (problem) throw new Unreadable(`entry ${index + 1}: ${problem}`);
    return { id: entry.id, user: entry.user ? entry.user.id : null, state: entry.state, commit: entry.commit_id ?? null, at: typeof entry.submitted_at === 'string' ? entry.submitted_at : null };
  });
}

/** How one owner counts: 'author' and 'approved' count; 'none', 'changes', 'dismissed', 'other' and 'earlier' do not. */
const MAX_CASE = 999_999_999;
const MAX_CASES = 1000;

/** The issues and pull requests that exist, from the JSON file `--cases`: { issue: [numbers], pull: [numbers] }. Throws Unreadable. */
export function readCases(bytes) {
  let document;
  try {
    document = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes));
  } catch {
    throw new Unreadable('is not one JSON document');
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document) || Object.keys(document).sort().join() !== 'issue,pull') {
    throw new Unreadable('is not an object with the keys issue and pull');
  }
  for (const kind of ['issue', 'pull']) {
    const list = document[kind];
    if (!Array.isArray(list) || list.length > MAX_CASES || !list.every((n) => Number.isSafeInteger(n) && n >= 1 && n <= MAX_CASE) || new Set(list).size !== list.length) {
      throw new Unreadable(`${kind}: is not a list of at most ${MAX_CASES} distinct numbers from 1 to ${MAX_CASE}`);
    }
  }
  return { issue: [...document.issue], pull: [...document.pull] };
}

/** The milliseconds of a UTC time written YYYY-MM-DDTHH:MM:SSZ, or null when the text is not one. */
export function readTime(text) {
  if (!REVIEW_TIME.test(text)) return null;
  const at = Date.parse(text);
  return Number.isNaN(at) || new Date(at).toISOString() !== `${text.slice(0, -1)}.000Z` ? null : at;
}

function howOwnerCounts(id, { head, author, reviews }) {
  if (id === author) return 'author';
  const decisive = reviews.filter((review) => review.user === id && review.state !== 'COMMENTED' && review.state !== 'PENDING');
  if (decisive.length === 0) return 'none';
  const newest = decisive.map((review) => review.at).sort().at(-1);
  const latest = decisive.filter((review) => review.at === newest);
  const states = new Set(latest.map((review) => review.state));
  if (states.has('CHANGES_REQUESTED')) return 'changes';
  if (states.has('DISMISSED')) return 'dismissed';
  if (states.size !== 1 || !states.has('APPROVED')) return 'other';
  return latest.every((review) => review.commit !== null && review.commit.toLowerCase() === head) ? 'approved' : 'earlier';
}

/**
 * Counts the owners that approve (docs/approvals.md): `owners` as the settings give them, `needed` approvals, the id of the `head`
 * commit, the `author` of the pull request and its `reviews`. Returns { have, needed, met, owners: [{ login, id, how }] }.
 */
export function countApprovals({ owners, needed, head, author, reviews }) {
  const counted = owners.map(({ login, id }) => ({ login, id, how: howOwnerCounts(id, { head, author, reviews }) }));
  const have = counted.filter(({ how }) => how === 'author' || how === 'approved').length;
  return { have, needed, met: have >= needed, owners: counted };
}

/** True when a change of settings is one that the amendment bar governs: other owners, or fewer approvals. */
function changesOwners(before, after) {
  const ids = (settings) => settings.owners.map(({ id }) => id).sort((a, b) => a - b).join(',');
  return ids(before) !== ids(after) || after.approvals < before.approvals;
}

const BAR_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The bar for an amendment (docs/amendments.md): every owner counts, and the last approval came at least seven days after `since`
 * (milliseconds; `now` stands for the approval of an author), unless `waived`. Returns { met: true, waived? } or { met: false, reason }.
 */
export function amendmentBar({ owners, head, author, reviews, since, now, waived }) {
  if (owners.length === 0) return { met: false, reason: 'no owners' };
  const counted = countApprovals({ owners, needed: owners.length, head, author, reviews });
  if (!counted.met) return { met: false, reason: `${counted.have} of ${owners.length} owners` };
  if (waived) return { met: true, waived: true };
  if (since === undefined) return { met: false, reason: 'no clock' };
  const times = owners.filter(({ id }) => id !== author).map(({ id }) => Date.parse(reviews.filter((review) => review.user === id && review.state !== 'COMMENTED' && review.state !== 'PENDING').map((review) => review.at).sort().at(-1)));
  const elapsed = (times.length > 0 ? Math.max(...times) : now) - since;
  if (elapsed < BAR_MS) return { met: false, reason: `${Math.floor(Math.max(0, elapsed) / 3_600_000)}h of 168h` };
  return { met: true };
}

/** True when an act is met: an act of the bar by `bars` (as checkChange returns them), any other by a met count of approvals. */
export const actApproved = (act, approval, bars = []) => (BAR_KINDS.has(act.kind)
  ? bars.some((bar) => bar.kind === act.kind && bar.path === act.path && bar.met)
  : approval !== null && approval.met);

// ---- the effects of the audit: docs/audit-effects.md ----------------------------------------------------------------------------

/**
 * The evidence for the acts of the history, from the bytes of the file `--evidence`: a Map from the full id of a commit to
 * { pull: null | { number, author, head, merged, mergedText }, started: milliseconds | null, reviews }. Throws Unreadable with the reason.
 */
export function readEvidence(bytes) {
  const document = decodeJson(bytes);
  if (!isObject(document)) throw new Unreadable('is not an object');
  const out = new Map();
  for (const key of Object.keys(document).sort(byBytes)) {
    if (!FULL_COMMIT_ID.test(key)) throw new Unreadable(`${printable(key)}: is not a full commit id`);
    const value = document[key];
    if (!isObject(value) || Object.keys(value).sort().join() !== 'pull,reviews,started') throw new Unreadable(`${key}: is not an object with the keys pull, reviews and started`);
    const entry = { pull: null, started: null, reviews: [] };
    const { pull } = value;
    if (pull !== null) {
      if (!isObject(pull)) throw new Unreadable(`${key}: pull: is not null or an object`);
      if (!isPositiveInteger(pull.number)) throw new Unreadable(`${key}: pull: number is not a positive integer`);
      if (pull.user !== null && pull.user !== undefined && !(isObject(pull.user) && isPositiveInteger(pull.user.id))) {
        throw new Unreadable(`${key}: pull: user is neither null nor an object with a positive integer id`);
      }
      if (!(isObject(pull.head) && typeof pull.head.sha === 'string' && FULL_COMMIT_ID.test(pull.head.sha))) throw new Unreadable(`${key}: pull: head.sha is not a full commit id`);
      const merged = typeof pull.merged_at === 'string' ? readTime(pull.merged_at) : null;
      if (merged === null) throw new Unreadable(`${key}: pull: merged_at is not a time like 2026-11-07T12:00:00Z`);
      entry.pull = { number: pull.number, author: pull.user ? pull.user.id : null, head: pull.head.sha, merged, mergedText: pull.merged_at };
    }
    if (value.started !== null) {
      const started = typeof value.started === 'string' ? readTime(value.started) : null;
      if (started === null) throw new Unreadable(`${key}: started: is neither null nor a time like 2026-11-07T12:00:00Z`);
      entry.started = started;
    }
    try {
      entry.reviews = reviewsOf(value.reviews);
    } catch (error) {
      if (error instanceof Unreadable) throw new Unreadable(`${key}: reviews: ${error.message}`);
      throw error;
    }
    out.set(key, entry);
  }
  return out;
}

/**
 * The issues of the repository from the bytes of the file `--issues`, as GitHub returns them (a list, or a list of pages); an entry
 * with a pull_request key is a pull request and is left out. Returns [{ number, state, title, body, user }]. Throws Unreadable.
 */
export function readIssues(bytes) {
  const document = decodeJson(bytes);
  if (!Array.isArray(document)) throw new Unreadable('is not a list');
  const pages = document.map((item) => Array.isArray(item));
  if (pages.some(Boolean) && !pages.every(Boolean)) throw new Unreadable('mixes issues and pages');
  const out = [];
  document.flat().forEach((entry, index) => {
    const at = `entry ${index + 1}: `;
    if (!isObject(entry)) throw new Unreadable(`${at}is not an object`);
    if (Object.hasOwn(entry, 'pull_request')) return;
    if (!isPositiveInteger(entry.number)) throw new Unreadable(`${at}number is not a positive integer`);
    if (entry.state !== 'open' && entry.state !== 'closed') throw new Unreadable(`${at}state is neither open nor closed`);
    if (typeof entry.title !== 'string') throw new Unreadable(`${at}title is not text`);
    if (entry.body !== null && entry.body !== undefined && typeof entry.body !== 'string') throw new Unreadable(`${at}body is neither null nor text`);
    if (entry.user !== null && entry.user !== undefined && !(isObject(entry.user) && typeof entry.user.login === 'string' && typeof entry.user.type === 'string')) {
      throw new Unreadable(`${at}user is neither null nor an object with the text login and type`);
    }
    out.push({ number: entry.number, state: entry.state, title: entry.title, body: entry.body ?? '', user: entry.user ? { login: entry.user.login, type: entry.user.type } : null });
  });
  return out;
}

const ruleText = (rule) => SETTINGS_RULES[rule] ?? FORMAT_RULES[rule] ?? COMMIT_RULES[rule] ?? CHANGE_RULES[rule] ?? AUDIT_RULES[rule];
const BOT_LOGIN = 'github-actions[bot]';
const BOT_TYPE = 'Bot';
const INCIDENT_KEY = '(?:[0-9]{4}|other|-):[A-Z]-[0-9]{2}';
const INCIDENT_MARKER = new RegExp(`^<!-- record-keeper:incident (${INCIDENT_KEY}) -->$`);
const INCIDENT_INTRO = 'The audit of the default branch found this. It is updated on every run and closed when the violation no longer stands. '
  + 'To resolve it: revert the commit, add an erratum to the record, or add a note to its Known deviations that names the commit.';
// For a record that says it is accepted and has no seal line at all: none of the three ways is its answer, its first seal is (docs/install.md, adopting with records that already exist).
const INCIDENT_FIRST_SEAL = 'A record that has never been sealed gets its first seal from `seal --adopt` in a pull request instead '
  + '([adopting with records that already exist](https://github.com/gearsnlevers/record-keeper/blob/main/docs/install.md#adopting-with-records-that-already-exist)); the audit closes this issue when the seals are merged.';
const INCIDENT_RESOLVED = 'No violation of this kind stands. Closed by the audit.';
const marker = (key) => `<!-- record-keeper:incident ${key} -->`;

/** The incident key of a violation: the number of its record (or `other`, or `-`), a colon and its rule. */
function incidentKey({ file, rule }) {
  return `${file === null ? '-' : RECORD_FILE.test(file) ? file.slice(0, 4) : 'other'}:${rule}`;
}

/** The key an issue belongs to, when the bot wrote it and its first line is the marker; null otherwise. */
function issueKey({ user, body }) {
  if (user === null || user.type !== BOT_TYPE || user.login !== BOT_LOGIN) return null;
  const first = body.split('\n')[0];
  const found = INCIDENT_MARKER.exec(first.endsWith('\r') ? first.slice(0, -1) : first);
  return found ? found[1] : null;
}

/** The detail of a violation as the plan shows it: none for a rule of the format (V-), whose detail the pages do not specify. */
const detailOf = ({ rule, detail }) => (rule.startsWith('V-') ? '' : detail);

/** Where a violation is, as `audit` prints it. */
const placeOf = ({ rule, file, line }, folder) => (rule.startsWith('S-') ? `${SETTINGS_PATH}${line ? `:${line}` : ''}` : file === null ? folder : `${folder}/${file}`);

/**
 * What to do with the incident issues, the log and the record of the run, from the result of `audit`, the issues of the repository
 * (readIssues) and the time of the run as text (docs/audit-effects.md). Returns { run, failed, issues, log }.
 */
export function planAudit(result, issues, now) {
  const incidents = new Map();
  for (const violation of result.violations) {
    const key = incidentKey(violation);
    incidents.set(key, [...(incidents.get(key) ?? []), violation]);
  }
  const trusted = new Map();
  for (const issue of issues) {
    const key = issueKey(issue);
    if (key !== null) trusted.set(key, [...(trusted.get(key) ?? []), issue]);
  }
  const keys = new Set(incidents.keys());
  for (const [key, group] of trusted) if (group.some(({ state }) => state === 'open')) keys.add(key);
  const line = (violation) => {
    const place = violation.kind === 'history' ? 'the history' : violation.kind === 'state' ? `the tip ${result.head}` : violation.commit;
    const detail = detailOf(violation);
    return `- ${place}: ${printable(placeOf(violation, result.folder))}: [${violation.rule}] ${ruleText(violation.rule)}${detail ? ` (${printable(detail)})` : ''}\n`;
  };
  const shown = (violation) => ({ commit: violation.commit, kind: violation.kind, file: violation.file, rule: violation.rule, detail: detailOf(violation) });
  const issuesOut = [];
  const log = [];
  const act = (action, key, number, title, text, extra, violations) => {
    issuesOut.push({ action, key, ...(number === undefined ? {} : { number }), ...(title === undefined ? {} : { title }), body: text });
    log.push({ at: now, event: { open: 'opened', reopen: 'reopened', update: 'changed', close: 'closed' }[action], key, ...extra, violations: violations.map(shown) });
  };
  for (const key of [...keys].sort(byBytes)) {
    const found = (trusted.get(key) ?? []).sort((a, b) => a.number - b.number);
    const open = found.filter(({ state }) => state === 'open');
    const violations = incidents.get(key);
    if (violations === undefined) {
      for (const issue of open) act('close', key, issue.number, undefined, `${marker(key)}\n${INCIDENT_RESOLVED}\n`, {}, []);
      continue;
    }
    const [subject, rule] = key.split(':');
    const title = `Records: ${subject === '-' ? 'the repository' : subject === 'other' ? 'other files' : subject}: [${rule}] ${ruleText(rule)}`;
    // The sentence is for a key whose every violation is a record with no seal (P-06, `no seal`); the intro stays whole, for a record that lost its seal in a change is still reverted or corrected.
    const unsealed = violations.every(({ rule, detail }) => rule === 'P-06' && detail === 'no seal');
    const text = `${marker(key)}\n${INCIDENT_INTRO}${unsealed ? ` ${INCIDENT_FIRST_SEAL}` : ''}\n\n${violations.map(line).join('')}`;
    if (found.length === 0) act('open', key, undefined, title, text, {}, violations);
    else if (open.length === 0) act('reopen', key, found[0].number, title, text, {}, violations);
    else {
      if (open[0].title !== title || open[0].body !== text) act('update', key, open[0].number, title, text, {}, violations);
      for (const duplicate of open.slice(1)) act('close', key, duplicate.number, undefined, `${marker(key)}\nDuplicate of #${open[0].number}.\n`, { duplicate: open[0].number }, []);
    }
  }
  return {
    run: { at: now, head: result.head, from: result.from, judged: result.judged, violations: result.violations.length, excused: result.excused.length },
    failed: result.violations.length !== 0,
    issues: issuesOut,
    log,
  };
}

// ---- announcements: docs/announcements.md -----------------------------------------------------------------------------------------------

/** The acts that are announced, in the order of the title of an announcement. `accept` is not one of them. */
const ANNOUNCED_KINDS = ['erratum', 'deviation', 'settings', 'owners', 'amendment', 'pin', 'workflow', 'code', 'instructions'];
const ANNOUNCEMENT_LIMIT = 20;
const ANNOUNCEMENT_ROOM = 40000;
const ANNOUNCEMENT_INTRO = 'The owners approved an act that is now on the default branch. The audit opens this issue once for each commit and does not change it. Close it when you have seen it.';
const ANNOUNCEMENT_MARKER = /^<!-- record-keeper:announcement ([0-9a-f]{40}|[0-9a-f]{64}) -->$/;
const LOGIN_FORM = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const ACCOUNT_ID = /^[1-9][0-9]{0,14}$/;

/**
 * The file `--logins`: the current login of an account (text) or null for an account that GitHub does not know, by the id of the account.
 * Returns a Map from the id (a number) to the login or null. Throws Unreadable.
 */
export function readLogins(bytes) {
  const document = decodeJson(bytes);
  if (!isObject(document)) throw new Unreadable('is not an object');
  const out = new Map();
  for (const key of Object.keys(document).sort(byBytes)) {
    if (!ACCOUNT_ID.test(key)) throw new Unreadable(`${printable(key)}: is not an id`);
    const value = document[key];
    if (value !== null && !(typeof value === 'string' && LOGIN_FORM.test(value))) throw new Unreadable(`${key}: is neither a login nor null`);
    out.set(Number(key), value);
  }
  return out;
}

/** The commit an issue announces, when the bot wrote it and its first line is the marker; null otherwise. */
function announcementKey({ user, body }) {
  if (user === null || user.type !== BOT_TYPE || user.login !== BOT_LOGIN) return null;
  const first = body.split('\n')[0];
  const found = ANNOUNCEMENT_MARKER.exec(first.endsWith('\r') ? first.slice(0, -1) : first);
  return found ? found[1] : null;
}

/** A diff as the issue shows it: control and format characters other than a line feed and a tab are written \u{...}. */
const shownDiff = (text) => text.replace(/[^\n\t -~]/gu, (character) => printable(character));

const joinAnd = (items) => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/**
 * What to announce, from the result of `audit` with evidence, the evidence (readEvidence), the issues (readIssues), the logins
 * (readLogins) and the time of the run as text. `facts` says what only git knows: parent(commit), accounts(revision) -> { owners,
 * witnesses } and diff(parent, commit, path) -> text. Returns { announcements, log, lookups }.
 */
export function planAnnouncements(result, evidence, issues, logins, now, facts) {
  const unapproved = [...result.violations, ...result.excused].filter(({ rule }) => rule === 'A-03');
  const approved = (act) => {
    const prefix = `${act.kind} ${act.path}: `;
    return !unapproved.some(({ commit, detail }) => commit === act.commit && (detail ?? '').startsWith(prefix));
  };
  const commits = [];
  const actsOf = new Map();
  for (const act of result.acts) {
    if (!ANNOUNCED_KINDS.includes(act.kind) || !approved(act)) continue;
    if (!actsOf.has(act.commit)) {
      commits.push(act.commit);
      actsOf.set(act.commit, []);
    }
    actsOf.get(act.commit).push(act);
  }
  const done = new Set(issues.map(announcementKey).filter((key) => key !== null));
  const announcements = [];
  const log = [];
  const lookups = new Set();
  for (const commit of commits.filter((key) => !done.has(key)).slice(0, ANNOUNCEMENT_LIMIT)) {
    const acts = actsOf.get(commit);
    const parent = facts.parent(commit);
    const before = facts.accounts(parent);
    const after = facts.accounts(commit);
    const loginOf = new Map();
    for (const group of [after.owners, after.witnesses, before.owners, before.witnesses]) for (const { login, id } of group) if (!loginOf.has(id)) loginOf.set(id, login);
    const ownerIds = [...new Set([...before.owners, ...after.owners].map(({ id }) => id))].sort((a, b) => a - b);
    const witnessIds = [...new Set([...before.witnesses, ...after.witnesses].map(({ id }) => id))].filter((id) => !ownerIds.includes(id)).sort((a, b) => a - b);
    for (const id of [...ownerIds, ...witnessIds]) if (!logins.has(id)) lookups.add(id);
    const told = [];
    const groups = [];
    for (const [ids, label] of [[ownerIds, 'owners'], [witnessIds, 'witnesses']]) {
      if (ids.length === 0) continue;
      const parts = ids.map((id) => {
        if (!logins.has(id)) return `${loginOf.get(id)}/${id} (not looked up)`;
        if (logins.get(id) === null) return `${loginOf.get(id)}/${id} (no longer an account)`;
        told.push(id);
        return `@${logins.get(id)}`;
      });
      groups.push(`${joinAnd(parts)} (${label})`);
    }
    const number = evidence.get(commit).pull.number;
    const kinds = ANNOUNCED_KINDS.filter((kind) => acts.some((act) => act.kind === kind));
    const lines = [`<!-- record-keeper:announcement ${commit} -->`, ANNOUNCEMENT_INTRO, '', `- Commit: ${commit}`, `- Pull request: #${number}`,
      `- Acts: ${acts.map((act) => `${act.kind} ${printable(act.path)}`).join(', ')}`, `- Told: ${groups.join(', ')}`];
    let room = ANNOUNCEMENT_ROOM;
    for (const act of acts) {
      lines.push('', `### ${act.kind} ${printable(act.path)}`, '');
      const rows = shownDiff(facts.diff(parent, commit, act.path)).split('\n');
      if (rows.at(-1) === '') rows.pop();
      if (rows.length === 0) {
        lines.push('No text changed; see the commit.');
        continue;
      }
      let used = 0;
      let taken = 0;
      for (const row of rows) {
        const size = Array.from(row).length + 1;
        if (used + size > room) break;
        used += size;
        taken += 1;
      }
      if (taken === 0) {
        lines.push('The room of this issue is used; see the commit.');
        room = 0;
        continue;
      }
      const longest = Math.max(0, ...(rows.slice(0, taken).join('\n').match(/`+/g) ?? []).map((run) => run.length));
      const fence = '`'.repeat(Math.max(3, longest + 1));
      lines.push(`${fence}diff`, ...rows.slice(0, taken), fence);
      if (taken < rows.length) {
        lines.push('', `... ${rows.length - taken} more lines; see the commit.`);
        room = 0;
      } else {
        room -= used;
      }
    }
    announcements.push({ key: commit, title: `Act: ${kinds.join(', ')} (#${number})`, body: `${lines.join('\n')}\n` });
    log.push({ at: now, event: 'announced', key: commit, acts: acts.map(({ kind, path }) => ({ kind, path })), told });
  }
  return { announcements, log, lookups: [...lookups].sort((a, b) => a - b) };
}

/** What `planAnnouncements` asks of git, for the repository at `repo`. */
function gitFacts(repo) {
  const text = (args) => runGit(['-C', repo, ...args]).toString('utf8');
  return {
    parent: (commit) => text(['rev-parse', `${commit}^1`]).trim(),
    accounts: (revision) => {
      const { owners, witnesses } = readSettings(openCommit(repo, revision)).settings;
      return { owners, witnesses };
    },
    diff: (parent, commit, filePath) => text(['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--no-renames', '--text', '--full-index', '--diff-algorithm=myers',
      '--src-prefix=a/', '--dst-prefix=b/', '--unified=3', parent, commit, '--', `:(literal)${filePath}`]),
  };
}

const USAGE = `Usage:
  record-keeper.mjs seal <file>             print the ${GENERATION} seal of a record
  record-keeper.mjs seal --verify <file>    check the seal: line of a record against its text
  record-keeper.mjs seal --adopt [folder] [--write]
                                            the first sealing of the records that existed before the kit (default docs/decisions):
                                            say which accepted or superseded records have no seal line and would get one; a dry run
                                            that writes nothing, unless --write adds the seal lines
  record-keeper.mjs validate [folder] [--extra-key <name>]... [--shared-folder <name>]
                                            check the format of the records in a folder (default docs/decisions)
  record-keeper.mjs validate --commit <revision> [--repo <path>] [folder] [--extra-key <name>]... [--shared-folder <name>]
                                            the same for the folder as it is in a commit of a git repository (default .),
                                            with the rules for what a commit can hold
  record-keeper.mjs validate --commit <revision> --settings-from <revision> [--repo <path>]
                                            the same, with the folder and the other settings taken from the settings file
                                            of the second commit (normally the base of a change)
  record-keeper.mjs config --commit <revision> [--repo <path>]
                                            print the settings of a commit and what is wrong with its settings file
  record-keeper.mjs check-pr --base <revision> --head <revision> [--repo <path>] [--reviews <file> --author <id>]
                             [--cases <file>] [--since <time>]
                                            judge the records folder of the head against the base, with the settings of the base;
                                            with the reviews of the pull request (a JSON file) and the ID of its author, also
                                            say whether the owners have approved the acts; with the issues and pull requests
                                            that exist (a JSON file) and the time the head was first seen (UTC, like
                                            2026-11-07T15:50:34Z), also judge the deviation notes and the 48 hours of an erratum
  record-keeper.mjs audit --head <revision> [--from <commit> | --adopted] [--since <commit>] [--repo <path>] [--evidence <file>] [--json]
                                            read the whole history up to the head and report what the rules say of it:
                                            the commits after --from and --since are judged one by one, and the tip as it is;
                                            --adopted starts at the commit that adopted the kit, --evidence (a JSON file) also
                                            judges the acts against the reviews, --json prints the result as JSON
  record-keeper.mjs audit-plan --head <revision> [--from <commit> | --adopted] [--since <commit>] [--repo <path>]
                               [--evidence <file>] --issues <file> --now <time>
                                            print as JSON what to do with the incident issues, the log and the record of the run
  record-keeper.mjs announce-plan --head <revision> --adopted [--repo <path>] --evidence <file> --issues <file> --logins <file> --now <time>
                                            print as JSON the issues to open for the acts that the owners approved, the lines for
                                            the log, and the ids of the accounts whose login has still to be looked up
  record-keeper.mjs needs --base <revision> --head <revision> [--repo <path>]
                                            print what the caller has to look up for check-pr: the cited issues and pull
                                            requests ("case issue 12") and "clock"
`;

function describeFailure(file, result) {
  switch (result.reason) {
    case 'rejected':
      return `${file}: rejected by ${result.rule}: ${RULES[result.rule]}\n`;
    case 'not-sealed':
      return `${file}: not sealed (there is no seal: key)\n`;
    case 'malformed':
      return `${file}: the seal is malformed (expected sha256-g1: and 64 lowercase hexadecimal digits)\n`;
    case 'unknown-generation':
      return `${file}: unknown generation ${result.generation} (this version knows ${GENERATION})\n`;
    default:
      return `${file}: the seal does not verify\n  stored:   ${result.stored}\n  computed: ${result.computed}\n`;
  }
}

const usageError = { code: 2, stdout: '', stderr: USAGE };

/** The clause that says what `seal --adopt` did or would do with a record. */
function adoptClause(result, writing) {
  switch (result.state) {
    case 'seal': return writing ? 'sealed' : 'would seal';
    case 'has-seal': return 'already has a seal';
    case 'skip': return `skipped (${printable(result.why)})`;
    default: return `cannot seal (${result.rule === null ? '' : `${result.rule}: `}${result.why})`;
  }
}

function runAdopt(args, writeFile) {
  const options = readOptions(args, [], ['--write']);
  if (!options || options.rest.length > 1) return usageError;
  const folder = options.rest[0] ?? 'docs/decisions';
  const writing = options.flags.has('--write');
  let results;
  try {
    results = adopt(folder);
  } catch (error) {
    if (error instanceof Unreadable) return { code: 2, stdout: '', stderr: `record-keeper: ${error.message}\n` };
    if (error?.code === undefined) throw error;
    return { code: 2, stdout: '', stderr: `record-keeper: cannot read ${printable(folder)}: ${printable(error.message)}\n` };
  }
  const lines = [];
  for (const result of results) {
    const where = printable(path.join(folder, result.name));
    if (writing && result.state === 'seal') {
      try {
        writeFile(path.join(folder, result.name), result.bytes);
      } catch (error) {
        return { code: 2, stdout: '', stderr: `${lines.join('')}record-keeper: cannot write ${where}: ${printable(error.message)}\n` };
      }
    }
    lines.push(`${where}: ${adoptClause(result, writing)}\n`);
  }
  const count = (state) => results.filter((result) => result.state === state).length;
  const [sealable, sealed, skipped, left] = ['seal', 'has-seal', 'skip', 'cannot'].map(count);
  const summary = `${printable(folder)}: ${sealable} ${writing ? 'sealed' : 'would be sealed'}, ${sealed} ${sealed === 1 ? 'has a seal' : 'have a seal'}, ${skipped} skipped, ${left} cannot be sealed\n`;
  const hint = !writing && sealable > 0 ? 'dry run: nothing was written; run it again with --write to add the seal lines\n' : '';
  return left === 0 ? { code: 0, stdout: lines.join('') + summary + hint, stderr: '' } : { code: 1, stdout: '', stderr: lines.join('') + summary + hint };
}

function runSeal(args, readFile, writeFile) {
  const adopting = args.indexOf('--adopt');
  if (adopting >= 0) return runAdopt(args.filter((_, at) => at !== adopting), writeFile);
  const verifying = args[0] === '--verify';
  if (verifying) args.shift();
  if (args.length !== 1 || args[0].startsWith('-')) return usageError;
  const [file] = args;
  let bytes;
  try {
    bytes = readFile(file);
  } catch (error) {
    return { code: 2, stdout: '', stderr: `record-keeper: cannot read ${file}: ${error.message}\n` };
  }
  if (verifying) {
    const result = verify(bytes);
    return result.ok
      ? { code: 0, stdout: `${file}: the seal verifies\n`, stderr: '' }
      : { code: 1, stdout: '', stderr: describeFailure(file, result) };
  }
  try {
    return { code: 0, stdout: `${seal(bytes)}\n`, stderr: '' };
  } catch (error) {
    if (!(error instanceof Reject)) throw error;
    return { code: 1, stdout: '', stderr: describeFailure(file, { reason: 'rejected', rule: error.rule }) };
  }
}

/** The options that take a value, read from `args`: { values: Map option -> [values], rest: arguments that are not options }, or null for wrong usage. */
function readOptions(args, names, flags = []) {
  const values = new Map();
  const given = new Set();
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i])) given.add(args[i]);
    else if (names.includes(args[i])) {
      const value = args[++i];
      if (value === undefined || value === '' || value.startsWith('-')) return null;
      values.set(args[i - 1], [...(values.get(args[i - 1]) ?? []), value]);
    } else if (args[i].startsWith('-')) return null;
    else rest.push(args[i]);
  }
  return { values, rest, flags: given };
}

const problemWord = (count) => `${count} problem${count === 1 ? '' : 's'}`;

/**
 * A text that came from the repository, made safe to print: a control character, a line or paragraph separator, a direction
 * control and a byte order mark are written as \u{hex}, so that a file name cannot start a line, a command of a log, or hide the end
 * of its own line.
 */
export function printable(text) {
  const unsafe = (code) => code === 0x09 || code === 0x0a || code === 0x0d || code === BOM || code >= 0xfffe && code <= 0xffff || inRanges(code, CONTROLS) || inRanges(code, SEPARATORS_AND_BIDI);
  return Array.from(String(text), (character) => (unsafe(character.codePointAt(0)) ? `\\u{${character.codePointAt(0).toString(16)}}` : character)).join('');
}

const settingLine = ({ file, line, rule, detail }) => `${file}${line === null ? '' : `:${line}`}: [${rule}] ${SETTINGS_RULES[rule]}${detail ? ` (${printable(detail)})` : ''}\n`;
const problemLine = (where, rule, detail) => `${printable(where)}: [${rule}] ${FORMAT_RULES[rule] ?? COMMIT_RULES[rule] ?? CHANGE_RULES[rule] ?? AUDIT_RULES[rule]}${detail ? ` (${printable(detail)})` : ''}\n`;

function runValidate(args) {
  const options = readOptions(args, ['--extra-key', '--shared-folder', '--commit', '--repo', '--settings-from']);
  if (!options || options.rest.length > 1) return usageError;
  const only = (name) => options.values.get(name)?.at(-1);
  const commit = only('--commit');
  const repo = only('--repo');
  const settingsFrom = only('--settings-from');
  let folder = options.rest[0];
  let settings = { extraKeys: options.values.get('--extra-key') ?? [], sharedFolder: only('--shared-folder') };
  if (repo !== undefined && commit === undefined) return usageError;
  if (settingsFrom !== undefined && (commit === undefined || folder !== undefined || settings.extraKeys.length > 0 || settings.sharedFolder !== undefined)) return usageError;
  let problems;
  let settingProblems = [];
  try {
    if (settingsFrom !== undefined) {
      const read = readSettings(openCommit(repo ?? '.', settingsFrom));
      ({ folder, ...settings } = read.settings);
      settingProblems = read.problems;
    }
    folder ??= 'docs/decisions';
    problems = commit === undefined ? validate(folder, settings) : validateCommit(repo ?? '.', commit, folder, settings);
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { code: 2, stdout: '', stderr: `record-keeper: ${error.message}\n` };
  }
  const where = (file) => (file === null ? folder : path.join(folder, file));
  const lines = [...settingProblems.map(settingLine), ...problems.map(({ file, rule, detail }) => problemLine(where(file), rule, detail))];
  const count = `${folder}: ${problemWord(lines.length)}\n`;
  return lines.length === 0 ? { code: 0, stdout: count, stderr: '' } : { code: 1, stdout: '', stderr: lines.join('') + count };
}

function runConfig(args) {
  const options = readOptions(args, ['--commit', '--repo']);
  if (!options || options.rest.length > 0 || !options.values.has('--commit')) return usageError;
  let read;
  try {
    read = readSettings(openCommit(options.values.get('--repo')?.at(-1) ?? '.', options.values.get('--commit').at(-1)));
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { code: 2, stdout: '', stderr: `record-keeper: ${error.message}\n` };
  }
  const { folder, sharedFolder, extraKeys, owners, approvals, witnesses, sharedChanges } = read.settings;
  const shown = `folder: ${folder}\nshared-folder: ${sharedFolder}\nextra-keys: [${extraKeys.join(', ')}]\nowners: [${owners.map(({ login, id }) => `${login}/${id}`).join(', ')}]\napprovals: ${approvals}\nwitnesses: [${witnesses.map(({ login, id }) => `${login}/${id}`).join(', ')}]\nshared-changes: ${sharedChanges}\n`;
  const count = `${SETTINGS_PATH}: ${problemWord(read.problems.length)}\n`;
  return read.problems.length === 0 ? { code: 0, stdout: shown + count, stderr: '' } : { code: 1, stdout: shown, stderr: read.problems.map(settingLine).join('') + count };
}

function runCheckPr(args, readFile, now) {
  const options = readOptions(args, ['--base', '--head', '--repo', '--reviews', '--author', '--cases', '--since']);
  if (!options || options.rest.length > 0 || !options.values.has('--base') || !options.values.has('--head')) return usageError;
  const only = (name) => options.values.get(name)?.at(-1);
  const reviewsFile = only('--reviews');
  const authorText = only('--author');
  if ((reviewsFile === undefined) !== (authorText === undefined) || (authorText !== undefined && !/^[1-9][0-9]{0,14}$/.test(authorText))) return usageError;
  let given = { now };
  const sinceText = only('--since');
  if (sinceText !== undefined) {
    const since = readTime(sinceText);
    if (since === null) return usageError;
    given.since = since;
  }
  const casesFile = only('--cases');
  if (casesFile !== undefined) {
    let bytes;
    try {
      bytes = readFile(casesFile);
    } catch (error) {
      return { code: 2, stdout: '', stderr: `record-keeper: cannot read ${printable(casesFile)}: ${printable(error.message)}\n` };
    }
    try {
      given.cases = readCases(bytes);
    } catch (error) {
      if (!(error instanceof Unreadable)) throw error;
      return { code: 2, stdout: '', stderr: `record-keeper: ${printable(casesFile)}: ${error.message}\n` };
    }
  }
  if (reviewsFile !== undefined) {
    let bytes;
    try {
      bytes = readFile(reviewsFile);
    } catch (error) {
      return { code: 2, stdout: '', stderr: `record-keeper: cannot read ${printable(reviewsFile)}: ${printable(error.message)}\n` };
    }
    try {
      given = { ...given, author: Number(authorText), reviews: readReviews(bytes) };
    } catch (error) {
      if (!(error instanceof Unreadable)) throw error;
      return { code: 2, stdout: '', stderr: `record-keeper: ${printable(reviewsFile)}: ${error.message}\n` };
    }
  }
  let result;
  try {
    result = checkChange(only('--repo') ?? '.', only('--base'), only('--head'), given);
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { code: 2, stdout: '', stderr: `record-keeper: ${error.message}\n` };
  }
  const { folder, settings, problems, acts, approval, bars } = result;
  const where = (file) => (file === null ? folder : path.join(folder, file));
  const lines = [
    ...settings.map(settingLine),
    ...problems.map(({ file, rule, detail }) => problemLine(where(file), rule, detail)),
  ];
  const unmet = acts.filter((act) => !actApproved(act, approval, bars));
  const actLines = unmet.map(({ kind, path: actPath }) => (BAR_KINDS.has(kind)
    ? `${printable(actPath)}: needs the amendment bar (${kind}): ${bars.find((bar) => bar.kind === kind && bar.path === actPath).reason}\n`
    : `${printable(actPath)}: needs the owners' approval (${kind})\n`));
  const waiverLines = bars.filter((bar) => bar.met && bar.waived).map((bar) => `${printable(bar.path)}: the seven days were waived by the record (emergency)\n`);
  const owners = approval?.owners.map(({ login, id, how }) => `${printable(login)}/${id}: ${how}`).join(', ');
  const approvalLine = approval && acts.length > 0 ? `approvals: ${approval.have} of ${approval.needed} (${owners === '' ? 'no owners' : owners})\n` : '';
  const count = `${folder}: ${problemWord(lines.length)}${acts.length > 0 ? `, ${acts.length} act${acts.length === 1 ? '' : 's'}${unmet.length === 0 ? ' approved' : ''}` : ''}\n`;
  if (lines.length === 0 && unmet.length === 0) return { code: 0, stdout: approvalLine + waiverLines.join('') + count, stderr: '' };
  return { code: 1, stdout: '', stderr: lines.join('') + actLines.join('') + approvalLine + waiverLines.join('') + count };
}

function runNeeds(args) {
  const options = readOptions(args, ['--base', '--head', '--repo']);
  if (!options || options.rest.length > 0 || !options.values.has('--base') || !options.values.has('--head')) return usageError;
  const only = (name) => options.values.get(name)?.at(-1);
  let result;
  try {
    result = checkChange(only('--repo') ?? '.', only('--base'), only('--head'));
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { code: 2, stdout: '', stderr: `record-keeper: ${error.message}\n` };
  }
  const lines = result.needs.cases.map(({ kind, number }) => `case ${kind} ${number}\n`);
  if (result.needs.clock) lines.push('clock\n');
  return { code: 0, stdout: lines.join(''), stderr: '' };
}

/** The input of an audit from its options: the id the audit starts from and the evidence, or an error result. */
function auditInput(options, readFile) {
  const only = (name) => options.values.get(name)?.at(-1);
  let evidence;
  const evidenceFile = only('--evidence');
  if (evidenceFile !== undefined) {
    const read = readInput(evidenceFile, readFile, readEvidence);
    if (read.error) return read;
    evidence = read.value;
  }
  return { evidence };
}

/** Reads a file and decodes it with `decode`: { value } or { error } with the result of the command. */
function readInput(file, readFile, decode) {
  let bytes;
  try {
    bytes = readFile(file);
  } catch (error) {
    return { error: { code: 2, stdout: '', stderr: `record-keeper: cannot read ${printable(file)}: ${printable(error.message)}\n` } };
  }
  try {
    return { value: decode(bytes) };
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { error: { code: 2, stdout: '', stderr: `record-keeper: ${printable(file)}: ${error.message}\n` } };
  }
}

/** The id an audit starts from: the one of --from, or with --adopted the commit that adopted the kit. Throws Unreadable. */
function startOf(options) {
  const only = (name) => options.values.get(name)?.at(-1);
  if (!options.flags.has('--adopted')) return only('--from');
  const adopted = findAdoption(only('--repo') ?? '.', only('--head'));
  if (adopted === null) throw new Unreadable(`no commit of the history holds ${SETTINGS_PATH}`);
  return adopted;
}

function runAudit(args, readFile) {
  const options = readOptions(args, ['--head', '--from', '--since', '--repo', '--evidence'], ['--adopted', '--json']);
  if (!options || options.rest.length > 0 || !options.values.has('--head')) return usageError;
  const only = (name) => options.values.get(name)?.at(-1);
  for (const name of ['--from', '--since']) if (only(name) !== undefined && !FULL_COMMIT_ID.test(only(name))) return usageError;
  if (options.flags.has('--adopted') && only('--from') !== undefined) return usageError;
  const input = auditInput(options, readFile);
  if (input.error) return input.error;
  let result;
  try {
    result = audit(only('--repo') ?? '.', only('--head'), { from: startOf(options), since: only('--since'), evidence: input.evidence });
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { code: 2, stdout: '', stderr: `record-keeper: ${error.message}\n` };
  }
  if (options.flags.has('--json')) return { code: 0, stdout: `${JSON.stringify(result)}\n`, stderr: '' };
  const place = ({ kind, commit }) => (kind === 'history' ? 'history' : kind === 'state' ? 'tip' : commit.slice(0, 12));
  const lines = result.violations.map((violation) => `${place(violation)}: ${printable(placeOf(violation, result.folder))}: [${violation.rule}] ${ruleText(violation.rule)}${violation.detail ? ` (${printable(violation.detail)})` : ''}\n`);
  const count = `audit: ${result.violations.length} violation${result.violations.length === 1 ? '' : 's'}, ${result.excused.length} excused, ${result.judged} commit${result.judged === 1 ? '' : 's'} judged\n`;
  return result.violations.length === 0 ? { code: 0, stdout: count, stderr: '' } : { code: 1, stdout: '', stderr: lines.join('') + count };
}

function runAuditPlan(args, readFile) {
  const options = readOptions(args, ['--head', '--from', '--since', '--repo', '--evidence', '--issues', '--now'], ['--adopted']);
  if (!options || options.rest.length > 0 || !['--head', '--issues', '--now'].every((name) => options.values.has(name))) return usageError;
  const only = (name) => options.values.get(name)?.at(-1);
  for (const name of ['--from', '--since']) if (only(name) !== undefined && !FULL_COMMIT_ID.test(only(name))) return usageError;
  if (options.flags.has('--adopted') && only('--from') !== undefined) return usageError;
  if (readTime(only('--now')) === null) return usageError;
  const input = auditInput(options, readFile);
  if (input.error) return input.error;
  const issues = readInput(only('--issues'), readFile, readIssues);
  if (issues.error) return issues.error;
  let result;
  try {
    result = audit(only('--repo') ?? '.', only('--head'), { from: startOf(options), since: only('--since'), evidence: input.evidence });
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { code: 2, stdout: '', stderr: `record-keeper: ${error.message}\n` };
  }
  return { code: 0, stdout: `${JSON.stringify(planAudit(result, issues.value, only('--now')))}\n`, stderr: '' };
}

function runAnnouncePlan(args, readFile) {
  const options = readOptions(args, ['--head', '--repo', '--evidence', '--issues', '--logins', '--now'], ['--adopted']);
  if (!options || options.rest.length > 0 || !options.flags.has('--adopted') || !['--head', '--evidence', '--issues', '--logins', '--now'].every((name) => options.values.has(name))) return usageError;
  const only = (name) => options.values.get(name)?.at(-1);
  if (readTime(only('--now')) === null) return usageError;
  const input = auditInput(options, readFile);
  if (input.error) return input.error;
  const issues = readInput(only('--issues'), readFile, readIssues);
  if (issues.error) return issues.error;
  const logins = readInput(only('--logins'), readFile, readLogins);
  if (logins.error) return logins.error;
  const repo = only('--repo') ?? '.';
  let result;
  try {
    result = audit(repo, only('--head'), { from: startOf(options), evidence: input.evidence });
  } catch (error) {
    if (!(error instanceof Unreadable)) throw error;
    return { code: 2, stdout: '', stderr: `record-keeper: ${error.message}\n` };
  }
  return { code: 0, stdout: `${JSON.stringify(planAnnouncements(result, input.evidence, issues.value, logins.value, only('--now'), gitFacts(repo)))}\n`, stderr: '' };
}

/** The command line, without the process around it. Returns { code, stdout, stderr }. */
export function run(argv, { readFile = fs.readFileSync, now = Date.now, writeFile = fs.writeFileSync } = {}) {
  const args = [...argv];
  if (args[0] === '--help' || args[0] === '-h') return { code: 0, stdout: USAGE, stderr: '' };
  const command = args.shift();
  if (command === 'seal') return runSeal(args, readFile, writeFile);
  if (command === 'validate') return runValidate(args);
  if (command === 'config') return runConfig(args);
  if (command === 'check-pr') return runCheckPr(args, readFile, now());
  if (command === 'needs') return runNeeds(args);
  if (command === 'audit') return runAudit(args, readFile);
  if (command === 'audit-plan') return runAuditPlan(args, readFile);
  if (command === 'announce-plan') return runAnnouncePlan(args, readFile);
  return usageError;
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
  const { code, stdout, stderr } = run(process.argv.slice(2));
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  process.exitCode = code;
}
