import { Inject, Injectable } from '@nestjs/common';

import type { HolidayId } from '../../domain/identifiers/holiday-id.vo';
import type {
  CreateHolidayInput,
  HolidayPage,
  HolidayRepository,
  ListHolidaysQuery,
  UpdateHolidayInput,
} from '../../domain/ports';
import { HOLIDAY_REPOSITORY } from '../../domain/ports';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { HolidayNotFoundError } from '../../domain/schedule/errors';
import type { Holiday } from '../../domain/schedule/holiday.entity';

@Injectable()
export class HolidaysService {
  constructor(
    @Inject(HOLIDAY_REPOSITORY)
    private readonly repo: HolidayRepository,
  ) {}

  create(input: CreateHolidayInput): Promise<Holiday> {
    return this.repo.create({
      ...input,
      date: normaliseUtcDate(input.date),
    });
  }

  list(query: ListHolidaysQuery): Promise<HolidayPage> {
    return this.repo.list(query);
  }

  async findById(id: HolidayId): Promise<Holiday> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new HolidayNotFoundError(`id=${id.value}`);
    }
    return row;
  }

  async update(id: HolidayId, input: UpdateHolidayInput): Promise<Holiday> {
    if (
      input.date === undefined &&
      input.name === undefined &&
      input.isRecurring === undefined
    ) {
      throw new EmptyUpdateError();
    }
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new HolidayNotFoundError(`id=${id.value}`);
    }
    return this.repo.update(id, {
      ...input,
      date: input.date !== undefined ? normaliseUtcDate(input.date) : undefined,
    });
  }

  delete(id: HolidayId): Promise<void> {
    return this.repo.delete(id);
  }
}

function normaliseUtcDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
