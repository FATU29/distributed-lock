# GenAI assistance in the design phase

This section records **how generative AI was used during design** for this repository: what it was good for, what stayed human-owned, and how generated material was folded into the canonical docs so implementation did not drift from intent.

It complements [../ai/README.md](../ai/README.md), which focuses on **implementation** checklists (CRUD slices, fakes, tests). This file is about **before and alongside** those slices — structure, narrative, and cross-cutting documentation.

---

## 1. What “design phase” means here

| In scope | Out of scope (human / team / ops) |
| --- | --- |
| Turning requirements into **structured architecture** (layers, data flow, storage split, locking story). | Final legal, procurement, or vendor contracts. |
| **Authoring and refactoring markdown**: scenario rationale, API contract tables, explainers (`component`, `data-flow`, `technology`), diagram companion text. | Production incident response or on-call runbooks unless explicitly written by the team. |
| **Consistency passes**: aligning new prose with `CLAUDE.md`, `AGENTS.md`, and `.cursor/rules` non-negotiables. | Choosing real cloud regions, SKUs, or spend approval. |
| **Scaffolding** mermaid diagrams, sequence charts, and doc indexes from an existing spec. | Signing off p99 SLOs for production without measurement. |

The **load-bearing requirements** remain in [../scenario/content.md](../scenario/content.md) and [../diagram/architecture-final.mmd](../diagram/architecture-final.mmd). GenAI was used to **expand, connect, and restate** those sources — not to replace them.

---

## 2. How GenAI assisted concretely

### 2.1 Architecture and data-path narrative

- **From scenario to flows**: Translating the written scenario (Postgres vs Redis roles, cache-aside, Redlock quorum, outbox + Kafka) into **step-by-step flows** and **sequence-style descriptions** so engineers and reviewers can trace the confirm path without reading only code.
- **Vertical slice explanation**: Documenting the path **HTTP → application → ports → infrastructure** and where domain errors map to HTTP, matching the clean-architecture rules in the repo’s Cursor rules and `booking-service/CLAUDE.md`.

### 2.2 Documentation structure and discoverability

- **Topic folders** under `docs/` (`component`, `data-flow`, `technology`, this `genai-design` folder): short, single-purpose pages with **README indexes** so navigation does not depend on one monolithic file.
- **Cross-linking**: Linking scenario ↔ diagram ↔ API contract ↔ database notes so “why” and “what shape on the wire” stay connected.

### 2.3 Technology and observability rationale

- **Summarising choices** (NestJS, Prisma, Postgres, Redis, Redlock, class-validator, Jest, etc.) with **justifications tied to scenario constraints** (stateless N instances, SLO budgets, OSS posture).
- **Pointing to deeper rationale** where a human-authored doc already exists — e.g. [../observability/strategy.md](../observability/strategy.md) for “why pino / Prometheus / OpenTelemetry” — instead of duplicating full comparisons in every new page.

### 2.4 Consistency with agent and contributor rules

- **Checking new prose** against non-negotiables: Postgres as source of truth, Redis as cache + lock store, no Kafka from the request path, Prisma only in infrastructure, domain errors vs `HttpException`.
- **Suggesting headings and tables** that match how the repo already documents APIs (`docs/api-contract/`) and persistence (`docs/database/`).

---

## 3. Guardrails and review model

| Practice | Why |
| --- | --- |
| **Single sources of truth** | If GenAI output disagrees with `docs/scenario/content.md` or `booking-service/CLAUDE.md`, **the existing canonical doc wins**; the generated text is revised or discarded. |
| **Human review before merge** | Design docs are treated like code: PR review, spelling of invariants (“same transaction as appointment + outbox”), and links verified. |
| **No secrets in prompts or docs** | GenAI-assisted drafts must not embed credentials, internal URLs, or customer data; examples use placeholders and public patterns. |
| **Verify against the running system** | Architecture claims about compose services, ports, and env vars are checked against `docker-compose` and the app — not assumed from training data. |

---

## 4. Limits of GenAI in design

- **Cannot prove safety**: Redlock and transactional correctness are **justified by spec + review + tests**, not by an assistant’s confidence.
- **Training cut-off and drift**: Library and platform details change; generated snippets are validated against **this repo’s** `package.json` and actual modules.
- **No automatic “approval”**: GenAI accelerates drafting and surfacing trade-offs; **merge and production decisions** stay with people.

---

## 5. Where to look next

| If you need… | See |
| --- | --- |
| Requirements and architectural rationale | [../scenario/content.md](../scenario/content.md) |
| Final topology diagram | [../diagram/architecture-final.mmd](../diagram/architecture-final.mmd) |
| Data path through confirm and outbox | [../data-flow/data-flow.md](../data-flow/data-flow.md) |
| Stack list with short why | [../technology/technology-choices.md](../technology/technology-choices.md) |
| CRUD / test obligations for AI coding agents | [../ai/README.md](../ai/README.md) |

---

## 6. Maintaining this section

When the design process changes (e.g. new mandatory review step, new tool), update **this file** in the same PR as the process change so future readers see **how** design and GenAI use evolved — not only **what** the system does.
