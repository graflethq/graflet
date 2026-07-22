# Spec the catalog build-status + notify-me-when-ready feature

Type: task
Status: open
Mode: AFK
Blocked by: 17

## Question

Define the catalog `status` state machine (`ready` = downloadable / `graphifying` = in progress / later `queued`, `failed`) and the notify-me-when-ready capture: an in-progress doc shows the status badge AND a 'notify me' action that stores (user/email, doc_id) and triggers a Resend 'it's ready' email when the bundle flips to `ready`. Specify the table, the trigger, and the UI states. Feeds the catalog schema (ticket 21) and the prototype (ticket 11).

---

**Why session-sized / why this type:** Broad-catalog-with-status is a founder decision (list as much as possible; show in-progress); notify-me turns in-progress docs into signup + demand-signal capture. A small spec that feeds the schema + UI.
