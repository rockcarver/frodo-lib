# Security policy

## Reporting a vulnerability

Please report a suspected vulnerability privately, with GitHub's private vulnerability reporting: open the **Security** tab of the repository and choose **Report a vulnerability** ([direct link](https://github.com/rockcarver/frodo-lib/security/advisories/new)).

Do not open a public issue or pull request for a suspected vulnerability.

Include, as far as you can:

- the affected version of `@rockcarver/frodo-lib`,
- the steps to reproduce it, ideally a small working proof of concept,
- the impact, and
- who controls the input that triggers it (see the threat model below).

## Scope and threat model

The library trusts its caller. The application that embeds it decides where the credentials, hosts, file paths and configuration it passes in come from, and the person who runs that application is trusted. A report has to show an attacker who controls an input without already controlling those. The command line and the MCP server have their own policy in [frodo-cli](https://github.com/rockcarver/frodo-cli/security/policy).

Recordings and test fixtures must never contain live secrets. A secret committed in one is a vulnerability: report it privately, and say so if it is still valid.

## Out of scope

- Reports that need control of the operator's own machine, process, environment, connection profiles or files. The person who runs the application is trusted.
- Automated scanner output without a working proof of concept.
- Vulnerabilities in third-party dependencies that Dependabot already tracks. Please report those upstream.

## What to expect

Frodo is maintained by a small team of volunteers. We answer on a best-effort basis, handle confirmed vulnerabilities through a private advisory, and disclose them after a fix is released. We credit the reporter if they want to be named.

## Unsolicited fix pull requests

We read a pull request that claims to fix a security problem before we run any automated checks on it, and we may close it without merging. Please report the problem privately instead. How we handle reports is recorded in [rockcarver/frodo, record 0017](https://github.com/rockcarver/frodo/blob/main/docs/decisions/0017-security-reports-and-fixes-are-handled-privately-by-a-maintainer.md).

## Supported versions

Fixes are made on `main` and released in the next release.
