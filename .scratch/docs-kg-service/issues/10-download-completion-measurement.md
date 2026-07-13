# Decide how completed downloads are measured and specify the event capture

Type: task
Status: open
Mode: AFK
Blocked by: 02

## Question

Ticket 2's success metric may hinge on completed downloads, but a raw Supabase signed URL gives no server-side completion signal on the free tier. Decide the measurement approach - count signed-URL issuance as a proxy, or put a lightweight logging-redirect endpoint IN FRONT of the signed URL that records the hit then 302s to it - and specify the minimal event capture (an events row / counter column) the catalog schema and the ~50-line flow will carry. This shapes the flow, so it's decided before provisioning wires the schema.

---

**Why session-sized / why this type:** Ticket 2 sets a metric nothing currently captures; a raw signed URL emits no completion signal, so this picks proxy-count vs logging-redirect and specs the capture that the provisioning schema and flow consume - an engineering call driven by the chosen metric, so AFK.

## Update

Simplified by the auth decision (ticket 15): downloads are now AUTHED in-app events, so completion is directly trackable — the anonymous signed-URL blind spot is gone. Primary KPI = signups (ticket 02); completed downloads = secondary. Capture = a signups table + one download-event row per authed download. The logging-redirect option is likely unnecessary now.
