import { Inject, Injectable } from '@nestjs/common';

import { SlotWindow } from '../../domain/appointment/slot-window.vo';
import type { AppointmentId } from '../../domain/identifiers/appointment-id.vo';
import type {
  AppointmentPage,
  AppointmentRepository,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from '../../domain/ports';
import { APPOINTMENT_REPOSITORY } from '../../domain/ports';
import { Appointment } from '../../domain/appointment/appointment.entity';
import {
  AppointmentNotFoundError,
  InvalidSlotWindowError,
} from '../../domain/appointment/errors';
import { EmptyUpdateError } from '../../domain/reference.errors';

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointments: AppointmentRepository,
  ) {}

  async findById(id: AppointmentId): Promise<Appointment> {
    const row = await this.appointments.findById(id);
    if (!row) {
      throw new AppointmentNotFoundError(`id=${id.value}`);
    }
    return row;
  }

  list(query: ListAppointmentsQuery): Promise<AppointmentPage> {
    return this.appointments.list(query);
  }

  async update(
    id: AppointmentId,
    input: UpdateAppointmentInput,
  ): Promise<Appointment> {
    if (
      input.status === undefined &&
      input.slotStart === undefined &&
      input.slotEnd === undefined
    ) {
      throw new EmptyUpdateError();
    }
    const existing = await this.appointments.findById(id);
    if (!existing) {
      throw new AppointmentNotFoundError(`id=${id.value}`);
    }
    const patch: UpdateAppointmentInput = {};
    if (input.status !== undefined) {
      patch.status = input.status;
    }
    if (input.slotStart !== undefined || input.slotEnd !== undefined) {
      const start = input.slotStart ?? existing.slot.start;
      const end = input.slotEnd ?? existing.slot.end;
      try {
        SlotWindow.fromStartEnd(start, end);
      } catch {
        throw new InvalidSlotWindowError(
          'slotStart and slotEnd must form a valid half-open window (start < end)',
        );
      }
      patch.slotStart = start;
      patch.slotEnd = end;
    }
    return this.appointments.update(id, patch);
  }

  delete(id: AppointmentId): Promise<void> {
    return this.appointments.delete(id);
  }
}
