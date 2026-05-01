import { randomUUID } from 'node:crypto';

import { DealershipId } from '../../src/domain/identifiers/dealership-id.vo';
import { WorkingHoursId } from '../../src/domain/identifiers/working-hours-id.vo';
import type {
  CreateWorkingHoursInput,
  UpdateWorkingHoursInput,
  WorkingHoursRepository,
} from '../../src/domain/ports';
import type { DayOfWeek } from '../../src/domain/schedule/day-of-week.vo';
import {
  WorkingHoursAlreadyExistsError,
  WorkingHoursNotFoundError,
} from '../../src/domain/schedule/errors';
import { WorkingHours } from '../../src/domain/schedule/working-hours.entity';

export class FakeWorkingHoursRepository implements WorkingHoursRepository {
  private readonly items = new Map<string, WorkingHours>();

  findById(id: WorkingHoursId): Promise<WorkingHours | null> {
    return Promise.resolve(this.items.get(id.value) ?? null);
  }

  listForDealership(dealershipId: DealershipId): Promise<WorkingHours[]> {
    const rows = Array.from(this.items.values())
      .filter((wh) => wh.dealershipId.value === dealershipId.value)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    return Promise.resolve(rows);
  }

  findForDealershipDay(
    dealershipId: DealershipId,
    dayOfWeek: DayOfWeek,
  ): Promise<WorkingHours | null> {
    const row = Array.from(this.items.values()).find(
      (wh) =>
        wh.dealershipId.value === dealershipId.value &&
        wh.dayOfWeek === dayOfWeek,
    );
    return Promise.resolve(row ?? null);
  }

  create(input: CreateWorkingHoursInput): Promise<WorkingHours> {
    const clash = Array.from(this.items.values()).some(
      (wh) =>
        wh.dealershipId.value === input.dealershipId.value &&
        wh.dayOfWeek === input.dayOfWeek,
    );
    if (clash) {
      return Promise.reject(
        new WorkingHoursAlreadyExistsError(
          `Working hours already exist for dealership=${input.dealershipId.value} day=${input.dayOfWeek}`,
        ),
      );
    }
    const now = new Date();
    const wh = new WorkingHours(
      WorkingHoursId.from(randomUUID()),
      DealershipId.from(input.dealershipId.value),
      input.dayOfWeek,
      input.openMinutes,
      input.closeMinutes,
      input.isClosed,
      now,
      now,
    );
    this.items.set(wh.id.value, wh);
    return Promise.resolve(wh);
  }

  update(
    id: WorkingHoursId,
    input: UpdateWorkingHoursInput,
  ): Promise<WorkingHours> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new WorkingHoursNotFoundError(`id=${id.value}`));
    }
    const updated = new WorkingHours(
      existing.id,
      existing.dealershipId,
      existing.dayOfWeek,
      input.openMinutes ?? existing.openMinutes,
      input.closeMinutes ?? existing.closeMinutes,
      input.isClosed ?? existing.isClosed,
      existing.createdAt,
      new Date(existing.updatedAt.getTime() + 1000),
    );
    this.items.set(id.value, updated);
    return Promise.resolve(updated);
  }

  delete(id: WorkingHoursId): Promise<void> {
    if (!this.items.delete(id.value)) {
      return Promise.reject(new WorkingHoursNotFoundError(`id=${id.value}`));
    }
    return Promise.resolve();
  }
}
