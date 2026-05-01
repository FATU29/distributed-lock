import { randomUUID } from 'node:crypto';

import { TechnicianId } from '../../src/domain/identifiers/technician-id.vo';
import type {
  CreateTechnicianInput,
  ListTechniciansQuery,
  TechnicianPage,
  TechnicianRepository,
  UpdateTechnicianInput,
} from '../../src/domain/ports';
import { TechnicianNotFoundError } from '../../src/domain/technician/errors';
import { Technician } from '../../src/domain/technician/technician.entity';

export class FakeTechnicianRepository implements TechnicianRepository {
  private readonly items = new Map<string, Technician>();
  private nextCreatedAt = Date.parse('2026-01-01T00:00:00.000Z');

  findById(id: TechnicianId): Promise<Technician | null> {
    return Promise.resolve(this.items.get(id.value) ?? null);
  }

  create(input: CreateTechnicianInput): Promise<Technician> {
    const now = new Date(this.nextCreatedAt);
    this.nextCreatedAt += 1000;
    const id = TechnicianId.from(randomUUID());
    const row = new Technician(
      id,
      input.dealershipId,
      input.name.trim(),
      [...input.qualifiedServiceTypeIds],
      now,
      now,
    );
    this.items.set(id.value, row);
    return Promise.resolve(row);
  }

  list(query: ListTechniciansQuery): Promise<TechnicianPage> {
    const { limit, offset, dealershipId } = query;
    let all = Array.from(this.items.values());
    if (dealershipId !== undefined) {
      all = all.filter((t) => t.dealershipId.value === dealershipId.value);
    }
    all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Promise.resolve({
      total: all.length,
      items: all.slice(offset, offset + limit),
    });
  }

  update(id: TechnicianId, input: UpdateTechnicianInput): Promise<Technician> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new TechnicianNotFoundError(`id=${id.value}`));
    }
    const nextDealership = Object.prototype.hasOwnProperty.call(
      input,
      'dealershipId',
    )
      ? (input.dealershipId ?? existing.dealershipId)
      : existing.dealershipId;
    const nextName = Object.prototype.hasOwnProperty.call(input, 'name')
      ? (input.name?.trim() ?? existing.name)
      : existing.name;
    const nextQuals =
      input.qualifiedServiceTypeIds !== undefined
        ? [...input.qualifiedServiceTypeIds]
        : [...existing.qualifiedServiceTypeIds];
    const updated = new Technician(
      existing.id,
      nextDealership,
      nextName,
      nextQuals,
      existing.createdAt,
      new Date(existing.updatedAt.getTime() + 1000),
    );
    this.items.set(id.value, updated);
    return Promise.resolve(updated);
  }

  delete(id: TechnicianId): Promise<void> {
    if (!this.items.delete(id.value)) {
      return Promise.reject(new TechnicianNotFoundError(`id=${id.value}`));
    }
    return Promise.resolve();
  }
}
