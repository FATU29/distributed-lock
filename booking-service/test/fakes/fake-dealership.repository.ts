import { randomUUID } from 'node:crypto';

import { Dealership } from '../../src/domain/dealership/dealership.entity';
import {
  DealershipCodeAlreadyExistsError,
  DealershipNotFoundError,
} from '../../src/domain/dealership/errors';
import { DealershipId } from '../../src/domain/identifiers/dealership-id.vo';
import type {
  CreateDealershipInput,
  DealershipPage,
  DealershipRepository,
  ListDealershipsQuery,
  UpdateDealershipInput,
} from '../../src/domain/ports';

export class FakeDealershipRepository implements DealershipRepository {
  private readonly items = new Map<string, Dealership>();
  private readonly codeIndex = new Map<string, string>();
  private nextCreatedAt = Date.parse('2026-01-01T00:00:00.000Z');

  findById(id: DealershipId): Promise<Dealership | null> {
    return Promise.resolve(this.items.get(id.value) ?? null);
  }

  create(input: CreateDealershipInput): Promise<Dealership> {
    const code = input.code.trim();
    if (this.codeIndex.has(code)) {
      return Promise.reject(new DealershipCodeAlreadyExistsError(code));
    }
    const now = new Date(this.nextCreatedAt);
    this.nextCreatedAt += 1000;
    const id = DealershipId.from(randomUUID());
    const row = new Dealership(id, code, input.name.trim(), now, now);
    this.items.set(id.value, row);
    this.codeIndex.set(code, id.value);
    return Promise.resolve(row);
  }

  list(query: ListDealershipsQuery): Promise<DealershipPage> {
    const all = Array.from(this.items.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return Promise.resolve({
      total: all.length,
      items: all.slice(query.offset, query.offset + query.limit),
    });
  }

  update(id: DealershipId, input: UpdateDealershipInput): Promise<Dealership> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new DealershipNotFoundError(`id=${id.value}`));
    }
    const nextCode = Object.prototype.hasOwnProperty.call(input, 'code')
      ? (input.code?.trim() ?? existing.code)
      : existing.code;
    const nextName = Object.prototype.hasOwnProperty.call(input, 'name')
      ? (input.name?.trim() ?? existing.name)
      : existing.name;
    if (nextCode !== existing.code) {
      if (
        this.codeIndex.has(nextCode) &&
        this.codeIndex.get(nextCode) !== id.value
      ) {
        return Promise.reject(new DealershipCodeAlreadyExistsError(nextCode));
      }
      this.codeIndex.delete(existing.code);
      this.codeIndex.set(nextCode, id.value);
    }
    const updated = new Dealership(
      existing.id,
      nextCode,
      nextName,
      existing.createdAt,
      new Date(existing.updatedAt.getTime() + 1000),
    );
    this.items.set(id.value, updated);
    return Promise.resolve(updated);
  }

  delete(id: DealershipId): Promise<void> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new DealershipNotFoundError(`id=${id.value}`));
    }
    this.items.delete(id.value);
    this.codeIndex.delete(existing.code);
    return Promise.resolve();
  }
}
