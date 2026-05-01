import { Inject, Injectable } from '@nestjs/common';

import type { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import type { WorkingHoursId } from '../../domain/identifiers/working-hours-id.vo';
import type {
  CreateWorkingHoursInput,
  UpdateWorkingHoursInput,
  WorkingHoursRepository,
} from '../../domain/ports';
import { WORKING_HOURS_REPOSITORY } from '../../domain/ports';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { MINUTES_PER_DAY } from '../../domain/schedule/minute-of-day.vo';
import {
  InvalidWorkingHoursError,
  WorkingHoursNotFoundError,
} from '../../domain/schedule/errors';
import type { WorkingHours } from '../../domain/schedule/working-hours.entity';

@Injectable()
export class WorkingHoursService {
  constructor(
    @Inject(WORKING_HOURS_REPOSITORY)
    private readonly repo: WorkingHoursRepository,
  ) {}

  async create(input: CreateWorkingHoursInput): Promise<WorkingHours> {
    this.assertWindow(input.openMinutes, input.closeMinutes, input.isClosed);
    return this.repo.create(input);
  }

  list(dealershipId: DealershipId): Promise<WorkingHours[]> {
    return this.repo.listForDealership(dealershipId);
  }

  async findById(id: WorkingHoursId): Promise<WorkingHours> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new WorkingHoursNotFoundError(`id=${id.value}`);
    }
    return row;
  }

  async update(
    id: WorkingHoursId,
    input: UpdateWorkingHoursInput,
  ): Promise<WorkingHours> {
    if (
      input.openMinutes === undefined &&
      input.closeMinutes === undefined &&
      input.isClosed === undefined
    ) {
      throw new EmptyUpdateError();
    }
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new WorkingHoursNotFoundError(`id=${id.value}`);
    }
    const next = {
      openMinutes: input.openMinutes ?? existing.openMinutes,
      closeMinutes: input.closeMinutes ?? existing.closeMinutes,
      isClosed: input.isClosed ?? existing.isClosed,
    };
    this.assertWindow(next.openMinutes, next.closeMinutes, next.isClosed);
    return this.repo.update(id, input);
  }

  delete(id: WorkingHoursId): Promise<void> {
    return this.repo.delete(id);
  }

  private assertWindow(
    openMinutes: number,
    closeMinutes: number,
    isClosed: boolean,
  ): void {
    if (
      !Number.isInteger(openMinutes) ||
      openMinutes < 0 ||
      openMinutes > MINUTES_PER_DAY ||
      !Number.isInteger(closeMinutes) ||
      closeMinutes < 0 ||
      closeMinutes > MINUTES_PER_DAY
    ) {
      throw new InvalidWorkingHoursError(
        'openMinutes/closeMinutes must be integers in 0..1440',
      );
    }
    if (!isClosed && closeMinutes <= openMinutes) {
      throw new InvalidWorkingHoursError(
        'closeMinutes must be greater than openMinutes when isClosed=false',
      );
    }
  }
}
