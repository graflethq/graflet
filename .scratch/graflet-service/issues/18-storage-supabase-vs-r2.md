# Decide bundle storage: Supabase Storage vs Cloudflare R2

Type: grilling
Status: open
Mode: HITL
Blocked by: 16

## Question

Where do the zip bundles live for v1 - Supabase Storage (one service, signed URLs built in) or Cloudflare R2 (zero egress fees, wins only if downloads get large)? Given the real bundle size now known, what expected download volume would flip the answer, and is v1 clearly under that threshold?

---

**Why session-sized / why this type:** Founder call on scale expectations that forks the provisioning task; best made once the real per-bundle size from the first build is on disk.
