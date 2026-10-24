# 0001: Monorepo with pnpm workspaces

**Status:** accepted · 2026-10-23

**Context:** API, widget, editor, demo site and extension share types and logic (model, fact checker).

**Decision:** one repo with pnpm workspaces (`apps/*`, `packages/*`). No Turborepo for now; add it only if builds get slow.

**Consequences:** shared types without publishing packages, one install and one CI. Apps must not import from other apps.
