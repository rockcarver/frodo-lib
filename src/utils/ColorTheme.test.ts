/**
 * Run tests
 *
 *        npm run test:only ColorTheme
 */
import c from 'tinyrainbow';

import { State } from '../shared/State';
import { ALL_ANSI_COLOR_NAMES, TerminalContrastFilter } from './TerminalContrast';
import {
  FRODO_COLOR_THEME_ENV_KEY,
  Intent,
  resolveThemeMode,
  resolveThemeModeFromSetting,
  theme,
  themeForMode,
} from './ColorTheme';

function mockState(colorTheme: 'dark' | 'light' | undefined): State {
  let current = colorTheme;
  return {
    getColorTheme: () => current,
    setColorTheme: (t: 'dark' | 'light') => {
      current = t;
    },
  } as unknown as State;
}

const INTENTS: Intent[] = ['error', 'warning', 'command', 'emphasis'];
const ORIGINAL_ENV = process.env[FRODO_COLOR_THEME_ENV_KEY];

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env[FRODO_COLOR_THEME_ENV_KEY];
  } else {
    process.env[FRODO_COLOR_THEME_ENV_KEY] = ORIGINAL_ENV;
  }
});

describe('ColorTheme', () => {
  describe('resolveThemeModeFromSetting()', () => {
    test('0: Method is implemented', () => {
      expect(resolveThemeModeFromSetting).toBeDefined();
    });

    test('1: defaults to dark when nothing is set', () => {
      delete process.env[FRODO_COLOR_THEME_ENV_KEY];
      expect(resolveThemeModeFromSetting(undefined)).toBe('dark');
    });

    test('2: env var overrides the default', () => {
      process.env[FRODO_COLOR_THEME_ENV_KEY] = 'light';
      expect(resolveThemeModeFromSetting(undefined)).toBe('light');
    });

    test('3: an explicit override beats the env var', () => {
      process.env[FRODO_COLOR_THEME_ENV_KEY] = 'light';
      expect(resolveThemeModeFromSetting('dark')).toBe('dark');
    });

    test('4: an invalid env var value is ignored, falling back to the default', () => {
      process.env[FRODO_COLOR_THEME_ENV_KEY] = 'not-a-real-theme';
      expect(resolveThemeModeFromSetting(undefined)).toBe('dark');
    });
  });

  describe('resolveThemeMode()', () => {
    test('1: reads the override through state.getColorTheme()', () => {
      delete process.env[FRODO_COLOR_THEME_ENV_KEY];
      expect(resolveThemeMode(mockState('light'))).toBe('light');
    });

    test('2: falls through to the env var when state has no override', () => {
      process.env[FRODO_COLOR_THEME_ENV_KEY] = 'light';
      expect(resolveThemeMode(mockState(undefined))).toBe('light');
    });
  });

  describe('themeForMode()', () => {
    test('0: Method is implemented', () => {
      expect(themeForMode).toBeDefined();
    });

    test.each(['dark', 'light'] as const)(
      '1: %s theme defines every intent',
      (mode) => {
        const colors = themeForMode(mode);
        for (const intent of INTENTS) {
          expect(typeof colors[intent]).toBe('function');
          expect(colors[intent]('x')).toEqual(expect.any(String));
        }
      }
    );

    // The objective readability check: every intent in every built-in
    // theme must actually clear WCAG AA contrast (4.5:1) against the
    // background that theme is meant for. This is what makes the palette
    // choices in ColorTheme.ts verifiable instead of eyeballed -- if
    // someone changes an intent's color to something unreadable, this
    // fails instead of silently shipping.
    test.each([
      ['dark', 'black'],
      ['light', 'white'],
    ] as const)(
      '2: every intent in the %s theme is WCAG AA-readable on a %s background',
      (mode, background) => {
        const filter = new TerminalContrastFilter(background);
        const colors = themeForMode(mode);
        for (const intent of INTENTS) {
          // Identify which of the 16 named ANSI colors an intent actually
          // renders as, by comparing its output against each candidate's.
          const rendered = colors[intent]('probe');
          const matchingColor = ALL_ANSI_COLOR_NAMES.find(
            (name) => c[name]('probe') === rendered
          );
          expect(matchingColor).toBeDefined();
          expect(filter.isReadable(matchingColor)).toBe(true);
        }
      }
    );

    test('3: tagged-template markup delegates {name ...} blocks to the matching intent', () => {
      const t = themeForMode('dark');
      const viaTag = t`before ${1} {error middle} after`;
      const viaCall = `before 1 ${t.error('middle')} after`;
      expect(viaTag).toBe(viaCall);
    });

    test('4: an unrecognized markup block name is left untouched', () => {
      const t = themeForMode('dark');
      expect(t`{notarealintent hello}`).toBe('{notarealintent hello}');
    });

    test('5: nested markup composes -- the outer color resumes after the inner one closes', () => {
      const t = themeForMode('dark');
      const viaTag = t`{error before {emphasis WORD} after}`;
      const viaCall = t.error(`before ${t.emphasis('WORD')} after`);
      expect(viaTag).toBe(viaCall);
    });
  });

  describe('theme()', () => {
    test('0: Method is implemented', () => {
      expect(theme).toBeDefined();
    });

    test('1: reflects the state it was resolved from', () => {
      delete process.env[FRODO_COLOR_THEME_ENV_KEY];
      expect(theme(mockState('dark')).error('x')).toBe(
        themeForMode('dark').error('x')
      );
      expect(theme(mockState('light')).error('x')).toBe(
        themeForMode('light').error('x')
      );
    });
  });
});
