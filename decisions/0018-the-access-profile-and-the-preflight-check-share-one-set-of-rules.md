---
status: proposed
date: 2026-11-14
decision-makers:
  - maintainers
applies-to:
  - src/ops/AccessProfileOps.ts
  - src/ops/RequiredScopesOps.ts
  - src/ops/AuthenticateOps.ts
  - src/shared/Constants.ts
  - src/api/**
issues:
  - rockcarver/frodo-lib#1072
---

# The access profile and the pre-flight scope check share one set of rules

## Context and problem statement

An interactive login on Cloud reaches less than a service account, and the two flows differ. The library refuses a call that its session cannot make before the request is sent, and it reports what a session can do (the access profile). If the two applied different rules, the profile would promise what the check refuses, or the check would refuse what the profile promises.

## Decision

- **One rule set.** Whether a scope is covered, whether the exchange client accepts it, and whether the session can reach Access Management are decided in `src/ops/AccessProfileOps.ts` and `src/ops/RequiredScopesOps.ts`, and the profile and the pre-flight check use the same functions. A rule changes in one place.
- **Facts about the built-in clients are measured constants with a date.** The scopes the client offers, the scopes its exchange client accepts, and that a device login carries no Access Management session are constants in `src/shared/Constants.ts` or comments with the date they were measured. The profile names what each statement is based on; a statement nobody measured is `unknown`, not `yes`.
- **Every scope an API module declares belongs to an area of the profile.** `requiredScopes` in `src/api` and the area list stay in step: a test fails when a declared scope has no area, and when an area lists a scope no module declares.
- **A pre-flight refusal states a measured failure.** The library refuses before the request only what was measured to fail, and sends the rest to the server. A refusal is an `InsufficientScopeError`, so the escalation to a credential with more scope still applies.
- **The defaults are measured for the built-in client only.** The scopes an interactive login asks for by default are those of the built-in client, per flow. An explicit scope always wins, and a client the customer registered keeps what it always got.
- **Messages state facts and name no interface of a caller.** They say "a device authorization login", never an option or a command; a caller recognises the condition by its error code.

## Consequences

- A new API module that needs a scope outside the list of areas fails a test until the scope is classified, instead of being found when a command fails.
- The measured constants go stale when the platform changes; the trackers for the requests to Ping (rockcarver/frodo-lib#1073, rockcarver/frodo-lib#1074) list what to re-measure and change.
- The profile is computed from the token and the state with no network call, so it is also available for a session reused from the cache.

## Alternatives considered

- Documentation only, no profile: it goes out of date silently, and a caller cannot test against it.
- Probing the tenant at login to learn what the session can do: it costs requests and a login's worth of side effects, and answers for one tenant only.
