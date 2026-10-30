---
status: proposed
date: 2026-10-30
decision-makers:
  - maintainers
applies-to:
  - src/ops/ConfigOps.ts
issues:
  - rockcarver/frodo-lib#853
---

# Static configuration is what a promotion carries, and everything else is dynamic

## Context and problem statement

A full export or import can be limited to static or to dynamic configuration (`includeStatic` and `includeDynamic` in `src/ops/ConfigOps.ts`). Ping defines what an environment promotion carries from one environment to the next, but it names only a few examples of dynamic configuration and does not list the rest. When the options were added, on 2026-10-30, a caller kept the configuration of a development tenant in full and, for the environments that promotions feed, only what a promotion does not manage. That caller needs the second part to be complete, however Ping words it. The question was whether "dynamic" means what Ping names, or everything that is not static.

## Decision

- Static configuration is what an environment promotion carries. Its types are listed in the TSDoc of `includeStatic`.
- Dynamic configuration is every configuration that is not static, whether or not Ping names it as dynamic. There is no third class and no separate "not static" option: `includeDynamic` is that.
- In a full export and a full import, each configuration type is handled under exactly one of the two options, so static and dynamic together are everything and do not overlap. The realm list that the realm-level types need is read either way.
- A new configuration type is static only if a promotion carries it; otherwise it is dynamic. Put it under the matching option, and in that option's TSDoc, in the same change.
- Leaving both options out, or passing `true` for both, includes everything. Passing `false` for both includes nothing.
- A command-line flag for these options (`--static`, `--dynamic`) says the same in its help text.

## Consequences

- A stored export of the dynamic configuration, together with what a promotion manages, leaves nothing out.
- When Ping starts to carry another type in promotions, the type moves from dynamic to static. The change says so in the release notes, because an earlier dynamic export contains the type and a later one does not.
- What is static depends on what a promotion carries, which Ping can change. The TSDoc lists are where to check it and where to change it.

## Alternatives considered

A `--dynamic` limited to what Ping names, plus a `--non-static` for the rest: rejected. Ping does not list its dynamic types, and the second option would mean the same as `includeDynamic` for every caller who needs it.
