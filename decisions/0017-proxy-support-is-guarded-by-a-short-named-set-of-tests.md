---
status: accepted
date: 2026-11-10
decision-makers:
  - maintainers
applies-to:
  - src/api/BaseApi.ts
  - src/api/BaseApi.proxy*.test.ts
  - test/jest-no-ambient-proxy.setup.js
  - package.json
  - .github/workflows/pipeline.yml
issues:
  - rockcarver/frodo-lib#982
---

# Proxy support is guarded by a short named set of tests, not by running the suite through a proxy

## Context and problem statement

Most enterprise use of the library goes through a proxy, so a broken proxy support must be caught before a release. The pipeline guarded it by running the whole suite a second time with `HTTPS_PROXY` set. When this was decided, on 2026-11-10, a measurement showed that this tested little: recorded tests replay from disk and never open a socket, so only the few tests with real sockets noticed the proxy, and they failed because they did not clear the variables, not because they tested the proxy. The second run cost minutes on every Node version.

## Decision

- The proxy support, `getHttpAgent()` and `getHttpsAgent()` in `src/api/BaseApi.ts` and the proxy dependency under them, is guarded by a short, named set of test files: the files listed in the `test:proxy` script of `package.json`. A guard test in `src/api/BaseApi.proxy.test.ts` fails when the script names a file that does not exist or no longer names a file of the set, so the set cannot shrink unnoticed.
- The set has two kinds of tests. Hermetic tests start a proxy and the targets in the test process, on the loopback interface, and prove a behaviour from what the proxy saw (the CONNECT, the request line, the headers, the tunnels), not from the answer alone. A live probe sends an unauthenticated request through a real proxy to a real tenant and has a negative control with a dead proxy; it never logs in and never writes.
- The live probe runs in CI, in the `Proxy Tests` step of the `Test` job, through the squid service container, and is off everywhere else (`FRODO_PROXY_LIVE`). When it is on and the tenant or the proxy is not configured, it fails; it does not skip.
- A change to the agent code in `src/api/BaseApi.ts`, or to the proxy dependency (`proxy-agent` and what it pulls in), keeps the set passing. A change to what the proxy support does adds or changes a test of the set in the same pull request.
- The suite does not run through a proxy. A jest setup file hides the proxy variables of the machine from every test file, and a test of the proxy support sets the variables it needs and restores them.

## Consequences

- The proxy leg of CI takes seconds, and it fails for a reason that is about the proxy.
- `npm test` passes on a machine behind a proxy, and a test with a real socket needs no proxy settings of its own.
- A new proxy behaviour (a SOCKS proxy, a PAC file, another variable) needs a test in the set; the full suite would not notice it.
- The live probe needs the tenant URL variable of the repository and a proxy. A run without them fails at that step until they are there.
- The set pins behaviour of dependencies. A dependency update that changes it fails the set; read the failure before changing the test.

## Alternatives considered

- Keep running the whole suite through squid: slow, and it hides the gap that recorded tests never open a socket.
- Drop the proxy leg: nothing would then catch a broken proxy support before users do.
