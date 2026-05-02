# Distributed Lock Evolution — Scheduler Service

Companion notes for [`architecture.mmd`](architecture.mmd).
Each phase below maps 1-to-1 with a subgraph in the diagram. The narrative is "what does this phase add, and what forces us to the next one."

---

## Phase 0 — Why DB, not Redis only?

**Question.** Before we draw any flow, why include a relational DB at all when Redis is faster?

**Option A — Redis only.** App writes and reads everything from Redis.
- RAM-resident; AOF/RDB durability is best-effort (fsync trade-off, replay window on crash).
- No real multi-row ACID transactions — `MULTI/EXEC` has no rollback semantics.
- No JOIN, no foreign keys, weak secondary indexes; impossible to express the kinds of queries booking/admin/reporting need.
- ~10–30× the cost per GB of disk-backed storage.
- No mature ecosystem for backups, migrations, point-in-time restore, BI, or audit.

**Option B — DB only.** App writes and reads everything from PostgreSQL.
- Read latency ~5–10 ms (disk I/O, even with buffer cache).
- ~5k QPS per node; vertical scaling has limits, horizontal scaling for reads is operationally expensive.
- Hot-row contention under heavy concurrent reads.
- Too slow for sub-millisecond paths like slot lookups and lock checks.

**Conclusion.** Each option is missing what the other provides. PostgreSQL must be the system of record (durability, integrity, queries). Redis must front it as a cache (speed, throughput) — and later double as the lock store. Phase 1 implements that combination.

### Concrete scenario — what breaks with Redis only

Alice books a **brake-pad replacement** for her Honda Civic at Dealership `D7`, Bay `B3` with Technician `Tom (T5)`, slot `2026-05-01 09:00–10:30`. She pays a $200 deposit. The `Appointment` row is written only to Redis.

```
10:00:00.000  Alice submits booking
              → Scheduler writes Appointment A-9981 to Redis
                {customer:Alice, vehicle:VIN-H123, bay:B3, tech:T5, start:09:00}
10:00:00.050  Payment service charges $200 deposit  → success
10:00:00.100  Scheduler returns "Appointment confirmed" + sends SMS/email
10:00:30.000  Redis node crashes (kernel panic / hardware fault / OOM kill)
10:00:30.001  AOF buffer holding A-9981 is lost; last fsync was 1 s ago
10:01:00.000  Redis restarts from disk; Appointment A-9981 does not exist
```

**Outcome.** Alice has a $200 charge on her card, a confirmation email, and **no appointment in the system**. The next morning she drives to Dealership D7 — Bay B3 is occupied by a walk-in, Tom is mid-job on another vehicle, and the service advisor finds no record of her booking. Support must manually reconcile from Stripe logs. Multiply by hundreds of appointments per crash → service operations grind to a halt and customer trust collapses.

The root cause is that Redis durability is best-effort: between fsyncs, in-flight writes live only in RAM. For appointment records that drive physical resources (bays, technicians, customer arrivals), that is not acceptable.

### Concrete scenario — what breaks with DB only

Toyota issues a **Takata airbag recall** affecting 12,000 vehicles serviced by this dealership network. The recall notification email goes out at 09:00 on a Monday. Within the first minute, thousands of owners open the appointment booking page to claim a slot.

```
09:00:00  10,000 simultaneous appointment-page loads across the dealership network
09:00:01  Each page renders ~12 SELECTs (dealerships, bays, technicians,
          available slots in next 14 days, vehicle history, recall details…)
          → 120,000 queries in flight against PostgreSQL
09:00:02  DB connection pool (200 connections) saturates
09:00:03  Queries queue; per-request latency rises from 8 ms to 4 s
09:00:10  Scheduler threads block on DB calls; HTTP requests time out
09:00:30  Customers see spinning loaders; many refresh, doubling load
09:00:45  PostgreSQL CPU pinned at 100%; replicas can't keep up either
09:01:00  Customers abandon and call the dealership phone line instead.
          Phones ring off the hook; service advisors can't answer.
```

**Outcome.** The DB is technically up — no data loss — but the user-visible system is dead during the exact window the recall demands. PostgreSQL caps out around 5k QPS per node on this workload, and adding read replicas takes minutes to spin up and only helps read-heavy paths, not hot rows like "available slots for Bay B3 at Dealership D7 this week." Customer-facing booking is functionally offline; the dealership falls back to phone bookings, which scales worst of all.

The root cause is that disk-backed storage cannot serve a sub-millisecond hot read path at recall-event scale, no matter how well-tuned. You need a layer of RAM in front of it.

