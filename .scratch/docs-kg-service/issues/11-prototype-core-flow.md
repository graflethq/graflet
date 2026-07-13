# Prototype the full pick-doc -> preview -> email -> check-email flow incl. edge states

Type: prototype
Status: open
Mode: HITL
Blocked by: 01

## Question

How should the happy path look and behave end to end - land on a picker, a doc detail/preview that shows what the download contains (md file count, graph.html preview, report) and its license tier, a single email field, then a 'check your email' confirmation - one page or a short stepper, and what does each screen say? Include the non-happy states: empty catalog / no results, invalid-email inline validation, email-send failure, and rate-limit / 'you already requested this doc'. Build a clickable throwaway (claude.ai/design for the look, /prototype as the harness).

---

**Why session-sized / why this type:** The central question is how the whole small flow feels and it must be reacted to, not decided in the abstract; stack + tokens are already fixed, but the picker model and the v1 IN/OUT set (ticket 1) must be settled first so it charts the right screens rather than guessing the IA.

## Update

Flow reshaped: prototype browse → per-bundle savings teaser + graph thumbnail → click Download → signup popup (anonymous) → signed-up direct 24h download — PLUS the broad catalog with `ready`/`graphifying` status badges and 'notify me when ready' on in-progress docs. NOT 'enter email → check email'. Edge states: anon-gate popup, invalid email, per-account rate-limit, in-progress notify-me confirmation, empty results.
