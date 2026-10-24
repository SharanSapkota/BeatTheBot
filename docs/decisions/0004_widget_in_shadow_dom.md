# 0004: Embeddable widget in Shadow DOM + demo extension

**Status:** accepted · 2026-10-23

**Context:** We can't change kaleva.fi. The product must be easy for Kaleva to adopt.

**Decision:** Ship one `widget.js` that mounts in a Shadow DOM. For the demo, a Chrome MV3 extension mounts it on kaleva.fi in our own browser; its background script calls the local API.

**Consequences:** One-line adoption story for Kaleva; no CSS clashes; avoids CSP and local-network blocking in the demo. The extension is demo-only and never published.