---

## Phase 1 — Cache-Aside (Redis cache + DB truth)

**Goal.** Combine the two stores so reads stay fast and writes stay durable.

**Flow.** Standard cache-aside, three steps on a read:

1. App `GET` from Redis.
2. On miss, app `SELECT` from PostgreSQL.
3. App `SET` the row back into Redis with a TTL so it expires.

Writes go to PostgreSQL first (source of truth) and either invalidate or update the cache entry.

**Why this works.** The hot read path is sub-millisecond from Redis; the write path stays ACID through the DB; cache misses fall back gracefully.

**Downside that drives Phase 2.**
The scheduler runs as multiple instances (HA / horizontal scaling). When two instances act on the same booking slot at the same time — issuing reads, checking availability, then writing — they race. Cache-aside doesn't serialize anything. We need a **distributed mutex** so that for a given resource, only one scheduler holds the critical section.

### Concrete scenario — what the dotted "miss" arrow on the diagram means

The Phase 1 subgraph in [`architecture.mmd`](architecture.mmd) has a dotted edge `Cache1 -. "miss" .-> App1`. That arrow is the cache-aside fall-back path: the scheduler asked Redis for a key, Redis answered "I don't have it", and the scheduler must drop down to PostgreSQL to get the truth. The arrow is dotted (not solid) because it does *not* fire on every request — only when the cache lookup fails to find the value. Walking through one concrete miss makes the three-step flow obvious.

**Why a key might be absent from Redis (any one of these triggers a miss):**

1. **First read after the cache was provisioned.** The dealership opened booking for `2026-05-01` an hour ago and nobody has yet asked about Bay `B3` at 09:00, so `avail:bay:B3:2026-05-01T09:00` has never been written to Redis.
2. **TTL expired.** A previous read cached the value with `EX 60` (60-second TTL) and 61 seconds have now passed.
3. **Invalidated by a recent write.** Another scheduler just confirmed an appointment that affects Bay B3's day-view, and the write path called `DEL avail:bay:B3:2026-05-01T09:00` to prevent serving stale availability.
4. **Evicted under memory pressure.** Redis hit `maxmemory` and the eviction policy (`allkeys-lru` / `allkeys-lfu`) chose this key to drop.
5. **Redis node restarted or resharded.** The node holding this key was rebooted or the slot moved during a cluster resize, and its in-memory working set is cold again.

**Walking through a miss — Bob is the first customer of the morning to ask about Bay B3 at 09:00:**

```
T = 0 ms      Bob → Scheduler #2:
                GET /availability?dealership=D7&bay=B3&start=2026-05-01T09:00

T = 1 ms      Step 1 of cache-aside — GET from Redis:
                redis> GET avail:bay:B3:2026-05-01T09:00
                (nil)
              ← This is the "miss" arrow on the diagram. Redis has no value
                for this key, so the scheduler cannot answer from cache.

T = 2 ms      Step 2 of cache-aside — SELECT from PostgreSQL (the truth):
                SELECT 1 FROM appointments
                  WHERE bay_id = 'B3'
                    AND start  = '2026-05-01T09:00';
                → 0 rows
              Bay B3 is genuinely free at that time.

T = 9 ms      Step 3 of cache-aside — populate Redis so future reads stay fast:
                redis> SET avail:bay:B3:2026-05-01T09:00 "free" EX 60

T = 10 ms     Scheduler #2 → Bob: "Bay B3 is free at 09:00."
              Bob's overall availability check took ~10 ms (DB I/O dominated).

T = 50 ms     Alice's browser asks about the same slot.
              Step 1 — GET avail:bay:B3:2026-05-01T09:00 → "free"
              ← Cache HIT this time. No PostgreSQL round trip.
              Total latency: ~1 ms (Redis GET only).
              Alice's render is 10× faster than Bob's, and the DB was untouched.
```

**Why the miss path is still fast enough.**

- Bob pays ~10 ms for the cold lookup; every subsequent reader for the same key in the next 60 seconds pays ~1 ms. With a recall page rendering the same 12 availability rows for thousands of visitors, the cache-hit ratio is structurally above 95% and the system can serve the burst without ever overloading PostgreSQL — exactly the failure mode that killed Phase 0's "DB only" option.
- A miss rate consistently above ~5–10% is a *signal*, not a problem in itself: TTLs are too short, the working set doesn't fit in Redis's `maxmemory`, or the write path is invalidating too aggressively.

