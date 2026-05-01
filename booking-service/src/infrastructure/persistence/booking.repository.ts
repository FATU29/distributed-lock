import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { Appointment } from '../../domain/appointment/appointment.entity';
import { SlotAlreadyBookedError } from '../../domain/appointment/errors';
import type {
  AvailabilityProbe,
  BookingRepository,
  ConfirmBookingInput,
} from '../../domain/ports';
import { PrismaService } from '../prisma/prisma.service';
import { mapAppointmentRowToDomain } from './mappers/appointment.mapper';

const ACTIVE_STATUSES: Prisma.AppointmentWhereInput['status'] = {
  in: ['PENDING', 'CONFIRMED'],
};

@Injectable()
export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasConflict(probe: AvailabilityProbe): Promise<boolean> {
    const overlap = overlapClause(probe.slot.start, probe.slot.end);
    const row = await this.prisma.appointment.findFirst({
      where: {
        status: ACTIVE_STATUSES,
        OR: [
          { bayId: probe.bayId.value, ...overlap },
          { technicianId: probe.technicianId.value, ...overlap },
        ],
      },
      select: { id: true },
    });
    return row !== null;
  }

  async confirm(input: ConfirmBookingInput): Promise<Appointment> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const overlap = overlapClause(input.slot.start, input.slot.end);
        const conflict = await tx.appointment.findFirst({
          where: {
            status: ACTIVE_STATUSES,
            OR: [
              { bayId: input.bayId.value, ...overlap },
              { technicianId: input.technicianId.value, ...overlap },
            ],
          },
          select: { id: true },
        });
        if (conflict) {
          throw new SlotAlreadyBookedError(
            `Slot ${input.slot.start.toISOString()}–${input.slot.end.toISOString()} taken between re-check and insert`,
          );
        }

        const appointment = await tx.appointment.create({
          data: {
            customerId: input.customerId.value,
            vehicleVin: input.vehicleVin.value,
            dealershipId: input.dealershipId.value,
            bayId: input.bayId.value,
            technicianId: input.technicianId.value,
            serviceTypeId: input.serviceTypeId.value,
            slotStart: input.slot.start,
            slotEnd: input.slot.end,
            status: 'CONFIRMED',
          },
        });

        await tx.outbox.create({
          data: {
            aggregateType: 'Appointment',
            aggregateId: appointment.id,
            eventType: 'appointment.confirmed',
            payload: {
              appointmentId: appointment.id,
              customerId: appointment.customerId,
              vehicleVin: appointment.vehicleVin,
              dealershipId: appointment.dealershipId,
              bayId: appointment.bayId,
              technicianId: appointment.technicianId,
              serviceTypeId: appointment.serviceTypeId,
              slotStart: appointment.slotStart.toISOString(),
              slotEnd: appointment.slotEnd.toISOString(),
              paymentReference: input.paymentReference,
            },
          },
        });

        return mapAppointmentRowToDomain(appointment);
      });
    } catch (err) {
      if (err instanceof SlotAlreadyBookedError) {
        throw err;
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new SlotAlreadyBookedError(
          'Unique constraint violated while inserting appointment',
        );
      }
      throw err;
    }
  }
}

function overlapClause(
  start: Date,
  end: Date,
): Pick<Prisma.AppointmentWhereInput, 'slotStart' | 'slotEnd'> {
  // Half-open window overlap: existing.start < new.end AND existing.end > new.start
  return {
    slotStart: { lt: end },
    slotEnd: { gt: start },
  };
}
