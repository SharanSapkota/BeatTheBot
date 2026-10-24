# 0005: Sign in with email + one-time code

**Status:** accepted · 2026-10-24

**Context:** Fans must keep their points and history across devices and seasons, without friction on a news page. Passwords add friction and risk.

**Decision:** Passwordless email OTP: 6-digit code, valid 10 min, max 5 tries, stored hashed. Session token (hashed in DB) remembered in the browser for 90 days. Sign-in is asked only when a fan first locks in a pick or votes. Production should add Kaleva Media SSO.

**Consequences:** Low friction, no password storage, real email for prize contact. Needs email sending (Mailpit locally) and rate limiting to stop abuse.
