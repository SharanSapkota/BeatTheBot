# 0002: Kysely for database access

**Status:** accepted · 2026-10-23

**Context:** We want snake_case columns, typed queries and a clean repository layer.

**Decision:** Kysely + `pg` with Kysely migrations. Database types generated with `kysely-codegen`.

**Consequences:** SQL-like, fully typed queries; snake_case end to end without mapping. More hand-written queries than Prisma; acceptable for this size.
