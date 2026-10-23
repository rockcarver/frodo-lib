/**
 * Best-effort detection of a terminal's actual background color via OSC 11
 * (`ESC ] 11 ; ? BEL`, terminal replies `ESC ] 11 ; rgb:RRRR/GGGG/BBBB`).
 *
 * Support is real but inconsistent: well-supported in iTerm2, Kitty,
 * WezTerm, Alacritty, and VTE-based terminals (gnome-terminal); flaky or
 * absent over tmux (which caches the response until the client reattaches)
 * and skipped on Windows to avoid changing console input mode; and simply
 * silent forever on a terminal that doesn't implement it at all -- which
 * is why this always races the response against a short timeout rather than
 * waiting indefinitely, and
 * always restores the terminal's raw mode on both the success and timeout
 * paths.
 *
 * Modeled closely on the equivalent query in the `os-theme` package (MIT,
 * https://www.npmjs.com/package/os-theme), which solves the same raw-mode/
 * timeout/cleanup mechanics correctly -- reimplemented locally rather than
 * taken as a dependency because that package's public API only returns a
 * collapsed dark/light classification, discarding the parsed RGB before it
 * ever leaves the module; this needs the actual RGB to tell a plain white
 * background apart from a colored one (e.g. a light blue terminal), which
 * a dark/light-only signal can't do.
 */

import { closeSync, openSync } from 'node:fs';
import { isatty, ReadStream } from 'node:tty';
import type { Rgb } from './TerminalContrast';

const ESC = '\x1b';
const BEL = '\x07';
const OSC_11_QUERY = `${ESC}]11;?${BEL}`;
// Response is ST- or BEL-terminated: ESC ] 11 ; rgb:RRRR/GGGG/BBBB (BEL|ST).
// The control character is the point -- this matches a real terminal
// escape-sequence response, not user input.
const OSC_11_PATTERN =
  '\\x1b\\]11;rgb:([0-9a-fA-F]+)/([0-9a-fA-F]+)/([0-9a-fA-F]+)';
const OSC_11_REGEX = new RegExp(OSC_11_PATTERN);

function hexChannelTo8Bit(hex: string): number {
  // Each channel is 1-4 hex digits representing an 8-16 bit value --
  // normalize to 0-255 regardless of how many digits the terminal sent.
  const maxVal = (1 << (hex.length * 4)) - 1;
  return Math.round((parseInt(hex, 16) / maxVal) * 255);
}

/**
 * Queries the terminal's actual background color via OSC 11. Resolves
 * `null` immediately, with no query attempted, on Windows or when
 * stdin/stdout aren't a TTY (piped/scripted/CI usage) -- and resolves `null`
 * after a short timeout if the terminal never responds (unsupported terminal,
 * or a multiplexer/SSH chain that swallows the query).
 */
export function detectTerminalBackgroundRgb(): Promise<Rgb | null> {
  // Even accessing process.stdin initializes fd 0 in non-blocking mode.
  // Windows cannot restore an existing console input mode via public Node APIs.
  if (process.platform === 'win32' || !isatty(0) || !isatty(1)) {
    return Promise.resolve(null);
  }
  // Reading from process.stdin makes fd 0 non-blocking, even after pause(),
  // breaking later synchronous prompts. Use a separately opened terminal.
  let fd: number;
  let input: ReadStream;
  try {
    fd = openSync('/dev/tty', 'r');
    input = new ReadStream(fd);
  } catch {
    if (fd !== undefined) closeSync(fd);
    return Promise.resolve(null);
  }
  // On POSIX, libuv reopens the terminal; the stream owns only that new fd.
  closeSync(fd);
  return new Promise((resolve) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      input.off('data', onData);
      input.setRawMode(false);
      input.destroy();
    };

    const settle = (result: Rgb | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onData = (data: Buffer) => {
      const match = data.toString().match(OSC_11_REGEX);
      if (match) {
        settle([
          hexChannelTo8Bit(match[1]),
          hexChannelTo8Bit(match[2]),
          hexChannelTo8Bit(match[3]),
        ]);
      }
    };

    const timeout = setTimeout(() => settle(null), 500);

    input.on('error', () => settle(null));
    try {
      input.setRawMode(true);
      input.on('data', onData);
      input.resume();
      process.stdout.write(OSC_11_QUERY);
    } catch {
      settle(null);
    }
  });
}

export type BackgroundPreset = {
  /** Matches a `ThemeConfig.ts` bundled theme definition's `name`. */
  themeName: string;
  referenceRgb: Rgb;
};

function distance(a: Rgb, b: Rgb): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  );
}

/**
 * Matches a detected background RGB against a fixed set of named presets by
 * simple RGB-space nearest-neighbor, falling back to `fallbackDark`/
 * `fallbackLight` (chosen by relative luminance) when nothing is close
 * enough to be a confident match. `maxDistance` (0-441.7, the diagonal of
 * the RGB cube) defaults to a fairly tight radius -- this is meant to catch
 * "this terminal is unmistakably that preset's color", not to force every
 * detected background into the nearest bucket regardless of how far off it
 * actually is.
 */
export function matchBackgroundPreset(
  detectedRgb: Rgb,
  presets: BackgroundPreset[],
  fallbackDark: string,
  fallbackLight: string,
  maxDistance = 60
): string {
  let best: BackgroundPreset | null = null;
  let bestDistance = Infinity;
  for (const preset of presets) {
    const d = distance(detectedRgb, preset.referenceRgb);
    if (d < bestDistance) {
      bestDistance = d;
      best = preset;
    }
  }
  if (best && bestDistance <= maxDistance) {
    return best.themeName;
  }
  const [r, g, b] = detectedRgb;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.5 ? fallbackDark : fallbackLight;
}
