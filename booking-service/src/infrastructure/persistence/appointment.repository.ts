import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AppointmentId } from '../../domain/identifiers/appointment-id.vo';
import type {
  AppointmentPage,
  AppointmentRepository,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from '../../domain/ports';
import { AppointmentNotFoundError } from '../../domain/appointment/errors';
import { Appointment } from '../../domain/appointment/appointment.entity';
import { PrismaService } from '../prisma/prisma.service';
import { mapAppointmentRowToDomain } from './mappers/appointment.mapper';

@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: AppointmentId): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findUnique({
      where: { id: id.value },
    });
    return row ? mapAppointmentRowToDomain(row) : null;
  }

  async list(query: ListAppointmentsQuery): Promise<AppointmentPage> {
    const where: Prisma.AppointmentWhereInput = {};
    if (query.customerId) {
      where.customerId = query.customerId.value;
    }
    if (query.dealershipId) {
      where.dealershipId = query.dealershipId.value;
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        orderBy: { slotStart: 'desc' },
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return {
      items: rows.map(mapAppointmentRowToDomain),
      total,
    };
  }

  async update(
    id: AppointmentId,
    input: UpdateAppointmentInput,
  ): Promise<Appointment> {
    const data: Prisma.AppointmentUpdateInput = {};
    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (input.slotStart !== undefined) {
      data.slotStart = input.slotStart;
    }
    if (input.slotEnd !== undefined) {
      data.slotEnd = input.slotEnd;
    }
    try {
      const row = await this.prisma.appointment.update({
        where: { id: id.value },
        data,
      });
      return mapAppointmentRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new AppointmentNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }

  async delete(id: AppointmentId): Promise<void> {
    try {
      await this.prisma.appointment.delete({
        where: { id: id.value },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new AppointmentNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }
}
