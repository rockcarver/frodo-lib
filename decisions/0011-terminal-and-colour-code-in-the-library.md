---
status: deprecated
date: 2026-10-24
decision-makers:
  - maintainers
applies-to:
  - src/utils/ColorTheme.ts
  - src/utils/TerminalContrast.ts
  - src/utils/TerminalBackgroundDetection.ts
  - src/utils/TerminalUtils.ts
  - src/shared/State.ts
---

# Terminal and colour code lives in the library (deprecated)

## Context and problem statement

The umbrella record 0001 says the library is the brain and the CLI is the terminal wrapper: frodo-lib holds nothing that is tied to one interface such as a terminal. In August 2026 a semantic colour theme, a WCAG contrast filter and terminal background detection were added to frodo-lib (`feat(theme)`, 2026-08-29 and 2026-08-30, first released in 4.6.0). The header of the 4.12 package root says why: it is "consumed by frodo-cli and available to any other consumer wanting readable colored output". The maintainers' view on 2026-10-24: this code needs to be revisited and likely should not have gone into the library in the first place. This record documents the deviation; it does not schedule the work. Evidence measured on `main` (42632f3cd).

## Decision

The practice is deprecated and not extended:

- No new colour, terminal-detection, ANSI or terminal-geometry code in frodo-lib.
- The library's output seam stays: the caller supplies a handler through `state` (`Console.ts` is the model, and it has no dependency on the colour code).
- Until the code moves, the existing files are maintained only for defects. The ESLint rule that confines `tinyrainbow` to `ColorTheme.ts` stays.

### Evidence

| Piece | Lines | What it does | Who uses it |
| - | - | - | - |
| `utils/ColorTheme.ts` | 175 | semantic colour intents (`error`, `warning`, `command`, `emphasis`), dark and light themes, theme mode resolution; the only file allowed to import `tinyrainbow` | in the library: `AuthenticateOps` (6 call sites, the "detected" messages), `NodeOps` (2, warnings), `State.ts` (default error colours), `TerminalUtils.ts`; in the CLI through the facade (`src/utils/ColorTheme.ts` layers its own intents on it; 110 CLI files import that wrapper) |
| `utils/TerminalContrast.ts` | 125 | WCAG contrast ratio and a filter over the ANSI palette | `ColorTheme.ts`; CLI `ThemeConfig.ts` |
| `utils/TerminalBackgroundDetection.ts` | 136 | asks the terminal for its background colour: raw mode on `process.stdin`, an OSC 11 escape written to `process.stdout` | only the CLI (`ThemeConfig.ts:791`) |
| `utils/TerminalUtils.ts` | 39 | exposes nine members as `frodo.utils.terminal` | the CLI (two files: `ColorTheme.ts`, `ThemeConfig.ts`) |
| `shared/State.ts` | n/a | `colorTheme` setting (`setColorTheme`, `getColorTheme`), default print handler (`console.log`, `console.dir`), default error handler (`process.stderr.write` with theme colours), default verbose and curlirize handlers | the CLI sets every handler itself (`app.ts`, `FrodoCommand.ts`), and calls `setColorTheme` and `getColorTheme` 7 times in `ThemeConfig.ts` |
| root and facade surface | n/a | types `ColorThemeMode`, `Intent`, `AnsiColorName`, `TerminalBackground`, `Rgb`, `TerminalContrastFilter`, `BackgroundPreset` at the package root; `frodo.utils.terminal` on the facade; entries in `MIGRATION.md` | unknown outside the CLI |
| tests | 254 | `ColorTheme.test.ts`, `TerminalContrast.test.ts` (none for background detection) | |

- 475 lines of source, 5 non-test importers of `ColorTheme.ts` (`index.ts`, `AuthenticateOps`, `NodeOps`, `State`, `TerminalUtils`). `Console.ts` has 65 non-test importers but does not import `ColorTheme.ts`; it is the seam to keep.
- The stable 4.x line exports the helpers from the package root (4.6.0 to 4.12.0). 5.0.0 moved them to `frodo.utils.terminal`, and `MIGRATION.md` documents that. 5.0.0 stable is not released.

## Consequences

- Library messages carry ANSI colour (8 sites) and the default handlers write to the console and to stderr. A tool that does not set handlers gets colour codes in its output.
- `TerminalBackgroundDetection.ts` takes over `process.stdin` (raw mode, data listener). Any consumer that calls it from a non-CLI process gets terminal side effects.

### Remediation

Direction only; not scheduled. Interface-specific colour and terminal code moves to frodo-cli; frodo-lib keeps only an output seam where the caller supplies the handler, as `Console.ts` does. Order matters: the CLI gets its own copy first and stops using the facade, then the library removes its copy, so no release breaks the other.

| Piece | Work | Size |
| - | - | - |
| 1. Background detection | Move `TerminalBackgroundDetection.ts` to the CLI (`ThemeConfig.ts` is the only user); drop `detectTerminalBackgroundRgb`, `matchBackgroundPreset` and the `BackgroundPreset` type from the library. | S |
| 2. Colour theme and contrast | Move `ColorTheme.ts`, `TerminalContrast.ts` and their tests to the CLI and merge them with the CLI's own `ColorTheme.ts` (which already layers on the library's). The CLI `ThemeConfig.ts` imports locally. | M |
| 3. Coloured library messages | The 8 coloured call sites in `AuthenticateOps` and `NodeOps` become plain text, or pass an intent to the handler. Needs a decision: the inline emphasis ("Identity Cloud detected") cannot be reproduced by a handler that only receives the message type. | S |
| 4. `State` defaults and colour setting | Remove `colorTheme`, `setColorTheme` and `getColorTheme` (the CLI keeps its own state). Make the default handlers plain or inert so the library prints nothing unless the caller says so. | M |
| 5. Facade and root surface | Remove `frodo.utils.terminal`, `TerminalUtils.ts`, the seven root types and the `tinyrainbow` devDependency and lint rule; update `MIGRATION.md`, `AGENTS.md`, `CONTRIBUTE.md` and the capability metadata. | S |

Consequences for consumers: pieces 1, 2, 4 and 5 are breaking for library users (facade members, root types, `State` methods and default output disappear), so the cheapest time is before 5.0.0 stable, where the migration text only has to say "moved to the CLI"; afterwards it is a major release with a deprecation window. Library users who relied on the helpers (4.6.0 and later) have no library replacement and have to copy the code. The CLI keeps behaving the same for users (`frodo settings theme ...`, `FRODO_COLOR_THEME`); its change is internal imports plus moved tests. The CLI already sets all handlers, so inert library defaults do not change CLI output.
