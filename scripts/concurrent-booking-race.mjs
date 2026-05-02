#!/usr/bin/env node
/**
 * Stress POST /bookings with N concurrent clients targeting the same bay,
 * technician, service type, and slot window — exercises Redlock + PG re-check.
 *
 * Prerequisites: booking-service up (e.g. docker compose -f docker-compose.dev.yml up),
 * migrations applied, prisma db seed run inside the service container.
 *
 * Usage:
 *   node scripts/concurrent-booking-race.mjs
 *   BASE_URL=http://localhost:8080 CLIENTS=10 node scripts/concurrent-booking-race.mjs
 *
 * Optional env:
 *   BASE_URL       default http://localhost:8080
 *   CLIENTS        concurrent booking attempts (default 10)
 *   SLOT_START     ISO8601 — overrides automatic next weekday 10:00 UTC slot
 *   SLOT_END       ISO8601 — must be same UTC day as SLOT_START, > SLOT_START
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
);
const CLIENTS = Math.max(1, Number(process.env.CLIENTS ?? '10') || 10);

function isConnectionRefused(err) {
  if (!err) {
    return false;
  }
  if (err.code === 'ECONNREFUSED') {
    return true;
  }
  if (err.cause && isConnectionRefused(err.cause)) {
    return true;
  }
  if (err.name === 'AggregateError' && Array.isArray(err.errors)) {
    return err.errors.some((e) => isConnectionRefused(e));
  }
  return false;
}

function exitIfUnreachable(err, context) {
  if (!isConnectionRefused(err)) {
    return false;
  }
  console.error(`\n${context}`);
  console.error(`Cannot reach ${BASE_URL} (connection refused).`);
  console.error('');
  console.error('Start the API first, for example:');
  console.error('  docker compose -f docker-compose.dev.yml up --build');
  console.error('');
  console.error('Wait until booking-service is listening, then re-run.');
  console.error('Optional: BASE_URL=http://127.0.0.1:8080 node scripts/concurrent-booking-race.mjs');
  process.exit(1);
}

async function getJson(path) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`);
  } catch (err) {
    exitIfUnreachable(err, `GET ${path}`);
    throw err;
  }
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return body;
}

async function postJson(path, payload) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    exitIfUnreachable(err, `POST ${path}`);
    throw err;
  }
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

function nextWeekdaySlotUtc() {
  if (process.env.SLOT_START && process.env.SLOT_END) {
    return {
      slotStart: process.env.SLOT_START,
      slotEnd: process.env.SLOT_END,
    };
  }
  const start = new Date();
  start.setUTCSeconds(0, 0);
  start.setUTCHours(10, 0, 0, 0);
  for (let i = 0; i < 21; i++) {
    const dow = start.getUTCDay();
    if (dow >= 1 && dow <= 5 && start.getTime() > Date.now()) {
      const end = new Date(start);
      end.setUTCHours(11, 0, 0, 0);
      return {
        slotStart: start.toISOString(),
        slotEnd: end.toISOString(),
      };
    }
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(10, 0, 0, 0);
  }
  throw new Error(
    'Could not find a future Mon–Fri slot; set SLOT_START / SLOT_END explicitly.',
  );
}

async function resolveFixtures() {
  const dealerships = await getJson('/dealerships?limit=50');
  const dealership =
    dealerships.items?.find((d) => d.code === 'DEMO-01') ??
    dealerships.items?.[0];
  if (!dealership) {
    throw new Error('No dealership found. Run prisma db seed.');
  }

  const bays = await getJson(
    `/service-bays?dealershipId=${dealership.id}&limit=50`,
  );
  const bay = bays.items?.[0];
  if (!bay) {
    throw new Error('No service bay for dealership. Run prisma db seed.');
  }

  const techs = await getJson(
    `/technicians?dealershipId=${dealership.id}&limit=50`,
  );
  const technician = techs.items?.[0];
  if (!technician) {
    throw new Error('No technician for dealership. Run prisma db seed.');
  }

  const types = await getJson('/service-types?limit=50');
  const serviceType =
    types.items?.find((t) => t.code === 'OIL_CHANGE') ?? types.items?.[0];
  if (!serviceType) {
    throw new Error('No service type found. Run prisma db seed.');
  }

  return {
    dealershipId: dealership.id,
    bayId: bay.id,
    technicianId: technician.id,
    serviceTypeId: serviceType.id,
  };
}

async function createUserWithVehicle(runId, index) {
  const email = `lock-race-${runId}-${index}@example.test`;
  const userRes = await postJson('/users', {
    email,
    displayName: `Lock race ${index}`,
  });
  if (userRes.status !== 201) {
    throw new Error(
      `POST /users failed: ${userRes.status} ${JSON.stringify(userRes.body)}`,
    );
  }
  const customerId = userRes.body.customerId;
  const vin = `LR${runId}${String(index).padStart(2, '0')}`.slice(0, 32);
  const vehRes = await postJson('/vehicles', {
    customerId,
    vin,
    label: `Race vehicle ${index}`,
  });
  if (vehRes.status !== 201) {
    throw new Error(
      `POST /vehicles failed: ${vehRes.status} ${JSON.stringify(vehRes.body)}`,
    );
  }
  return { customerId, vin };
}

async function main() {
  const runId = `${Date.now()}`.slice(-8);
  console.error(`Base URL: ${BASE_URL}`);
  console.error(`Concurrent clients: ${CLIENTS}`);

  const fixtures = await resolveFixtures();
  const slot = nextWeekdaySlotUtc();
  console.error(`Slot: ${slot.slotStart} → ${slot.slotEnd}`);

  const participants = [];
  for (let i = 0; i < CLIENTS; i++) {
    participants.push(await createUserWithVehicle(runId, i));
  }
  console.error(`Created ${CLIENTS} users + vehicles.`);

  const bookingPayload = (p, i) => ({
    customerId: p.customerId,
    vehicleVin: p.vin,
    dealershipId: fixtures.dealershipId,
    bayId: fixtures.bayId,
    technicianId: fixtures.technicianId,
    serviceTypeId: fixtures.serviceTypeId,
    slotStart: slot.slotStart,
    slotEnd: slot.slotEnd,
    idempotencyKey: `race-${runId}-${i}`,
  });

  const results = await Promise.all(
    participants.map(async (p, i) => {
      const started = performance.now();
      const r = await postJson('/bookings', bookingPayload(p, i));
      const ms = Math.round(performance.now() - started);
      return { index: i, ms, status: r.status, body: r.body };
    }),
  );

  const byStatus = new Map();
  for (const r of results) {
    byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  }

  console.log(JSON.stringify({ summary: Object.fromEntries(byStatus), results }, null, 2));

  const wins = results.filter((r) => r.status === 201).length;
  const conflicts = results.filter((r) => r.status === 409).length;
  const lockFails = results.filter((r) => r.status === 503).length;

  console.error(
    `\nExpectation: exactly one 201 (confirmed), rest 409 SLOT_ALREADY_BOOKED and/or 503 LOCK_NOT_ACQUIRED.`,
  );
  console.error(
    `Got: ${wins}×201, ${conflicts}×409, ${lockFails}×503 (other statuses in JSON above).`,
  );

  if (wins > 1) {
    console.error(
      '\nFailing: more than one booking succeeded for the same slot (unexpected).',
    );
    process.exitCode = 1;
  } else if (wins === 0) {
    console.error(
      '\nNo confirmation — slot may already be booked; retry with SLOT_START / SLOT_END or clear appointments.',
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