**Why a miss is not an error.** The dotted arrow on the diagram is the *normal* fall-back path; the cache is an optimization layered in front of PostgreSQL, not a parallel source of truth. If Redis is down entirely, every read is effectively a miss, and the scheduler still answers correctly — just slower. This is a deliberate property: PostgreSQL stays the only system that can confirm an appointment, and Redis is allowed to fail "open" without corrupting bookings.

**Where the miss path can still hurt — the cache stampede.** If thousands of requests arrive for the same uncached key at the exact same instant (e.g. the recall email blast in Phase 0), all of them miss simultaneously, all of them fall through to PostgreSQL, and the DB sees a thundering-herd burst behind a single hot key. Standard mitigations are *request coalescing* (one fetch per process, the rest wait on a future) and *single-flight* via a short-lived lock (`SET ttl_lock:<key> NX EX 2` — only the lock holder fills the cache; everyone else retries the GET after a few milliseconds). These are tuning details on top of cache-aside, not a redesign.

### Concrete scenario — the race that motivates locking

At Dealership `D7`, Bay `B3` and Technician `Tom (T5)` are both free for the slot `2026-05-01 09:00–10:30`. Two customers want that exact slot:

- **Alice**, Honda Civic, requesting a **brake-pad replacement** (90 min, requires a brake-certified tech — Tom qualifies).
- **Bob**, Toyota Camry, requesting a **major service** (90 min, also requires Tom).

Both click "Confirm appointment" within milliseconds of each other. The load balancer routes Alice to **Scheduler instance #1** and Bob to **Scheduler instance #2**.

```
T = 0 ms      Alice → Scheduler #1:
                POST /appointments {vehicle:VIN-H123, service:BRAKES,
                                    dealership:D7, start:2026-05-01T09:00}
T = 5 ms      Bob   → Scheduler #2:
                POST /appointments {vehicle:VIN-T456, service:MAJOR_SERVICE,
                                    dealership:D7, start:2026-05-01T09:00}

T = 6 ms      Scheduler #1: GET avail:bay:B3:2026-05-01T09:00 from Redis  → "free"
              GET avail:tech:T5:2026-05-01T09:00 from Redis  → "free"
T = 8 ms      Scheduler #2: GET avail:bay:B3:2026-05-01T09:00 from Redis  → "free"
              GET avail:tech:T5:2026-05-01T09:00 from Redis  → "free"
              (both instances see the same "free" state — neither knows of the other)

T = 12 ms     Scheduler #1: BEGIN TX
              SELECT 1 FROM appointments
                WHERE bay_id=B3 AND start='2026-05-01T09:00' FOR UPDATE
                → 0 rows (passes the "is the bay free?" check)
              SELECT 1 FROM appointments
                WHERE technician_id=T5 AND start='2026-05-01T09:00'
                → 0 rows (Tom is free)

T = 14 ms     Scheduler #2: BEGIN TX (separate transaction, separate connection)
              Same two SELECTs → both return 0 rows. Bob's request also
              passes the availability check, because Scheduler #1's
              transaction hasn't committed yet.

T = 18 ms     Scheduler #1:
              INSERT appointment A-1001
                (Alice, VIN-H123, bay:B3, tech:T5, 09:00–10:30, BRAKES)
              COMMIT

T = 22 ms     Scheduler #2:
              INSERT appointment A-1002
                (Bob, VIN-T456, bay:B3, tech:T5, 09:00–10:30, MAJOR_SERVICE)
              COMMIT
              ← Unless there is a uniqueness constraint on (bay_id, start) AND
                (technician_id, start), this commit succeeds. Even with a
                constraint, Scheduler #2 just sees a 500 error after the
                customer has already been told their card is being processed.

T = 25 ms     Scheduler #1 → Alice: "Appointment A-1001 confirmed"
T = 28 ms     Scheduler #2 → Bob:   "Appointment A-1002 confirmed"
```

**Outcome.** Two confirmed appointments point at the same physical bay and the same technician for the same 90-minute window. At 09:00 the next day, both Alice and Bob arrive at Dealership D7. The service advisor has two work orders for Bay B3 / Tom. One customer must be turned away and rebooked; their car has already been dropped off, the keys handed over, the courtesy ride home arranged. The dealership eats the inconvenience cost and a 1-star Google review.

