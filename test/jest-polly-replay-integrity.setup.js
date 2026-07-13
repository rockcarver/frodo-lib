/*
 * Polly replay integrity guard for Jest.
 *
 * Why this exists:
 * - Some tests can pass while Polly logs missing recording errors to console.
 * - That creates a "soft-green" result where replay coverage is incomplete.
 *
 * What this does:
 * - In replay mode, intercept console.error output for each test.
 * - Detect Polly missing-recording messages.
 * - Fail the current test in afterEach when any missing recording is detected.
 *
 * Notes:
 * - This check is intentionally scoped to replay mode only.
 * - Recording mode is excluded so test recording workflows remain unaffected.
 */
const MISSING_RECORDING_TEXT =
  'Recording for the following request is not found and `recordIfMissing` is `false`.';

const isReplayMode =
  !process.env.FRODO_POLLY_MODE || process.env.FRODO_POLLY_MODE === 'replay';

const pollyReplayMisses = [];
let consoleErrorSpy;
const originalConsoleError = console.error.bind(console);

function formatArg(arg) {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack || arg.message;
  try {
    return JSON.stringify(arg);
  } catch (_error) {
    return String(arg);
  }
}

beforeEach(() => {
  pollyReplayMisses.length = 0;
  if (!isReplayMode) return;

  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    const message = args.map(formatArg).join(' ');
    if (
      message.includes('PollyError') &&
      message.includes(MISSING_RECORDING_TEXT)
    ) {
      pollyReplayMisses.push(message);
    }
    originalConsoleError(...args);
  });
});

afterEach(() => {
  if (consoleErrorSpy) {
    consoleErrorSpy.mockRestore();
    consoleErrorSpy = undefined;
  }

  if (!isReplayMode || pollyReplayMisses.length === 0) return;

  const maxExamples = 3;
  const examples = pollyReplayMisses
    .slice(0, maxExamples)
    .map((entry, index) => `  ${index + 1}. ${entry}`)
    .join('\n');

  throw new Error(
    `Polly replay integrity check failed: detected ${pollyReplayMisses.length} missing recording request(s).\n` +
      `First ${Math.min(pollyReplayMisses.length, maxExamples)} example(s):\n${examples}`
  );
});
