/**
 * Run tests
 *
 *        npm run test:only TerminalContrast
 */
import {
  ALL_ANSI_COLOR_NAMES,
  contrastRatio,
  TerminalContrastFilter,
} from './TerminalContrast';

describe('TerminalContrast', () => {
  describe('contrastRatio()', () => {
    test('0: Method is implemented', () => {
      expect(contrastRatio).toBeDefined();
    });

    test('1: black vs. white is the maximum possible ratio (21:1)', () => {
      expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    });

    test('2: a color against itself is the minimum possible ratio (1:1)', () => {
      expect(contrastRatio([120, 60, 200], [120, 60, 200])).toBeCloseTo(1, 5);
    });

    test('3: is symmetric regardless of argument order', () => {
      const a: [number, number, number] = [205, 0, 0];
      const b: [number, number, number] = [255, 255, 255];
      expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
    });
  });

  describe('TerminalContrastFilter', () => {
    test('0: Class is implemented', () => {
      expect(TerminalContrastFilter).toBeDefined();
    });

    test('1: whiteBright fails to be readable on a white background', () => {
      const filter = new TerminalContrastFilter('white');
      expect(filter.isReadable('whiteBright')).toBe(false);
    });

    test('2: black fails to be readable on a black background', () => {
      const filter = new TerminalContrastFilter('black');
      expect(filter.isReadable('black')).toBe(false);
    });

    test('3: redBright is readable on a black background', () => {
      const filter = new TerminalContrastFilter('black');
      expect(filter.isReadable('redBright')).toBe(true);
    });

    test('4: red is readable on a white background', () => {
      const filter = new TerminalContrastFilter('white');
      expect(filter.isReadable('red')).toBe(true);
    });

    test('5: filter() returns only the colors isReadable() approves of', () => {
      const filter = new TerminalContrastFilter('black');
      const filtered = filter.filter(ALL_ANSI_COLOR_NAMES);
      for (const color of ALL_ANSI_COLOR_NAMES) {
        expect(filtered.includes(color)).toBe(filter.isReadable(color));
      }
    });

    test('6: a stricter minimum ratio never approves more colors than a looser one', () => {
      const strict = new TerminalContrastFilter('white', 7);
      const loose = new TerminalContrastFilter('white', 3);
      const strictColors = new Set(strict.filter(ALL_ANSI_COLOR_NAMES));
      const looseColors = new Set(loose.filter(ALL_ANSI_COLOR_NAMES));
      for (const color of strictColors) {
        expect(looseColors.has(color)).toBe(true);
      }
    });

    // This is the objective, reviewable replacement for eyeballing which
    // colors are "readable" -- a snapshot means any future change to the
    // reference RGB table or the WCAG threshold shows up as a diff here,
    // not a silent guess. If this snapshot needs updating, regenerate it
    // deliberately (--updateSnapshot) and review the diff, don't just
    // accept it.
    test('7: WCAG AA (4.5:1) pass/fail table for all 16 colors, both backgrounds', () => {
      const report: Record<string, { black: boolean; white: boolean }> = {};
      const blackFilter = new TerminalContrastFilter('black');
      const whiteFilter = new TerminalContrastFilter('white');
      for (const color of ALL_ANSI_COLOR_NAMES) {
        report[color] = {
          black: blackFilter.isReadable(color),
          white: whiteFilter.isReadable(color),
        };
      }
      expect(report).toMatchSnapshot();
    });
  });
});
