# Keyloop service scheduler

Monorepo for a **NestJS appointment scheduler** (`booking-service/`): scheduling reference data, availability, confirm-booking (Postgres, Redis cache-aside, Redlock, transactional outbox), and HTTP APIs documented under `docs/`.

**Authoritative guides for contributors and AI tools:** [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md), [booking-service/CLAUDE.md](booking-service/CLAUDE.md).

## Run locally

### Option A — whole stack in Docker (recommended)

Starts Postgres, Redis (cache + five Redlock nodes), observability, and **`booking-service`** with `nest start --watch`. Your repo’s `booking-service/` tree is bind-mounted into the container, so edits under **`booking-service/src/`** trigger a recompile.

```bash
docker compose -f docker-compose.dev.yml up --build
```

The HTTP API listens on **port 8080** by default (`http://localhost:8080`).

### Option B — Nest on your machine, dependencies in Docker

Use this when you want **`npm run start:dev`** running **on the host** against real Postgres/Redis from Compose.

1. **Start only backing services** (no `booking-service` container):

   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres redis-cache redlock-1 redlock-2 redlock-3 redlock-4 redlock-5
   ```

2. **Configure env** — from `booking-service/`, copy the example and adjust if your ports differ:

   ```bash
   cd booking-service
   cp .env.example .env
   ```

   Defaults in `.env.example` match the compose ports above (`localhost:5432`, cache `6379`, Redlock `6381`–`6385`).

3. **Install, migrate, run** (use an active Node.js LTS):

   ```bash
   npm install
   npx prisma migrate deploy
   npm run start:dev
   ```

   This runs **`nest start --watch`** over **`src/`** (see `booking-service/package.json`). The app listens on **`PORT`** or **8080**.

4. **Other scripts** (from `booking-service/`): `npm run build` → `nest build`; `npm test` / `npm run test:integration` / `npm run test:e2e` as in `booking-service/CLAUDE.md`.

---

## Documentation

### Start here

| Doc | Description |
| --- | --- |
| [Scenario — requirements & architecture](docs/scenario/content.md) | Load-bearing product and system rationale |
| [Why each architecture phase exists](docs/architecture-diagram/WHY-ENHANCE-PHASE.md) | Narrative behind the phased design |
| [Architecture diagram (final)](docs/architecture-diagram/architecture-final.mmd) | Mermaid view of the target system |
| [Architecture diagram (phases)](docs/architecture-diagram/architecture-phase.mmd) | Phased evolution view |

### Topic hubs

| Section | Index |
| --- | --- |
| AI & agents (CRUD checklist, doc map for tools) | [docs/ai/README.md](docs/ai/README.md) |
| API contracts (HTTP surface, errors, base URL) | [docs/api-contract/README.md](docs/api-contract/README.md) |
| Database (tables, Prisma, outbox rules) | [docs/database/README.md](docs/database/README.md) |
| Technology (stack choices) | [docs/technology/README.md](docs/technology/README.md) |
| GenAI & design phase | [docs/genai-design/README.md](docs/genai-design/README.md) |
| Data flow (booking path, infra slices) | [docs/data-flow/README.md](docs/data-flow/README.md) |
| Components (layers / building blocks) | [docs/component/README.md](docs/component/README.md) |

### Key pages

| Topic | File |
| --- | --- |
| Observability (logging, metrics, tracing) | [docs/observability/strategy.md](docs/observability/strategy.md) |
| GenAI in the design phase | [docs/genai-design/design-phase-genai.md](docs/genai-design/design-phase-genai.md) |
| Technology choices | [docs/technology/technology-choices.md](docs/technology/technology-choices.md) |
| End-to-end data flow | [docs/data-flow/data-flow.md](docs/data-flow/data-flow.md) |
| Component roles in `booking-service/` | [docs/component/component-roles.md](docs/component/component-roles.md) |

### API contracts

Per-route contracts live under [docs/api-contract/](docs/api-contract/). The route index is in [docs/api-contract/README.md](docs/api-contract/README.md).

### Database reference

Table catalog and deep links: [docs/database/README.md](docs/database/README.md).

### Optional assets

Local observability UI (static): [docs/observability/ui/](docs/observability/ui/).