**Why cache-aside alone can't fix this.** Reading from cache vs. reading from DB doesn't matter — the race is between the *availability check* and the *insert*, across two processes. Even if both schedulers had bypassed the cache and read straight from PostgreSQL, default `READ COMMITTED` isolation lets both see "Bay B3 free, Tom free" until one of them commits. Workarounds inside a single DB (`SELECT … FOR UPDATE` on a sentinel row, `SERIALIZABLE` isolation, exclusion constraints with `tstzrange`) can be made to work but are slow under contention, fragile across schema changes, and don't help when the critical section spans more than the DB — e.g. calling the parts-inventory service to reserve brake pads, or charging a deposit through Stripe, before the appointment is committed. The clean fix is to put a **named mutex** in front of the whole check-and-write block, keyed on the contended physical resources: `lock:bay:B3:2026-05-01T09:00` and `lock:tech:T5:2026-05-01T09:00`.

---

## Phase 2 — Lock on a single Redis master

**Goal.** Add a distributed mutex using Redis itself (we already have it, it's fast).

**Flow.**

1. Scheduler A acquires the lock with `SET lock NX PX=<ttl>` against the Redis master. Succeeds.
2. The master is supposed to replicate the write to its replica asynchronously, but it **crashes before replication completes**.
3. Failover kicks in: the replica is promoted to master.
4. Scheduler B issues `SET lock NX PX=<ttl>` against the new master. The replica never received the lock from step 1, so the key doesn't exist — Scheduler B succeeds too.

**Result.** Both A and B believe they hold the lock for the same resource → **split-brain** → corrupted bookings.

**Downsides that drive Phase 3.**
- Async replication means lock state isn't durable across failover.
- The single master is a SPOF; HA via replica creates the very split-brain we're trying to prevent.
- Tightening to synchronous replication kills the latency benefit and still risks split-brain on partitions.

The fix is structural: stop relying on replication for lock state. Use multiple **independent** Redis masters and require a majority.

### Concrete scenario — split-brain through failover

Same contended slot as before: Bay `B3`, Technician `Tom (T5)`, Dealership `D7`, `2026-05-01 09:00`. Alice (brakes) and Bob (major service) are again competing. This time we have a single Redis master (`redis-m1`) with one async replica (`redis-r1`) and Sentinel watching for failover.

```
T = 0 ms      Alice → Scheduler A.  Bob → Scheduler B.

T = 5 ms      Scheduler A → redis-m1:
                SET lock:bay:B3:2026-05-01T09:00   "tokenA-uuid"  NX  PX 10000
                SET lock:tech:T5:2026-05-01T09:00  "tokenA-uuid"  NX  PX 10000
              redis-m1 responds OK to both. Scheduler A holds both locks for 10 s.

T = 6 ms      redis-m1 begins async replication of the two lock keys to redis-r1
              (replication is fire-and-forget; m1 has already ACKed Scheduler A)

T = 7 ms      ⚡ redis-m1 hardware failure (PSU dies / kernel panic / EC2 host retire).
              The lock keys have NOT yet been replicated to redis-r1.

T = 8 ms      Scheduler A begins its critical section, believing it holds the locks.
              Re-reads availability from PostgreSQL → Bay B3 free, Tom free.
              Starts building the Appointment row but hasn't COMMITted yet.

T = 800 ms    Sentinel quorum declares m1 down and promotes redis-r1 to master.
              redis-r1 has no record of either lock key — the SETs never
              reached it before m1 died.

T = 850 ms    Scheduler B → redis-r1 (the new master):
                SET lock:bay:B3:2026-05-01T09:00   "tokenB-uuid"  NX  PX 10000
                SET lock:tech:T5:2026-05-01T09:00  "tokenB-uuid"  NX  PX 10000
              redis-r1 responds OK to both — the keys don't exist there, so NX
              succeeds. Scheduler B now also "holds" both locks.

T = 870 ms    Scheduler B begins its critical section.
              Re-reads PostgreSQL → still no committed appointment for that bay/tech.
              Decides Bob gets the slot.

T = 900 ms    Scheduler A:  INSERT appointment A-2001
                            (Alice, bay:B3, tech:T5, 09:00–10:30, BRAKES); COMMIT.
T = 920 ms    Scheduler B:  INSERT appointment A-2002
                            (Bob,   bay:B3, tech:T5, 09:00–10:30, MAJOR);  COMMIT.

T = 950 ms    Both schedulers send token-checked DEL to the (now sole) master
              and return "Appointment confirmed" to their respective customers.
```

**Outcome.** Two clients each held what they believed were the same exclusive locks on bay `B3` and technician `T5` — classic **split-brain** — and double-booked the slot. From the application's point of view, every `SET NX` returned OK and every release succeeded; nothing in the protocol revealed that the lock state was lost in failover. The same physical bay and technician are now committed to two different work orders, and the service advisor will discover the conflict only when both customers arrive in the morning.

**Why "just turn on synchronous replication" doesn't fix it.** Synchronous replication trades the failure window for a latency window: every lock acquire now waits for at least one replica ACK, blowing the sub-50 ms acquire budget the booking flow was designed for. Worse, it still doesn't survive a network partition where the master is reachable from the scheduler but not from its replica — under partition the system has to choose between availability (proceed without the replica, recreating the original bug) or consistency (refuse to acquire, halting all appointment confirmations across the dealership network). Either way, the single-master topology is structurally wrong for safety-critical resource locking. Phase 3 removes the dependency on replication entirely.

---

## Phase 3 — Redlock quorum (final design)

**Goal.** A distributed lock that survives node failures and partitions without ever granting the same lock twice.

**Setup.** Five Redis masters, deployed independently — different machines, different failure domains. **No replication between them.**

**Acquire algorithm.**

1. Record start time `T₀`.
2. In parallel, send `SET lock NX PX=<ttl>` to all 5 masters, each with a small per-node timeout (e.g. 50 ms) so a slow node can't stall acquisition.
3. Count successes. The lock is **granted** iff:
    - successes ≥ ⌊N/2⌋ + 1 = **3 of 5**, AND
    - elapsed time `(T_now − T₀)` is still **< TTL** (otherwise the lock would already be expiring as we hand it out).
4. The effective lock validity is `TTL − elapsed − clock_drift_margin`.
5. If the quorum check fails, release on every node (best-effort `DEL` with the right token) and retry after a randomized backoff.

**Release.** Send a Lua `DEL` that only deletes if the stored value matches the caller's unique token, on all nodes. This prevents one client from releasing another client's lock when TTLs overlap.

**Why this is the final phase.**
- Tolerates up to ⌊(N−1)/2⌋ = 2 node failures with no impact on safety.
- No replication means no replication lag, no split-brain on failover.
- Quorum + TTL + token-checked release covers the failure modes from Phases 1 and 2.
- Symmetric (no leader), so reasoning, deployment, and operations stay simple.

The known caveats (clock drift assumptions, GC pauses longer than TTL, fencing tokens for stronger guarantees) are operational concerns, not architectural ones — they're tuned, not redesigned.

### Concrete scenario — Redlock saves the day (2 nodes down)

Same contended slot — Bay `B3`, Technician `Tom (T5)`, `2026-05-01 09:00` — now running against 5 independent Redis masters (`r1…r5`) in different availability zones. There is **no replication** between them. The scheduler must lock both the bay key and the technician key; for clarity below we show acquisition of `lock:bay:B3:2026-05-01T09:00` (the technician key follows the same flow).

```
T = 0 ms      Scheduler A: record T0 = now()
T = 0 ms      Scheduler A → r1, r2, r3, r4, r5 in parallel:
                SET lock:bay:B3:2026-05-01T09:00  "tokenA-uuid"  NX  PX 10000
              with a 50 ms per-node timeout.

T = 8 ms      r1 → OK
T = 9 ms      r2 → OK
T = 50 ms     r3 → timeout (AZ partition; r3 unreachable from this scheduler)
T = 50 ms     r4 → timeout (r4 host doing a slow GC of its own)
T = 12 ms     r5 → OK

              Successes: 3 of 5. Quorum reached.
              Elapsed: 50 ms. TTL: 10000 ms. Effective validity ≈ 9950 ms − drift.
              Scheduler A holds the lock.

T = 60 ms     Scheduler B → same 5 nodes in parallel for the same key:
                r1, r2, r5 reply with NX-rejection (already held by tokenA).
                r3 still unreachable; r4 → OK.
              Successes: 1 of 5 (or 2 of 5 if r3 recovers in time).
              No quorum. Scheduler B releases on every node (best-effort token-checked
              DEL) and backs off with jitter, then retries.

T = 100 ms    Scheduler A safely runs the critical section:
                - Re-checks PostgreSQL: Bay B3 free, Tom free.
                - INSERT Appointment A-3001 (Alice, B3, T5, 09:00, BRAKES); COMMIT.
                - Invalidates avail:* cache entries.
                - Sends token-checked DEL to all 5 nodes.
```

**Outcome.** Two of five Redis nodes are simultaneously unavailable (a partition + a slow node), and the lock still works correctly: Alice's request succeeds, Bob's request is correctly told to wait. Compare with Phase 2, where a *single* node failure was enough to cause split-brain. With Redlock, the system tolerates ⌊(N−1)/2⌋ = 2 node failures with no impact on safety.

### Concrete scenario — the remaining caveat (GC pause longer than TTL)

Redlock is not magic — it provides mutual exclusion under the assumption that the lock holder makes timely progress. If the holder's process is paused (long GC, CPU starvation, swapping, hypervisor freeze, debugger breakpoint left on in prod by a half-asleep on-call), the lock can expire in the outside world while the holder still believes it owns it.

```
T = 0 s       Scheduler A acquires Redlock on
                lock:bay:B3:2026-05-01T09:00 + lock:tech:T5:2026-05-01T09:00
              TTL = 10 s, validity ≈ 9.95 s.
T = 0.5 s     Scheduler A re-reads availability from PostgreSQL → both free.
              About to INSERT the Appointment for Alice.
T = 1.0 s     ⚡ JVM full-GC begins on Scheduler A's host. Process frozen.

T = 11.0 s    Lock TTL expired on all 5 Redis nodes ~1 s ago.
              Scheduler B acquires the same two locks cleanly via quorum.
              Re-reads PostgreSQL: still no committed appointment for that bay/tech.
              INSERT Appointment A-4001 (Bob, B3, T5, 09:00, MAJOR_SERVICE); COMMIT.

T = 13.0 s    Scheduler A's GC finishes. Process resumes exactly where it left off,
              still holding "tokenA-uuid" in memory and still believing it owns
              the locks.
              INSERT Appointment A-4002 (Alice, B3, T5, 09:00, BRAKES); COMMIT.
              ← A double-booking is now persisted in PostgreSQL.

T = 13.1 s    Scheduler A sends token-checked DEL to the 5 nodes.
              Every node rejects: the value there is now tokenB-uuid (or absent
              after Scheduler B's release). Scheduler A has been silently
              un-locked for ~2 seconds while it wrote.
```

**Outcome.** A double-booking similar to Phase 1, but caused by a *time* failure rather than a *replication* failure. The lock protocol behaved correctly; the holder just stopped existing for longer than the TTL, and PostgreSQL had no way to know the writer's "permission" had expired.

**Operational mitigations (not architectural redesign):**
- **Tune TTL well above realistic worst-case pause.** If P99 GC pause on the scheduler JVM is 200 ms, a 10 s TTL is comfortable; 500 ms would not be. Booking critical sections target ~100 ms (DB tx + cache invalidate), so the TTL has 100× headroom.
- **Re-check lock validity right before the irreversible write.** Compute `remaining = T0 + TTL − now()`; if remaining is below a safety margin (e.g. 20% of TTL), abort, release best-effort, and let the next acquirer proceed.
- **Use fencing tokens for the strongest guarantee.** Each successful acquire returns a monotonically increasing token. PostgreSQL stores `last_fencing_token` per `(bay_id, slot_start)` and per `(technician_id, slot_start)` and rejects any `INSERT INTO appointments` whose token is not strictly greater than the stored value. Even if Scheduler A wakes up from a 12 s pause, its token is now stale and the DB refuses its insert. This converts "trust the lock" into "the resource itself enforces ordering" and is the textbook fix for the GC-pause class of failure.

These are tuning knobs and a small schema addition — the lock topology itself doesn't change.

---

## Phase 4 — Outbox + Kafka events (production best practice)

**Goal.** Phase 3 made the *booking decision* safe: only one scheduler ever wins the slot for Bay `B3` + Technician `Tom (T5)` at `2026-05-01 09:00`. But the moment we say "Appointment confirmed" to Alice, a flock of side-effects must follow — SMS confirmation, deposit capture in Stripe, parts-inventory reservation for the brake pads, Tom's calendar / roster update, BI ingestion, audit log, dealership ops dashboard. Cramming all of them into the synchronous request path is the next failure mode this phase removes.

**Why this is the next phase, not part of Phase 3.**
Phase 3 solves *consistency of the booking decision.* Phase 4 solves *consistency of everything that flows from it.* They are orthogonal problems — combining them in one diagram would muddle the lock story. Phase 4 layers on top of an already-safe Phase 3 booking flow.

### The dual-write problem this phase exists to fix

Without an outbox + event log, the scheduler ends up doing one of these in the request path. Both are broken:

1. **Insert appointment, then call N downstream services in-line.**
   - Booking latency = sum (or max, if parallel) of every downstream latency: SMS gateway, Stripe, parts service, roster, analytics, audit.
   - One slow service (parts inventory at 800 ms p99) makes every booking feel sluggish.
   - One *failed* service (SMS provider returns 500) puts the scheduler in a bad spot: was the appointment created? rolled back? half-done? The customer already saw a spinner and may retry, generating duplicate appointments.

2. **Commit the appointment first, then publish events on a best-effort basis.**
   - The classic *dual-write hazard*: if the scheduler crashes (or the network blips, or the SMS service is unreachable) between the DB commit and the publish, the appointment exists in PostgreSQL but downstream services never hear about it. Tom's roster never gets updated, brake pads never get reserved, the audit log is missing the event. There is no general way to recover from this without manual reconciliation.

The fix is the **transactional outbox** pattern, with **Kafka** as the durable, replayable log that fans events out to consumers.

### Components added in Phase 4

- **`outbox` table in PostgreSQL.** A row is `INSERT`ed in the *same transaction* as the appointment. Schema is roughly:
  ```sql
  CREATE TABLE outbox (
      id            uuid        PRIMARY KEY,
      aggregate_id  text        NOT NULL,   -- e.g. appointment_id
      event_type    text        NOT NULL,   -- 'AppointmentConfirmed'
      payload       jsonb       NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now(),
      published_at  timestamptz                        -- set by the relay
  );
  ```
- **CDC relay** — log-based change-data-capture (Debezium tailing PostgreSQL's WAL) or a lightweight outbox poller. It reads new outbox rows and publishes them to Kafka, marking `published_at = now()` after the broker ACKs.
- **Kafka cluster** — topics keyed by `aggregate_id` so all events for a given appointment land on the same partition, preserving order. Configured with replication factor 3, `min.insync.replicas = 2`, `acks = all` for the producer.
- **Topics:** `appointment.events` (and a parallel `appointment.events.dlq` for failed deliveries).
- **Consumer groups** — each downstream service runs its own consumer group with at-least-once semantics and **idempotent** handlers (deduplicate by event id stored per consumer).

### Booking flow under Phase 4

```
1. Scheduler acquires Redlock on bay + technician keys.            [Phase 3]
2. Re-checks availability against PostgreSQL.                      [Phase 3]
3. BEGIN TX
     INSERT INTO appointments (...);
     INSERT INTO outbox (event_type='AppointmentConfirmed',
                         aggregate_id=<appointment_id>,
                         payload={appointment_id, customer, vehicle,
                                  bay, technician, start, service, ...});
   COMMIT                                                          [Phase 4]
4. Release Redlock via token-checked Lua DEL.                      [Phase 3]
5. Return "Confirmed" to the customer (~150 ms hot path).          [Phase 4]

   ----- async, off the request path -----
6. CDC relay reads the new outbox row, publishes to Kafka topic
   `appointment.events` with key = appointment_id.
7. Independent consumer groups process the event:
     - notification-svc → SMS + email + push
     - billing-svc      → capture $200 deposit on Stripe
     - parts-svc        → reserve brake pads SKU-BP-7741
     - roster-svc       → update Tom's calendar block
     - analytics-svc    → emit booking funnel event
     - audit-svc        → append to immutable audit log
```

The customer's HTTP response no longer waits on any of the side-effects. The hot path stays at ~150 ms p99 even when the SMS provider is having a bad afternoon.

### Concrete scenario — recall storm without Kafka vs. with Kafka

The Toyota airbag recall fires again. **10,000 customers confirm appointments over 5 minutes** (~33 / second sustained). Each confirmation triggers 6 side-effects → 60,000 downstream work items. Two of the six downstream services are degraded: the **SMS provider (Twilio) is at 30% error rate** for 90 seconds, and the **parts inventory service is mid-GC** and responding at 800 ms p99 instead of 50 ms.

**Without Kafka — synchronous fan-out in the scheduler:**

```
T = 0 s     Recall blast goes out.
T = 5 s     Bookings arrive at 33/sec. Each booking calls 6 services in-line.
            P99 booking latency = max(SMS retries, Stripe, parts, roster, BI, audit)
                                ≈ 800 ms (parts GC) + Twilio retries

T = 30 s    Scheduler thread pool saturates waiting on parts-svc + Twilio.
            New requests queue, then time out (HTTP 504).

T = 60 s    Customers retry; some appointments get inserted twice
            because there's no idempotency key on POST /appointments.
            Service advisors start getting calls: "I booked twice by accident."

T = 120 s   Twilio recovers. But the scheduler has been returning 504s
            for ~90 seconds. We don't know which appointments got SMS
            and which didn't — there's no durable record of what was
            attempted. The appointments table tells us nothing about
            notification status.

T = 1 hr    Ops team manually queries `appointments`, queries Twilio's
            sent-message API, diffs them, and triggers SMS for the gap.
            Same for parts reservations. ~6 hours of toil.
            Several customers showed up the next morning to find the
            parts they needed weren't on the shelf.
```

**With Kafka (Phase 4):**

```
T = 0 s     Recall blast goes out.
T = 5 s     Bookings arrive at 33/sec.
            Scheduler hot path: DB tx (appointment + outbox row) +
            lock release = ~150 ms.
            Customer sees "Confirmed" within 200 ms regardless of
            downstream state.

T = 6 s     CDC relay tails PostgreSQL WAL, publishes 33 events/sec
            to `appointment.events`. Lag stays under 1 s.

T = 6 s     Consumer groups process in parallel and independently:
              - notification-svc: hitting Twilio with 30% errors
                → failures retry from Kafka with exponential backoff;
                events that exhaust retries land on `appointment.events.dlq`.
              - parts-svc: processing at 800 ms each
                → consumer lag grows on its partition only; other
                consumer groups (roster, BI, audit) are unaffected
                and finish on schedule.
              - billing-svc, roster-svc, audit-svc: all complete promptly.

T = 60 s    Twilio recovers. Notification consumer drains the DLQ
            automatically (replay from offset). All 10,000 SMS go out.

T = 5 min   Parts service GC pause ends. Parts consumer catches up its
            lag without dropping work — the events were sitting in
            Kafka the whole time, durably.
            Zero manual reconciliation. No booking ever blocked on a
            downstream service. No customer saw a 504.
```

**Outcome.** Same workload, same downstream issues — but the customer-facing booking funnel never degraded, no events were lost, and recovery was automatic. The dual-write hazard is gone because the appointment and its outbox event are written in the *same DB transaction*; the relay then guarantees at-least-once publish; idempotent consumers turn that into effectively-once processing.

### Why Kafka specifically (vs. RabbitMQ / SQS / NATS)

- **Per-key ordering via partitions.** Partitioning by `appointment_id` guarantees all events for one booking are processed in order by each consumer group. Important for sequences like `AppointmentConfirmed` → `AppointmentRescheduled` → `AppointmentCanceled`.
- **Replayability.** A new consumer (e.g. a fraud-detection service added a year later, or a new BI dashboard) can rewind to offset 0 and rebuild state from the booking history. Brokers like RabbitMQ delete messages on ack; Kafka keeps the log for the configured retention.
- **Throughput headroom.** A single broker handles ~100k msgs/sec at our payload size; the entire dealership network fits comfortably on a 3-broker cluster with room for 10× growth.
- **Strong durability.** `acks=all` + `min.insync.replicas=2` on a 3-broker cluster survives one broker loss without data loss.
- **Mature CDC ecosystem.** Debezium → Kafka is the textbook outbox-relay pattern, deployed in production at thousands of companies, with off-the-shelf connectors for PostgreSQL.

### Operational guardrails

- **Idempotency in every consumer.** Each event carries a UUID; consumers store `processed_event_id` per `(consumer_group, event_id)` and skip duplicates. At-least-once + idempotency = effectively-once.
- **DLQ topics with alerts.** Failed events go to `appointment.events.dlq`; an alert fires when DLQ depth exceeds threshold.
- **Outbox janitor.** A periodic job deletes outbox rows older than the retention window (e.g. 30 days) where `published_at IS NOT NULL`, to keep the table small.
- **Schema registry.** Avro / Protobuf via Confluent Schema Registry so producers and consumers can evolve event schemas without coordinated deploys.
- **Monitor relay lag.** Page on-call when `now() − max(outbox.created_at WHERE published_at IS NULL)` exceeds 30 s — that is the *real* booking-to-side-effect SLO.

### What is *not* solved by Phase 4

- The booking decision itself — that is Phase 3's job. Phase 4 trusts the appointment is already correctly committed before the event is published.
- Cross-service rollback (e.g. "if Stripe charge fails, undo the appointment"). For that, downstream services emit *compensating* events (`PaymentFailed` → scheduler emits `AppointmentVoided`) — the **saga pattern**, layered on top of the same Kafka topology.

---

## Phase progression at a glance

| From | Forced by | To |
|---|---|---|
| Phase 0 | DB-only too slow, Redis-only unsafe | Phase 1 — combine the two |
| Phase 1 | scheduler instances race on shared state | Phase 2 — add a mutex |
| Phase 2 | async replication causes split-brain on failover | Phase 3 — quorum across independent nodes |
| Phase 3 | synchronous side-effects + dual-write hazard | Phase 4 — outbox + Kafka |
| Phase 4 | — | final |
