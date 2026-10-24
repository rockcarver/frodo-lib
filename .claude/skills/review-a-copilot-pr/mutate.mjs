#!/usr/bin/env node
// Mutation check for the tests a pull request adds. Run it from the repository
// root, on the pull request's checkout, with a spec file that lives OUTSIDE the
// repository:
//
//   node .claude/skills/review-a-copilot-pr/mutate.mjs /path/to/spec.json
//
// spec.json:
//   {
//     "test": "npm run test:only -- src/utils/AsyncUtils.test.ts",
//     "mutations": [
//       { "name": "always call fn", "file": "src/utils/AsyncUtils.ts",
//         "old": "if (!inFlight) {", "new": "if (true) {" }
//     ]
//   }
//
// The baseline must pass. Each mutation is applied alone, the test command runs,
// and the file is put back, also on Ctrl-C and on errors (afterwards `git diff`
// of those files is compared with what it was before). A mutation that leaves
// the test green "survived": the tests do not pin that behaviour. Exits 1 when a
// mutation survived, 2 when the spec or the baseline is bad, 0 otherwise.
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';

const specPath = process.argv[2];
if (!specPath) {
  console.error('usage: node mutate.mjs <spec.json>');
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const passes = () =>
  new Promise((resolve) => {
    const child = spawn(spec.test, { shell: true, stdio: 'ignore' });
    child.on('exit', (code) => resolve(code === 0));
  });

// What git says about the files before we touch them, to compare afterwards.
const files = [...new Set(spec.mutations.map((m) => m.file))].join(' ');
const gitDiff = () =>
  files ? execSync(`git diff -- ${files}`, { encoding: 'utf8' }) : '';
const diffBefore = gitDiff();

const originals = new Map();
const restore = () => {
  for (const [file, text] of originals) fs.writeFileSync(file, text);
};
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});

let survived = 0;
let bad = '';
try {
  if (!(await passes())) bad = 'The baseline run fails: fix that first.';
  for (const m of bad ? [] : spec.mutations) {
    const text = originals.get(m.file) ?? fs.readFileSync(m.file, 'utf8');
    originals.set(m.file, text);
    const parts = text.split(m.old);
    if (parts.length !== 2) {
      bad = `${m.name}: "old" must occur exactly once in ${m.file}`;
      break;
    }
    fs.writeFileSync(m.file, parts.join(m.new));
    const green = await passes();
    fs.writeFileSync(m.file, text);
    console.log(`${green ? 'SURVIVED' : 'killed  '}  ${m.name}`);
    if (green) survived++;
  }
} finally {
  restore();
}

if (bad) {
  console.error(bad);
  process.exit(2);
}
if (gitDiff() !== diffBefore) {
  console.error('A mutated file is not as it was: check git diff.');
}
console.log(`${spec.mutations.length - survived} killed, ${survived} survived`);
process.exit(survived ? 1 : 0);
