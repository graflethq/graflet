# Upload the first bundle to storage and insert its catalog row

Type: task
Status: open
Mode: HITL
Blocked by: 16, 21

## Question

Push the zipped shadcn bundle to the storage bucket and insert its catalog row, proving the object path, bundle metadata, and catalog shape that the app's signed-URL download flow will consume end to end.

---

**Why session-sized / why this type:** Proves the upload + catalog plumbing that de-risks the download flow; split from the local build so it can wait on provisioning without holding up shape-learning.
