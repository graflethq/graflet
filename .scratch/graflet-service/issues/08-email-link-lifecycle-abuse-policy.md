# Settle the download-link lifecycle + abuse policy

Type: grilling
Status: resolved
Mode: HITL
Blocked by: —

## Question

Settle the link lifecycle + abuse policy as founder risk-appetite calls (Supabase createSignedUrl already owns expiry - nothing to build): what expiry window (1h default vs longer), what happens when a link expires (is there a re-request path?), and what abuse controls do we want - how often may one email re-request, how do we stop someone spamming a stranger's inbox or hotlinking bundles? (The UI copy for the 'already requested' / rate-limited states is prototyped in ticket 11, not decided here.)

---

**Why session-sized / why this type:** Supabase owns the link state machine, so there is no throwaway artifact to react to - the open parts (expiry window, rate-limit thresholds, whether a re-request is allowed) are founder risk-appetite decisions reached in conversation; a grilling, not a prototype.

## Answer

Temporary link = 24 HOURS. Delivery = DIRECT in-app download for signed-up users (NOT emailed). Gate = signup (popup for anonymous users). Supabase createSignedUrl owns expiry. Abuse controls (per-account rate-limit, hotlink protection) to be finalized at implement, but the core lifecycle is set.
