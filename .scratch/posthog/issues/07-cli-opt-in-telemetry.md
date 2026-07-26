# 07 — CLI opt-in telemetry: one prompt, `DO_NOT_TRACK`, kill switch

**What to build:** The published CLI can report usage, but only if the user says yes, and it asks exactly once. On
the first **interactive** run it prints one short prompt — anonymous usage stats, yes/no, **default no** — and stores
the answer beside the existing credential store (`packages/cli/src/credential-store.ts`). A non-interactive run (CI,
a pipe, no TTY) never prompts and never sends: prompting in CI would hang a build, and defaulting to "yes" there
would be consent by absence. `GRAFLET_TELEMETRY=0` and `DO_NOT_TRACK=1` both hard-disable regardless of the stored
answer. This is the part of the design that cannot be walked back — once a version is on npm phoning home, it is on
npm forever — which is why the trade-off is recorded in ADR-0010 and why the default is no.

**Blocked by:** 01 (token), 02 (privacy page), 06 (backend already sends the authoritative download event).

**Status:** needs-triage

- [ ] First interactive run prints **one** prompt, no more than two lines, saying what is sent and that it is
      optional, with **no** as the default (bare Enter = no).
- [ ] The answer persists next to the existing credential store and is never asked again — verified by running the
      CLI twice.
- [ ] With no TTY, the CLI **neither prompts nor sends**, and exits with the same status and output as before.
      Verified by piping the command in a script.
- [ ] `GRAFLET_TELEMETRY=0` and `DO_NOT_TRACK=1` each independently disable all capture even when the stored answer
      is yes.
- [ ] A documented way to change the answer later exists (a flag or subcommand), and saying no afterwards stops all
      sending.
- [ ] Events sent, and nothing else: `cli_command_run` (`command`, `cli_version`), `cli_login_completed`,
      `cli_download_completed` (`doc`, `version`, `duration_ms`, `bytes`), `cli_download_failed` (`reason`).
- [ ] **No paths, no filenames, no argv, no hostnames, no env** are ever sent — only the fixed properties above. A
      grep of the capture call sites proves it.
- [ ] Before login: a machine-local random id as `distinct_id`, `$identify`ed to the `github_id` at login, so the
      pre-login runs join the same person the site and backend see.
- [ ] Telemetry failure is invisible: no network wait that delays a command, no error printed if PostHog is
      unreachable, no non-zero exit. Proved with a test that forces capture to reject.
- [ ] The CLI README and the privacy page both document the telemetry, the default, and both kill switches — before
      the version that contains it is published.
- [ ] Version bump follows the repo's release rule: the same version in `packages/cli/package.json`,
      `packages/graflet-pypi/pyproject.toml` and `packages/graflet-pypi/src/graflet/__init__.py`.
