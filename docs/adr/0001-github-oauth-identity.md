# ADR-0001 — Identity is GitHub OAuth, not Google

**Status:** Accepted (2026-07-20)

## Context
The tool gates KG downloads behind sign-in and wants the resulting identity to (a) build an audience of the
right people and (b) maximise GitHub stars. The audience is developers, and the docs themselves live on GitHub.

## Decision
Use **GitHub OAuth** as the v1 identity provider. Not Google.

## Consequences
- Lower friction for developers (already logged into GitHub), and the captured email is usually their real dev
  email.
- One click from starring the repo — directly serves the #1 goal.
- The CLI uses a GitHub browser OAuth flow with the **backend holding the client secret** (never shipped in the
  OSS CLI). The CLI never holds the maintainer's private-repo token. *(v1 implementation, ticket 03: the
  **authorization-code** variant — CLI opens the authorize URL, GitHub redirects to a backend callback, the
  backend does the code exchange and mints its own bearer token, which the CLI collects by polling. Chosen over
  the device flow specifically so the client secret is used at the exchange rather than left unused.)*
- Trade-off accepted: excludes non-GitHub users (learners without accounts). If a broader audience proves to
  matter, add Google as a second option later (a fast-follow, not v1).
- Bonus: the same GitHub login can optionally supply a rate-lift token, though the default `.md` fetch (codeload)
  needs none.
