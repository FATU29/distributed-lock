import { Appointment } from '../../src/domain/appointment/appointment.entity';
import { SlotWindow } from '../../src/domain/appointment/slot-window.vo';
import { AppointmentNotFoundError } from '../../src/domain/appointment/errors';
import { AppointmentId } from '../../src/domain/identifiers/appointment-id.vo';
import type {
  AppointmentPage,
  AppointmentRepository,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from '../../src/domain/ports';

/**
 * In-memory AppointmentRepository. Use {@link FakeAppointmentRepository.place}
 * to seed rows — the port has no create method.
 */
export class FakeAppointmentRepository implements AppointmentRepository {
  private readonly items = new Map<string, Appointment>();

  place(appointment: Appointment): void {
    this.items.set(appointment.id.value, appointment);
  }

  findById(id: AppointmentId): Promise<Appointment | null> {
    return Promise.resolve(this.items.get(id.value) ?? null);
  }

  list(query: ListAppointmentsQuery): Promise<AppointmentPage> {
    const { limit, offset, customerId, dealershipId } = query;
    let all = Array.from(this.items.values());
    if (customerId !== undefined) {
      all = all.filter((a) => a.customerId.value === customerId.value);
    }
    if (dealershipId !== undefined) {
      all = all.filter((a) => a.dealershipId.value === dealershipId.value);
    }
    all.sort((a, b) => b.slot.start.getTime() - a.slot.start.getTime());
    return Promise.resolve({
      total: all.length,
      items: all.slice(offset, offset + limit),
    });
  }

  update(
    id: AppointmentId,
    input: UpdateAppointmentInput,
  ): Promise<Appointment> {
    const existing = this.items.get(id.value);
    if (!existing) {
      return Promise.reject(new AppointmentNotFoundError(`id=${id.value}`));
    }
    const nextStatus = input.status ?? existing.status;
    const start = input.slotStart ?? existing.slot.start;
    const end = input.slotEnd ?? existing.slot.end;
    const slot = SlotWindow.fromStartEnd(start, end);
    const updated = new Appointment(
      existing.id,
      existing.customerId,
      existing.vehicleVin,
      existing.dealershipId,
      existing.bayId,
      existing.technicianId,
      existing.serviceTypeId,
      slot,
      nextStatus,
      existing.createdAt,
      new Date(existing.updatedAt.getTime() + 1000),
    );
    this.items.set(id.value, updated);
    return Promise.resolve(updated);
  }

  delete(id: AppointmentId): Promise<void> {
    if (!this.items.delete(id.value)) {
      return Promise.reject(new AppointmentNotFoundError(`id=${id.value}`));
    }
    return Promise.resolve();
  }
}
