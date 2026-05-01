import { randomUUID } from 'node:crypto';

import { Appointment } from '../../src/domain/appointment/appointment.entity';
import { SlotAlreadyBookedError } from '../../src/domain/appointment/errors';
import { SlotWindow } from '../../src/domain/appointment/slot-window.vo';
import { AppointmentId } from '../../src/domain/identifiers/appointment-id.vo';
import type {
  AvailabilityProbe,
  BookingRepository,
  ConfirmBookingInput,
} from '../../src/domain/ports';

/**
 * In-memory {@link BookingRepository}. `confirm` mirrors the production
 * adapter's atomic re-check + insert + outbox semantics; `outbox`
 * exposes the captured rows for assertions.
 */
export class FakeBookingRepository implements BookingRepository {
  readonly appointments: Appointment[] = [];
  readonly outbox: Array<{
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }> = [];

  hasConflict(probe: AvailabilityProbe): Promise<boolean> {
    return Promise.resolve(this.findConflict(probe));
  }

  confirm(input: ConfirmBookingInput): Promise<Appointment> {
    if (
      this.findConflict({
        bayId: input.bayId,
        technicianId: input.technicianId,
        slot: input.slot,
      })
    ) {
      return Promise.reject(
        new SlotAlreadyBookedError(
          'Slot taken between re-check and insert (fake)',
        ),
      );
    }
    const now = new Date();
    const appointment = new Appointment(
      AppointmentId.from(randomUUID()),
      input.customerId,
      input.vehicleVin,
      input.dealershipId,
      input.bayId,
      input.technicianId,
      input.serviceTypeId,
      SlotWindow.fromStartEnd(input.slot.start, input.slot.end),
      'CONFIRMED',
      now,
      now,
    );
    this.appointments.push(appointment);
    this.outbox.push({
      aggregateType: 'Appointment',
      aggregateId: appointment.id.value,
      eventType: 'appointment.confirmed',
      payload: {
        appointmentId: appointment.id.value,
        paymentReference: input.paymentReference,
      },
    });
    return Promise.resolve(appointment);
  }

  private findConflict(probe: AvailabilityProbe): boolean {
    return this.appointments.some((a) => {
      if (a.status !== 'PENDING' && a.status !== 'CONFIRMED') {
        return false;
      }
      const overlaps =
        a.slot.start.getTime() < probe.slot.end.getTime() &&
        a.slot.end.getTime() > probe.slot.start.getTime();
      if (!overlaps) return false;
      return (
        a.bayId.value === probe.bayId.value ||
        a.technicianId.value === probe.technicianId.value
      );
    });
  }
}
