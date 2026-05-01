import type { Outbox as OutboxRow } from '@prisma/client';

import { OutboxEntry } from '../../../domain/outbox/outbox-entry.entity';

export function mapOutboxRowToDomain(row: OutboxRow): OutboxEntry {
  return new OutboxEntry(
    row.id,
    row.aggregateType,
    row.aggregateId,
    row.eventType,
    row.payload,
    row.createdAt,
    row.publishedAt,
  );
}
