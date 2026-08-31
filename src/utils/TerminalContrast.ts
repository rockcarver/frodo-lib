/**
 * Objective readability filtering for the standard 16-color ANSI palette.
 *
 * Terminal color schemes are user-configurable, so there's no single true
 * RGB value for e.g. "red" across every terminal emulator -- the table below
 * is the conventional xterm default palette, used here as a representative
 * reference for building a sane default theme, not a live guarantee for any
 * specific user's actual terminal colors.
 *
 * The contrast math is the standard WCAG 2 relative-luminance/contrast-ratio
 * formula (the same one used to judge foreground/background text contrast
 * on the web), applied here to terminal foreground colors against a plain
 * black or white background -- giving a computed, reviewable answer to
 * "is this color readable on this background" instead of eyeballing it.
 */

export type AnsiColorName =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'blackBright'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright';

export type Rgb = [number, number, number];

export type TerminalBackground = 'black' | 'white';

// Conventional xterm default 16-color palette.
const ANSI_16_REFERENCE_RGB: Record<AnsiColorName, Rgb> = {
  black: [0, 0, 0],
  red: [205, 0, 0],
  green: [0, 205, 0],
  yellow: [205, 205, 0],
  blue: [0, 0, 238],
  magenta: [205, 0, 205],
  cyan: [0, 205, 205],
  white: [229, 229, 229],
  blackBright: [127, 127, 127],
  redBright: [255, 0, 0],
  greenBright: [0, 255, 0],
  yellowBright: [255, 255, 0],
  blueBright: [92, 92, 255],
  magentaBright: [255, 0, 255],
  cyanBright: [0, 255, 255],
  whiteBright: [255, 255, 255],
};

const BACKGROUND_RGB: Record<TerminalBackground, Rgb> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
};

function srgbChannelToLinear(channel8Bit: number): number {
  const channel = channel8Bit / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [rl, gl, bl] = [r, g, b].map(srgbChannelToLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/**
 * WCAG 2 contrast ratio between two colors, from 1 (no contrast) to 21
 * (black on white or vice versa).
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Filters the standard 16-color ANSI palette down to the colors that meet a
 * minimum WCAG contrast ratio against a background. Default minimum is 4.5,
 * WCAG AA's threshold for normal-sized text.
 *
 * `background` accepts either the plain `'black'`/`'white'` reference
 * (the two extremes every built-in theme is checked against) or an
 * arbitrary RGB triple -- needed for theme presets tuned to a real,
 * non-black/non-white terminal background (e.g. a detected or named
 * background-color preset), where contrast has to be checked against that
 * background's actual color, not just its nearest black/white extreme.
 */
export class TerminalContrastFilter {
  private readonly backgroundRgb: Rgb;
  private readonly minRatio: number;

  constructor(background: TerminalBackground | Rgb, minRatio = 4.5) {
    this.backgroundRgb = Array.isArray(background)
      ? background
      : BACKGROUND_RGB[background];
    this.minRatio = minRatio;
  }

  isReadable(color: AnsiColorName): boolean {
    return (
      contrastRatio(ANSI_16_REFERENCE_RGB[color], this.backgroundRgb) >=
      this.minRatio
    );
  }

  filter(colors: AnsiColorName[]): AnsiColorName[] {
    return colors.filter((color) => this.isReadable(color));
  }
}

export const ALL_ANSI_COLOR_NAMES = Object.keys(
  ANSI_16_REFERENCE_RGB
) as AnsiColorName[];
