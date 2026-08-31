import c from 'tinyrainbow';

import { State } from '../shared/State';

/**
 * Semantic color intents. Call sites name what a piece of text *means*
 * (`theme(state).error(...)`, `theme(state).command(...)`) rather than
 * which literal ANSI hue to use -- the theme decides the hue, per intent,
 * per active mode. This is the only file in frodo-lib allowed to reference
 * `tinyrainbow` directly (enforced by an ESLint rule), so no color choice
 * can leak in anywhere else.
 */
export type Intent = 'error' | 'warning' | 'command' | 'emphasis';

// `unknown` input, matching tinyrainbow's own `Formatter` type -- callers
// routinely color values whose static type is wider than `string` (e.g. a
// status field typed as `string | number | ...`), same as they could with
// tinyrainbow's raw color functions before this theme replaced them.
type ThemeColors = Record<Intent, (text: unknown) => string>;

/**
 * Built from TerminalContrast.ts's objective WCAG contrast filter, not
 * chosen by eye. On a black background, all four intents can keep their
 * conventional hue (error=red, warning=yellow, command=cyan) since the
 * *Bright variants of each clear the 4.5:1 contrast threshold there.
 */
const DARK_THEME: ThemeColors = {
  error: c.redBright,
  warning: c.yellowBright,
  command: c.cyanBright,
  emphasis: c.magentaBright,
};

/**
 * Also built from the objective filter -- and it surfaces something the
 * "just remap Bright to plain" approach this replaces never caught: on a
 * white background, neither yellow nor yellowBright clears 4.5:1 contrast
 * at all, at any brightness. Only { black, red, blue, magenta, blueBright }
 * pass. So `warning` deliberately does NOT use yellow here -- there is no
 * WCAG-AA-readable yellow on white in the standard 16-color ANSI palette.
 * `magenta` is used instead as the most distinct remaining "pay attention"
 * color once `error` claims red.
 */
const LIGHT_THEME: ThemeColors = {
  error: c.red,
  warning: c.magenta,
  command: c.blueBright,
  emphasis: c.blue,
};

export type ColorThemeMode = 'dark' | 'light';

const THEMES: Record<ColorThemeMode, ThemeColors> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};

export const FRODO_COLOR_THEME_ENV_KEY = 'FRODO_COLOR_THEME';

function isColorThemeMode(value: unknown): value is ColorThemeMode {
  return value === 'dark' || value === 'light';
}

/**
 * Resolves the active theme mode from an already-read override value (e.g.
 * `state.getColorTheme()`). Precedence: the override beats the
 * `FRODO_COLOR_THEME` env var, which beats the default (`dark` -- today's
 * already-safe, zero-config behavior, so nothing regresses for anyone who
 * hasn't configured anything). Pure/state-free so it can also be used by
 * `State.ts`'s own default handler, constructed before any `State` instance
 * exists to pass in (see `resolveThemeMode` below for the normal case).
 */
export function resolveThemeModeFromSetting(
  override: ColorThemeMode | undefined
): ColorThemeMode {
  if (isColorThemeMode(override)) {
    return override;
  }
  const envValue = process.env[FRODO_COLOR_THEME_ENV_KEY];
  if (isColorThemeMode(envValue)) {
    return envValue;
  }
  return 'dark';
}

/**
 * Resolves the active theme mode for a given state instance. Takes `state`
 * explicitly, like the rest of frodo-lib's ops functions, rather than
 * reading a module-level singleton -- frodo-lib supports independent
 * `Frodo.createInstance()` state objects, and a hardcoded global here would
 * silently ignore per-instance theme settings.
 */
export function resolveThemeMode(state: State): ColorThemeMode {
  return resolveThemeModeFromSetting(state.getColorTheme());
}

type ThemeApi = ThemeColors &
  ((strings: TemplateStringsArray, ...values: unknown[]) => string);

/**
 * The theme API for an already-resolved mode. Every property is a semantic
 * intent. Deliberately does NOT spread tinyrainbow's raw hue methods --
 * that's what makes "no direct color references outside this file" an
 * enforceable property of the API surface, not just a convention.
 *
 * Also callable as a tagged template -- `` themeForMode(mode)`{error text}` ``
 * is sugar for `themeForMode(mode).error('text')`, not a separate mechanism:
 * it reassembles the template's parts/values, then delegates each
 * `{name ...}` block to the matching intent function, so nesting composes
 * exactly like nested calls do (tinyrainbow's color functions already
 * re-open an outer color after an inner one closes).
 */
const MARKUP_OPEN = /^\{(\w+)\s/;

/**
 * Recursive-descent parser for `{name ...}` markup, tracking brace depth so
 * nested blocks resolve inner-to-outer (a flat single-pass regex can only
 * ever match the innermost block in something like `{error a {emphasis b} c}`,
 * since replacing it doesn't re-scan the result for the now-exposed outer
 * braces). Unmatched intent names, and unterminated blocks, are left as
 * literal text rather than throwing -- a typo in a message shouldn't crash
 * the caller.
 */
function parseMarkup(input: string, colors: ThemeColors): string {
  let result = '';
  let i = 0;
  while (i < input.length) {
    const open = input[i] === '{' && MARKUP_OPEN.exec(input.slice(i));
    if (open) {
      const name = open[1];
      const contentStart = i + open[0].length;
      let depth = 1;
      let j = contentStart;
      while (j < input.length && depth > 0) {
        if (input[j] === '{') depth++;
        else if (input[j] === '}') depth--;
        if (depth > 0) j++;
      }
      if (depth === 0) {
        const resolvedInner = parseMarkup(input.slice(contentStart, j), colors);
        result +=
          name in colors
            ? colors[name as Intent](resolvedInner)
            : `{${name} ${resolvedInner}}`;
        i = j + 1;
        continue;
      }
    }
    result += input[i];
    i++;
  }
  return result;
}

export function themeForMode(mode: ColorThemeMode): ThemeApi {
  const colors = THEMES[mode];

  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const assembled = strings.reduce(
      (acc, part, i) =>
        acc + part + (i < values.length ? String(values[i]) : ''),
      ''
    );
    return parseMarkup(assembled, colors);
  };

  return Object.assign(tag, colors);
}

/**
 * The theme API for a given state instance -- the normal entry point for
 * ops functions, which already have a `State` instance in scope.
 */
export function theme(state: State): ThemeApi {
  return themeForMode(resolveThemeMode(state));
}
