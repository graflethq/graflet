# Choose the launch catalog: how many docs sites and which ones

Type: grilling
Status: resolved
Mode: HITL
Blocked by: —

## Question

Does v1 launch with a single site (shadcn) or a small handful (~3-5)? Exactly which candidate green-zone (MIT/Apache/CC-BY) sites, and what's the selection rule - popularity, license-cleanliness, or resulting graph quality? (The agent verifies each candidate's license in the vet ticket; here the founder just proposes the candidate list and the rule.)

---

**Why session-sized / why this type:** Launch scope is a founder call that sets the entire offline build workload and feeds the vetting task; it's the founder proposing candidates, not the legal verification.

## Answer

Listed catalog = BROAD (as many docs as possible — cheap catalog rows + a status field). Actually-BUILT at launch = a green handful (shadcn ✅ + react (CC-BY) + a few more vetted green, e.g. Tailwind/Vue/Svelte — TBD). The rest sit in `graphifying` status and fill in over time. Named candidates: nextjs (docs license likely RED → graph-only), react (green CC-BY), shadcn (green MIT, already built). Ticket 13 vets each candidate's DOCS content license before it flips to `ready`.
