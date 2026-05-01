import { randomUUID } from 'node:crypto';

import { DealershipId } from '../../src/domain/identifiers/dealership-id.vo';
import { HolidayId } from '../../src/domain/identifiers/holiday-id.vo';
import type {
  CreateHolidayInput,
  HolidayPage,
  HolidayRepository,
  ListHolidaysQuery,
  UpdateHolidayInput,
} from '../../src/domain/ports';
import {
  HolidayAlreadyExistsError,
  HolidayNotFoundError,
} from '../../src/domain/schedule/errors';
import { Holiday } from '../../src/domain/schedule/holiday.entity';

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export class FakeHolidayRepository implements HolidayRepository {
  private readonly items = new Map<string, Holiday>();

  findById(id: HolidayId): Promise<Holiday | null> {
    return Promise.resolve(this.items.get(id.value) ?? null);
  }

  list(query: ListHolidaysQuery): Promise<HolidayPage> {
    const all = Array.from(this.items.values())
      .filter((h) => h.dealershipId.value === query.dealershipId.value)
      .sort((a, b) => {
        if (a.isRecurring !== b.isRecurring) return a.isRecurring ? 1 : -1;
        return a.date.getTime() - b.date.getTime();
      });
    return Promise.resolve({
      total: all.length,
      items: all.slice(query.offset, query.offset + query.limit),
    });
  }

  listAllForDealership(dealershipId: DealershipId): Promise<Holiday[]> {
    return Promise.resolve(
      Array.from(this.items.values()).filter(
        (h) => h.dealershipId.value === dealershipId.value,
      ),
    );
  }

  create(input: CreateHolidayInput): Promise<Holiday> {
    const clash = Array.from(this.items.values()).some(
      (h) =>
        h.dealershipId.value === input.dealershipId.value &&
        h.isRecurring === input.isRecurring &&
        sameDate(h.date, input.date),
    );
    if (clash) {
      return Promise.reject(
        new HolidayAlreadyExistsError(
          `Holiday already exists for dealership=${input.dealershipId.value} date=${input.date.toISOString().slice(0, 10)} recurring=${input.isRecurring}`,
        ),
      );
    }
    const now = new Date();
    const h = new Holiday(
      HolidayId.from(randomUUID()),
      DealershipId.from(input.dealershipId.value),
      input.date,
      input.name,
      input.isRecurring,
      now,
      now,
    );
    this.items.set(h.id.value, h);
    return Promise.resolve(h);
  }

  update(id: HolidayId, input: UpdateHolidayInput): Promise<Holiday> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new HolidayNotFoundError(`id=${id.value}`));
    }
    const updated = new Holiday(
      existing.id,
      existing.dealershipId,
      input.date ?? existing.date,
      input.name ?? existing.name,
      input.isRecurring ?? existing.isRecurring,
      existing.createdAt,
      new Date(existing.updatedAt.getTime() + 1000),
    );
    this.items.set(id.value, updated);
    return Promise.resolve(updated);
  }

  delete(id: HolidayId): Promise<void> {
    if (!this.items.delete(id.value)) {
      return Promise.reject(new HolidayNotFoundError(`id=${id.value}`));
    }
    return Promise.resolve();
  }
}
