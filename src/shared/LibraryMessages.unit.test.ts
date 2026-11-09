/**
 * The library states facts. What to do about them is advice in the words of
 * one interface, and the library does not know which interface calls it: the
 * command line, the shell, an MCP host or an application each have their own
 * options, commands and settings. A message that says "pass --password" is
 * wrong for every caller but one (core 0001: anything tied to one interface
 * lives in that interface).
 *
 * This test reads the source of the library and fails for a message that
 *
 * - names a command line option (`--password`),
 * - names a command of the frodo command line in quotes (`'frodo login'`),
 * - names an environment variable of the frodo command line (`FRODO_*`),
 * - tells the reader to use "verbose" output or mode, or
 * - points to a document file (`*.md`), which the caller may not have.
 *
 * "Message" means the text of an error that is thrown, or of anything printed
 * through `printMessage`, `verboseMessage`, `debugMessage` or the progress
 * indicators. When a caller needs to give advice, the error carries a stable
 * code (`FrodoError.code`) and the caller maps the code to its own words.
 *
 * Not scanned: tests; `src/mcp`, which is an interface of its own and words its
 * own advice; `src/ext`, which wraps a third-party helper; and the tooling
 * that records and replays traffic for the tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..');

const NOT_SCANNED = [
  /\.test\.ts$/,
  /\.d\.ts$/,
  /^mcp\//,
  /^ext\//,
  /^utils\/SetupPollyForFrodoLib\.ts$/,
];

/** What a message of the library must not contain. */
const FORBIDDEN: { what: string; pattern: RegExp }[] = [
  {
    what: 'a command line option',
    pattern: /(^|[\s'"`(\[,/])--[a-z][a-z0-9]*(-[a-z0-9]+)*/,
  },
  {
    what: 'a command of the frodo command line',
    // as a message writes a command: in quotes or backticks ('frodo login'), not "a frodo process"
    pattern: /['"`]frodo [a-z][a-z-]*/,
  },
  {
    what: 'an environment variable of the frodo command line',
    pattern: /\bFRODO_[A-Z0-9_]+\b/,
  },
  {
    what: 'verbose output or mode',
    pattern: /\bverbose (output|mode|logging)\b/i,
  },
  { what: 'a document file', pattern: /\b[A-Za-z0-9_-]+\.md\b/ },
];

const MESSAGE_CALLS =
  /(printMessage|verboseMessage|debugMessage|printError|createProgressIndicator|updateProgressIndicator|stopProgressIndicator)$/;

export type MessageFinding = {
  line: number;
  what: string;
  text: string;
};

/**
 * The messages of one source file that name something of one interface.
 * @param source the TypeScript source
 * @returns what is wrong, with the line
 */
export function interfaceTermsInMessages(source: string): MessageFinding[] {
  const sourceFile = ts.createSourceFile(
    'scanned.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const findings: MessageFinding[] = [];

  const isMessage = (node: ts.Node): boolean => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (
        ts.isNewExpression(parent) &&
        parent.expression.getText(sourceFile) === 'FrodoError'
      ) {
        return true;
      }
      if (
        ts.isCallExpression(parent) &&
        MESSAGE_CALLS.test(parent.expression.getText(sourceFile))
      ) {
        return true;
      }
      if (
        ts.isPropertyAssignment(parent) &&
        parent.name.getText(sourceFile) === 'message'
      ) {
        return true;
      }
    }
    return false;
  };

  const visit = (node: ts.Node) => {
    const text =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
        ? node.text
        : undefined;
    if (text !== undefined && isMessage(node)) {
      for (const { what, pattern } of FORBIDDEN) {
        if (pattern.test(text)) {
          findings.push({
            line:
              sourceFile.getLineAndCharacterOfPosition(node.getStart()).line +
              1,
            what,
            text: text.replace(/\s+/g, ' ').slice(0, 120),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

function sourcesToScan(dir = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourcesToScan(full);
    const relative = path.relative(SRC, full).split(path.sep).join('/');
    return /\.ts$/.test(entry.name) &&
      !NOT_SCANNED.some((pattern) => pattern.test(relative))
      ? [full]
      : [];
  });
}

describe('The messages of the library name nothing of one interface', () => {
  test('1: No message names an option, a command, an environment variable, verbose output or a document', () => {
    const problems = sourcesToScan().flatMap((file) =>
      interfaceTermsInMessages(fs.readFileSync(file, 'utf8')).map(
        (finding) =>
          `${path.relative(SRC, file)}:${finding.line} names ${finding.what}: ${finding.text}`
      )
    );
    expect(problems).toEqual([]);
  });

  test('2: The scan covers the library', () => {
    const files = sourcesToScan().map((file) =>
      path.relative(SRC, file).split(path.sep).join('/')
    );
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('ops/AuthenticateOps.ts');
    expect(files).toContain('ops/JourneyOps.ts');
    expect(files).not.toContain('mcp/ToolRuntime.ts');
  });
});

describe('interfaceTermsInMessages', () => {
  const found = (source: string) =>
    interfaceTermsInMessages(source).map((finding) => finding.what);

  test('3: Finds an option in a thrown error', () => {
    expect(
      found("throw new FrodoError('No password. Provide --password.');")
    ).toEqual(['a command line option']);
  });

  test('4: Finds an option in a template with a substitution, in both parts', () => {
    expect(
      found('throw new FrodoError(`${a} needs --type or ${b} needs --name`);')
    ).toEqual(['a command line option', 'a command line option']);
  });

  test('5: Finds an option in a printed message, however it is passed', () => {
    expect(found("printMessage('Use --verbose to see more.');")).toEqual([
      'a command line option',
    ]);
    expect(
      found("verboseMessage({ message: 'Use --verbose.', state });")
    ).toEqual(['a command line option']);
    expect(found("const m = { message: 'Use --verbose.' };")).toEqual([
      'a command line option',
    ]);
  });

  test('6: Finds a command, an environment variable, verbose output and a document', () => {
    expect(
      found('throw new FrodoError("Run \'frodo login\' first.");')
    ).toEqual(['a command of the frodo command line']);
    expect(found("throw new FrodoError('Set FRODO_HOST.');")).toEqual([
      'an environment variable of the frodo command line',
    ]);
    expect(found("printMessage('Use verbose output to list them.');")).toEqual([
      'verbose output or mode',
    ]);
    expect(found("throw new FrodoError('See BROWSER_LOGIN.md.');")).toEqual([
      'a document file',
    ]);
  });

  test('7: Reports the line', () => {
    expect(
      interfaceTermsInMessages(
        "const a = 1;\nconst b = 2;\nthrow new FrodoError('Pass --type.');"
      ).map((finding) => finding.line)
    ).toEqual([3]);
  });

  test('8: Leaves facts, dashes and text that is not a message alone', () => {
    expect(
      found(
        [
          "throw new FrodoError('No stored password found for username x.');",
          "printMessage('Exported 3 of 4 journeys -- one failed.');",
          "printMessage('a--b and -- alone and --- rule');",
          "const flag = '--password';",
          "const env = process.env['FRODO_HOST'];",
          "const url = 'https://example.com/frodo-lib/README.md';",
          "throw new FrodoError('The frodo-lib package is out of date.');",
          "throw new FrodoError('If no other frodo process is running, delete the lock file.');",
        ].join('\n')
      )
    ).toEqual([]);
  });
});
