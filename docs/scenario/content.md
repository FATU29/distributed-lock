# Scenario A: The Unified Service Scheduler

- **Domain:** Ownership
- **Task:** Build an Appointment Scheduler application to replace manual booking systems.

## Core Requirements

1. **Resource Constrained Booking** — Allow a user to request a service appointment for a specific vehicle, service type, and dealership at a desired time.
2. **Real-Time Availability Check** — Before confirming, check for the availability of both a `ServiceBay` and a qualified `Technician` for the entire service duration.
3. **Confirmed Appointment Record** — Upon success, create a persistent `Appointment` record associating the customer, vehicle, technician, and service bay.

---

## Architecture Best Practices — Scaling & Performance

The booking flow is read-heavy on availability checks and write-contended on the confirm step (multiple users may target the same bay/technician/slot). The design below addresses both. See [`../diagram/architecture.md`](../diagram/architecture.md) and [`../diagram/architecture.mmd`](../diagram/architecture.mmd) for the phased rationale.

### 1. Storage split: PostgreSQL is the system of record, Redis is the hot path

| Concern | PostgreSQL | Redis |
|---|---|---|
| Role | source of truth | cache + distributed lock store |
| Holds | `Appointment`, `Technician`, `ServiceBay`, `Vehicle`, `Customer` | hot slot lookups, lock keys |
| Guarantees | ACID, FK integrity, joins, audit | sub-ms reads, high QPS |

Neither store is sufficient alone — Redis-only loses durability and ACID; DB-only is too slow on the availability hot path. Combining them is **Phase 1** of the architecture.

### 2. Cache-aside for availability reads

The availability check (step 2 of the booking flow) is the hottest read. It uses cache-aside:

1. `GET` slot/bay/technician availability from Redis.
2. On miss, `SELECT` from PostgreSQL.
3. `SET` the row back into Redis with a TTL.

Writes go to PostgreSQL first, then invalidate the affected cache entries. This keeps reads sub-millisecond while preserving write durability.

### 3. Horizontal scaling of the scheduler service

The scheduler runs as **N stateless instances** behind a load balancer for HA and throughput. Because instances share state in PostgreSQL/Redis only, scaling out is linear — but it introduces a race: two instances can simultaneously pass the availability check for the same `(bay, technician, time)` tuple and double-book.

A distributed mutex is required to serialize the check-and-write critical section per resource.

### 4. Distributed locking via Redlock (quorum across independent nodes)

The lock is **not** taken on a single Redis master — async replication loses lock state on failover and causes split-brain (covered as **Phase 2** in the diagram). Instead, the final design (**Phase 3**) uses Redlock:

- **5 independent Redis masters**, different failure domains, **no replication between them**.
- **Acquire:** in parallel, `SET lock NX PX=<ttl>` on all 5; granted iff ≥ 3 succeed AND elapsed time < TTL.
- **Effective validity:** `TTL − elapsed − clock_drift_margin`.
- **Release:** Lua `DEL` that only deletes if the stored value matches the caller's unique token (prevents releasing another client's lock when TTLs overlap).
- **Tolerates** ⌊(N−1)/2⌋ = 2 node failures with no impact on safety.

Lock key shape (one lock per contended resource, not one global lock):

```
lock:bay:{bayId}:{slotStart}
lock:tech:{technicianId}:{slotStart}
```

This keeps contention localized so unrelated bookings proceed in parallel.

**Runtime configuration (best practice):** The scheduler process must start with two distinct Redis configurations: `REDIS_CACHE_URL` for cache-aside availability reads only, and `REDLOCK_NODES` — exactly five comma-separated `redis://` URLs, each pointing at an **independent** Redis master with no replication tying them together. Collapsing lock traffic onto the cache instance defeats the independence assumption in §1 and weakens failover behavior. Local topology matches [`docker-compose.dev.yml`](../../docker-compose.dev.yml) (`redis-cache` plus `redlock-1`…`redlock-5`).

### 5. Booking flow under the lock

```
1. Validate request (vehicle, service type, dealership, desired window).
2. Acquire Redlock on bay + technician keys for the slot window.
3. Re-check availability against PostgreSQL (truth) — cache may be stale.
4. INSERT Appointment in a single transaction; commit.
5. Invalidate / update affected cache entries.
6. Release locks via token-checked Lua DEL.
```

The re-check inside the lock is the safety net: even if the cached availability was stale, the DB read inside the critical section is authoritative.

### 6. Performance targets and capacity notes

| Path | Target | Mechanism |
|---|---|---|
| Availability read (cache hit) | < 5 ms p99 | Redis `GET` |
| Availability read (cache miss) | < 25 ms p99 | PG `SELECT` + cache fill |
| Lock acquire (uncontended) | < 50 ms p99 | parallel `SET NX` to 5 Redis masters, 50 ms per-node timeout |
| Confirm booking end-to-end | < 200 ms p99 | lock + DB tx + cache invalidate |

Per-node Redis timeout (~50 ms) ensures one slow node can't stall acquisition. Lock TTL is chosen ≫ expected critical-section duration but ≪ user-perceived booking latency (e.g. 5 s).

### 7. Failure modes accounted for

- **Single Redis node down** — quorum still reaches 3/5; booking continues.
- **Cache stale or evicted** — DB re-check inside the lock is authoritative.
- **Scheduler instance crashes mid-booking** — lock auto-expires via TTL; no manual cleanup needed.
- **Clock drift / GC pause longer than TTL** — known Redlock caveat; mitigated by drift margin and (optionally) fencing tokens for stronger guarantees. Operational tuning, not architectural change.

### 8. What is *not* in scope of this design

- Geo-distribution / multi-region active-active (single-region is sufficient for one dealership network's load profile).
- Event sourcing / CQRS (CRUD on `Appointment` is well-served by PostgreSQL).
- Read replicas for PostgreSQL — added only if availability cache hit ratio drops below target.
