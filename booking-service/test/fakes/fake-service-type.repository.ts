import { randomUUID } from 'node:crypto';

import { ServiceTypeId } from '../../src/domain/identifiers/service-type-id.vo';
import type {
  CreateServiceTypeInput,
  ListServiceTypesQuery,
  ServiceTypePage,
  ServiceTypeRepository,
  UpdateServiceTypeInput,
} from '../../src/domain/ports';
import {
  ServiceTypeCodeAlreadyExistsError,
  ServiceTypeNotFoundError,
} from '../../src/domain/service-type/errors';
import { ServiceTypeSpec } from '../../src/domain/service-type/service-type-spec.vo';

export class FakeServiceTypeRepository implements ServiceTypeRepository {
  private readonly items = new Map<string, ServiceTypeSpec>();
  private readonly codeIndex = new Map<string, string>();
  private nextCreatedAt = Date.parse('2026-01-01T00:00:00.000Z');

  findById(id: ServiceTypeId): Promise<ServiceTypeSpec | null> {
    return Promise.resolve(this.items.get(id.value) ?? null);
  }

  create(input: CreateServiceTypeInput): Promise<ServiceTypeSpec> {
    const code = input.code.trim();
    if (this.codeIndex.has(code)) {
      return Promise.reject(new ServiceTypeCodeAlreadyExistsError(code));
    }
    const now = new Date(this.nextCreatedAt);
    this.nextCreatedAt += 1000;
    const id = ServiceTypeId.from(randomUUID());
    const row = new ServiceTypeSpec(
      id,
      code,
      input.name.trim(),
      input.durationMinutes,
      input.requiredSkillTag,
      now,
      now,
    );
    this.items.set(id.value, row);
    this.codeIndex.set(code, id.value);
    return Promise.resolve(row);
  }

  list(query: ListServiceTypesQuery): Promise<ServiceTypePage> {
    const all = Array.from(this.items.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return Promise.resolve({
      total: all.length,
      items: all.slice(query.offset, query.offset + query.limit),
    });
  }

  update(
    id: ServiceTypeId,
    input: UpdateServiceTypeInput,
  ): Promise<ServiceTypeSpec> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new ServiceTypeNotFoundError(`id=${id.value}`));
    }
    const nextCode = Object.prototype.hasOwnProperty.call(input, 'code')
      ? (input.code?.trim() ?? existing.code)
      : existing.code;
    const nextName = Object.prototype.hasOwnProperty.call(input, 'name')
      ? (input.name?.trim() ?? existing.name)
      : existing.name;
    const nextDuration = Object.prototype.hasOwnProperty.call(
      input,
      'durationMinutes',
    )
      ? (input.durationMinutes ?? existing.durationMinutes)
      : existing.durationMinutes;
    const nextSkill = Object.prototype.hasOwnProperty.call(
      input,
      'requiredSkillTag',
    )
      ? (input.requiredSkillTag ?? null)
      : existing.requiredSkillTag;
    if (nextCode !== existing.code) {
      if (
        this.codeIndex.has(nextCode) &&
        this.codeIndex.get(nextCode) !== id.value
      ) {
        return Promise.reject(new ServiceTypeCodeAlreadyExistsError(nextCode));
      }
      this.codeIndex.delete(existing.code);
      this.codeIndex.set(nextCode, id.value);
    }
    const updated = new ServiceTypeSpec(
      existing.id,
      nextCode,
      nextName,
      nextDuration,
      nextSkill,
      existing.createdAt,
      new Date(existing.updatedAt.getTime() + 1000),
    );
    this.items.set(id.value, updated);
    return Promise.resolve(updated);
  }

  delete(id: ServiceTypeId): Promise<void> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new ServiceTypeNotFoundError(`id=${id.value}`));
    }
    this.items.delete(id.value);
    this.codeIndex.delete(existing.code);
    return Promise.resolve();
  }
}
