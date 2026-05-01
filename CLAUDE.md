# CLAUDE.md — repository root

This repo ships **one** production service: **[`booking-service/`](booking-service/)** (NestJS appointment scheduler). All detailed architecture, layering, Prisma, Redlock, HTTP, and testing rules live in **[`booking-service/CLAUDE.md`](booking-service/CLAUDE.md)**.

**[`AGENTS.md`](AGENTS.md)** is the open-standard mirror of this file for tools that read `agents.md` only. If they disagree, **this file wins** — then fix `AGENTS.md`.

---

## Where AI assistants should read

| Tool / audience | Primary locations |
|----------------|-------------------|
| **Cursor** | [`.cursor/rules/architecture.mdc`](.cursor/rules/architecture.mdc) (repo root), [`booking-service/.cursor/rules/booking-service.mdc`](booking-service/.cursor/rules/booking-service.mdc), [`booking-service/.cursor/rules/booking-flow.mdc`](booking-service/.cursor/rules/booking-flow.mdc) |
| **GitHub Copilot** | [`.github/copilot-instructions.md`](.github/copilot-instructions.md), [`.github/instructions/*.md`](.github/instructions/) (path-scoped) |
| **Claude / Codex / Antigravity / generic agents** | [`AGENTS.md`](AGENTS.md), [`booking-service/AGENTS.md`](booking-service/AGENTS.md), [`booking-service/CLAUDE.md`](booking-service/CLAUDE.md), **[`docs/ai/README.md`](docs/ai/README.md)** |

---

## Non-negotiables (summary)

Full rationale: [`docs/scenario/content.md`](docs/scenario/content.md), [`booking-service/CLAUDE.md`](booking-service/CLAUDE.md).

- **Clean architecture**: `domain` → nothing; `application` → domain only; `infrastructure` implements ports; `interface` depends on application. No inward imports from outer layers.
- **PostgreSQL** is the system of record; **Redis** is cache + Redlock store only.
- **Booking confirm path**: validate → Redlock → PG re-check → transactional insert (appointment + outbox) → cache invalidate → token-checked lock release. Not optional.
- **Prisma** only in `infrastructure/`; map to domain entities at repository boundaries.
- **Tests**: application/domain unit tests use **hand-written fakes** in [`booking-service/test/fakes/`](booking-service/test/fakes/), not Prisma mocks. See **[`docs/ai/README.md`](docs/ai/README.md)** for the CRUD unit-test checklist.

---

## Unit tests — required for CRUD changes

Whenever you add or change an **aggregate CRUD** slice (port + application service + Prisma repository + HTTP module), you **must** ship:

1. **`booking-service/test/fakes/fake-<aggregate>.repository.ts`** implementing the port (in-memory, mirrors domain errors the real adapter throws).
2. **`booking-service/src/application/<aggregate>/<aggregate>.service.spec.ts`** covering create, read/list, update (including `EmptyUpdateError` when applicable), delete, and domain errors.

Details and examples: **[`docs/ai/README.md`](docs/ai/README.md)**.
