# Related repositories

this: rockcarver/frodo-lib

related:
  - role: cli
    repo: rockcarver/frodo-cli
    secret: FRODO_CLI_ISSUES_TOKEN
    when: |
      Only when it is clear that the failing code is in the CLI and the library is
      not involved: a prompt or a question for a verification code or password; a
      failing read from the terminal or standard input (for example EAGAIN);
      interactive mode; the MCP server (transport, authentication, lifecycle); the
      frodo shell; argument parsing, help or output formatting; the packaged binary,
      the npm package or how the shipped build behaves in a given environment; the
      `conn` and `login` commands; or the config-manager, promote and admin
      commands, which are implemented in the CLI. If any of this is a guess, keep
      the issue here.

notes: |
  Decide by where the failing code lives, not by what the person was doing and
  not by the outermost error message.

  This repository owns, so keep the issue here: calls to tenant endpoints,
  export and import of entities and the shape of their data, the `frodo` facade,
  the authentication protocol (token requests, the browser or device login flow,
  service account JWTs), connection profile storage and encryption, the token
  cache and the recordings. It also still contains deprecated terminal colour
  code and the terminal background detection (`TerminalBackgroundDetection`,
  which sends an OSC 11 query and reads the reply from standard input).

  The CLI owns every prompt and every read of an answer from the terminal or
  standard input. The library does not ask questions itself: it calls a handler
  that the CLI supplies, for example to ask for a verification code.

  Wrapped errors: this library wraps what it catches in messages such as
  "Error getting tokens" and "Error authenticating user". Those outer messages
  come from here even when the failure started in the CLI. Read the innermost
  cause. If it is a failing terminal or standard input read during a prompt, or
  an interactive-mode problem, route it to the CLI. The one exception: a stack
  trace that names the terminal background detection stays here.

  A request for a new capability stays here when it needs a library function; the
  CLI command that wraps it is tracked in the CLI.

  When in doubt, keep the issue in this repository and say which part might be
  in the other one.
