# Research Resend free-tier limits, deliverability, and sender-domain requirements

Type: research
Status: resolved
Mode: AFK
Blocked by: —

## Question

What are Resend's free-tier send caps, and does sending the download-link email require a verified custom sending domain (SPF/DKIM/DMARC) or will onboarding@resend.dev work for launch? How likely is a one-off transactional 'here is your link' email to hit spam, and what's the minimum config to avoid it?

---

**Why session-sized / why this type:** External-knowledge blocker (Resend docs) that decides whether verifying a domain is a hard prerequisite for the email flow and feeds the provisioning task; resolves to a markdown summary.

---

## Answer

- **Verified custom domain is a HARD prerequisite for launch — YES.** The shared `onboarding@resend.dev` sandbox can only send **to the email you registered the Resend account with**; sending to any other recipient errors out. No verified domain = no download-link email to real customers.
- **Free tier:** 100 emails/day, 3,000/month (transactional; sent + received both count), 1 verified domain, 10 req/sec rate limit per team. Bounce < 4%, spam < 0.08%. Plenty for one email per request at launch.
- **DNS to add (sending only):** MX `send` → `feedback-smtp.<region>.amazonses.com` (prio 10); TXT `send` → `v=spf1 include:amazonses.com ~all`; TXT `resend._domainkey` → `p=<key>`. DKIM+SPF are what mark it verified; add DMARC TXT `_dmarc` `p=none` (recommended, not required).
- **Deliverability:** verified domain (DKIM+SPF) + subdomain + plain content with a text part + real from-name = low spam risk. Alternatives (Postmark/SES/Loops) all need the same domain verification, so switching doesn't remove the blocker — stick with Resend.

See: research/resend-email/RESEND.md

## Update

Role narrowed by tickets 15 + 01: Resend is NO LONGER the download-link delivery channel (downloads are direct in-app 24h links). Resend now sends only: (1) signup verification, (2) 'your bundle is ready' notify-me emails. The verified custom domain is still a hard prerequisite; free tier 100/day is ample.
