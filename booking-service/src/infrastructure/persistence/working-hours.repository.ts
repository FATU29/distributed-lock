import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import type { WorkingHoursId } from '../../domain/identifiers/working-hours-id.vo';
import type {
  CreateWorkingHoursInput,
  UpdateWorkingHoursInput,
  WorkingHoursRepository,
} from '../../domain/ports';
import { ForeignKeyReferenceError } from '../../domain/reference.errors';
import type { DayOfWeek } from '../../domain/schedule/day-of-week.vo';
import {
  WorkingHoursAlreadyExistsError,
  WorkingHoursNotFoundError,
} from '../../domain/schedule/errors';
import type { WorkingHours } from '../../domain/schedule/working-hours.entity';
import { PrismaService } from '../prisma/prisma.service';
import { mapWorkingHoursRowToDomain } from './mappers/working-hours.mapper';

@Injectable()
export class PrismaWorkingHoursRepository implements WorkingHoursRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: WorkingHoursId): Promise<WorkingHours | null> {
    const row = await this.prisma.workingHours.findUnique({
      where: { id: id.value },
    });
    return row ? mapWorkingHoursRowToDomain(row) : null;
  }

  async listForDealership(dealershipId: DealershipId): Promise<WorkingHours[]> {
    const rows = await this.prisma.workingHours.findMany({
      where: { dealershipId: dealershipId.value },
      orderBy: { dayOfWeek: 'asc' },
    });
    return rows.map(mapWorkingHoursRowToDomain);
  }

  async findForDealershipDay(
    dealershipId: DealershipId,
    dayOfWeek: DayOfWeek,
  ): Promise<WorkingHours | null> {
    const row = await this.prisma.workingHours.findUnique({
      where: {
        dealershipId_dayOfWeek: {
          dealershipId: dealershipId.value,
          dayOfWeek,
        },
      },
    });
    return row ? mapWorkingHoursRowToDomain(row) : null;
  }

  async create(input: CreateWorkingHoursInput): Promise<WorkingHours> {
    try {
      const row = await this.prisma.workingHours.create({
        data: {
          dealershipId: input.dealershipId.value,
          dayOfWeek: input.dayOfWeek,
          openMinutes: input.openMinutes,
          closeMinutes: input.closeMinutes,
          isClosed: input.isClosed,
        },
      });
      return mapWorkingHoursRowToDomain(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new WorkingHoursAlreadyExistsError(
            `Working hours already exist for dealership=${input.dealershipId.value} day=${input.dayOfWeek}`,
          );
        }
        if (e.code === 'P2003') {
          throw new ForeignKeyReferenceError(
            `Unknown dealership id=${input.dealershipId.value}`,
          );
        }
      }
      throw e;
    }
  }

  async update(
    id: WorkingHoursId,
    input: UpdateWorkingHoursInput,
  ): Promise<WorkingHours> {
    const data: Prisma.WorkingHoursUpdateInput = {};
    if (input.openMinutes !== undefined) data.openMinutes = input.openMinutes;
    if (input.closeMinutes !== undefined)
      data.closeMinutes = input.closeMinutes;
    if (input.isClosed !== undefined) data.isClosed = input.isClosed;
    try {
      const row = await this.prisma.workingHours.update({
        where: { id: id.value },
        data,
      });
      return mapWorkingHoursRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new WorkingHoursNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }

  async delete(id: WorkingHoursId): Promise<void> {
    try {
      await this.prisma.workingHours.delete({ where: { id: id.value } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new WorkingHoursNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }
}
