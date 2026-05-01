import { randomUUID } from 'node:crypto';

import { BayId } from '../../src/domain/identifiers/bay-id.vo';
import type {
  CreateServiceBayInput,
  ListServiceBaysQuery,
  ServiceBayPage,
  ServiceBayRepository,
  UpdateServiceBayInput,
} from '../../src/domain/ports';
import { ServiceBayNotFoundError } from '../../src/domain/service-bay/errors';
import { ServiceBay } from '../../src/domain/service-bay/service-bay.entity';

export class FakeServiceBayRepository implements ServiceBayRepository {
  private readonly items = new Map<string, ServiceBay>();
  private nextCreatedAt = Date.parse('2026-01-01T00:00:00.000Z');

  findById(id: BayId): Promise<ServiceBay | null> {
    return Promise.resolve(this.items.get(id.value) ?? null);
  }

  create(input: CreateServiceBayInput): Promise<ServiceBay> {
    const now = new Date(this.nextCreatedAt);
    this.nextCreatedAt += 1000;
    const id = BayId.from(randomUUID());
    const row = new ServiceBay(
      id,
      input.dealershipId,
      input.label.trim(),
      now,
      now,
    );
    this.items.set(id.value, row);
    return Promise.resolve(row);
  }

  list(query: ListServiceBaysQuery): Promise<ServiceBayPage> {
    const { limit, offset, dealershipId } = query;
    let all = Array.from(this.items.values());
    if (dealershipId !== undefined) {
      all = all.filter((b) => b.dealershipId.value === dealershipId.value);
    }
    all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Promise.resolve({
      total: all.length,
      items: all.slice(offset, offset + limit),
    });
  }

  update(id: BayId, input: UpdateServiceBayInput): Promise<ServiceBay> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new ServiceBayNotFoundError(`id=${id.value}`));
    }
    const nextDealership = Object.prototype.hasOwnProperty.call(
      input,
      'dealershipId',
    )
      ? (input.dealershipId ?? existing.dealershipId)
      : existing.dealershipId;
    const nextLabel = Object.prototype.hasOwnProperty.call(input, 'label')
      ? (input.label?.trim() ?? existing.label)
      : existing.label;
    const updated = new ServiceBay(
      existing.id,
      nextDealership,
      nextLabel,
      existing.createdAt,
      new Date(existing.updatedAt.getTime() + 1000),
    );
    this.items.set(id.value, updated);
    return Promise.resolve(updated);
  }

  delete(id: BayId): Promise<void> {
    if (!this.items.delete(id.value)) {
      return Promise.reject(new ServiceBayNotFoundError(`id=${id.value}`));
    }
    return Promise.resolve();
  }
}
