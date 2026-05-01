import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import type { HolidayId } from '../../domain/identifiers/holiday-id.vo';
import type {
  CreateHolidayInput,
  HolidayPage,
  HolidayRepository,
  ListHolidaysQuery,
  UpdateHolidayInput,
} from '../../domain/ports';
import { ForeignKeyReferenceError } from '../../domain/reference.errors';
import {
  HolidayAlreadyExistsError,
  HolidayNotFoundError,
} from '../../domain/schedule/errors';
import type { Holiday } from '../../domain/schedule/holiday.entity';
import { PrismaService } from '../prisma/prisma.service';
import { mapHolidayRowToDomain } from './mappers/holiday.mapper';

@Injectable()
export class PrismaHolidayRepository implements HolidayRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: HolidayId): Promise<Holiday | null> {
    const row = await this.prisma.holiday.findUnique({
      where: { id: id.value },
    });
    return row ? mapHolidayRowToDomain(row) : null;
  }

  async list(query: ListHolidaysQuery): Promise<HolidayPage> {
    const where: Prisma.HolidayWhereInput = {
      dealershipId: query.dealershipId.value,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.holiday.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        orderBy: [{ isRecurring: 'asc' }, { date: 'asc' }],
      }),
      this.prisma.holiday.count({ where }),
    ]);
    return {
      items: rows.map(mapHolidayRowToDomain),
      total,
    };
  }

  async listAllForDealership(dealershipId: DealershipId): Promise<Holiday[]> {
    const rows = await this.prisma.holiday.findMany({
      where: { dealershipId: dealershipId.value },
    });
    return rows.map(mapHolidayRowToDomain);
  }

  async create(input: CreateHolidayInput): Promise<Holiday> {
    try {
      const row = await this.prisma.holiday.create({
        data: {
          dealershipId: input.dealershipId.value,
          date: input.date,
          name: input.name,
          isRecurring: input.isRecurring,
        },
      });
      return mapHolidayRowToDomain(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HolidayAlreadyExistsError(
            `Holiday already exists for dealership=${input.dealershipId.value} date=${input.date.toISOString().slice(0, 10)} recurring=${input.isRecurring}`,
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

  async update(id: HolidayId, input: UpdateHolidayInput): Promise<Holiday> {
    const data: Prisma.HolidayUpdateInput = {};
    if (input.date !== undefined) data.date = input.date;
    if (input.name !== undefined) data.name = input.name;
    if (input.isRecurring !== undefined) data.isRecurring = input.isRecurring;
    try {
      const row = await this.prisma.holiday.update({
        where: { id: id.value },
        data,
      });
      return mapHolidayRowToDomain(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2025') {
          throw new HolidayNotFoundError(`id=${id.value}`);
        }
        if (e.code === 'P2002') {
          throw new HolidayAlreadyExistsError(
            `Holiday clash on update id=${id.value}`,
          );
        }
      }
      throw e;
    }
  }

  async delete(id: HolidayId): Promise<void> {
    try {
      await this.prisma.holiday.delete({ where: { id: id.value } });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new HolidayNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }
}
