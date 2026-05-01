import { randomUUID } from 'node:crypto';

import { FakeAppointmentRepository } from '../../../test/fakes/fake-appointment.repository';
import { Appointment } from '../../domain/appointment/appointment.entity';
import {
  AppointmentNotFoundError,
  InvalidSlotWindowError,
} from '../../domain/appointment/errors';
import { SlotWindow } from '../../domain/appointment/slot-window.vo';
import { AppointmentId } from '../../domain/identifiers/appointment-id.vo';
import { BayId } from '../../domain/identifiers/bay-id.vo';
import { CustomerId } from '../../domain/identifiers/customer-id.vo';
import { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import { ServiceTypeId } from '../../domain/identifiers/service-type-id.vo';
import { TechnicianId } from '../../domain/identifiers/technician-id.vo';
import { Vin } from '../../domain/identifiers/vin.vo';
import { EmptyUpdateError } from '../../domain/reference.errors';
import { AppointmentsService } from './appointments.service';

function sampleAppointment(overrides?: {
  id?: AppointmentId;
  slot?: SlotWindow;
  status?: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
}): Appointment {
  const t0 = Date.parse('2026-06-01T10:00:00.000Z');
  const t1 = Date.parse('2026-06-01T11:00:00.000Z');
  const slot =
    overrides?.slot ?? SlotWindow.fromStartEnd(new Date(t0), new Date(t1));
  const createdAt = new Date(t0);
  return new Appointment(
    overrides?.id ?? AppointmentId.from(randomUUID()),
    CustomerId.from(randomUUID()),
    Vin.from('VIN01'),
    DealershipId.from(randomUUID()),
    BayId.from(randomUUID()),
    TechnicianId.from(randomUUID()),
    ServiceTypeId.from(randomUUID()),
    slot,
    overrides?.status ?? 'CONFIRMED',
    createdAt,
    createdAt,
  );
}

describe('AppointmentsService', () => {
  let repository: FakeAppointmentRepository;
  let service: AppointmentsService;

  beforeEach(() => {
    repository = new FakeAppointmentRepository();
    service = new AppointmentsService(repository);
  });

  describe('findById', () => {
    it('returns the appointment when present', async () => {
      const a = sampleAppointment();
      repository.place(a);
      const found = await service.findById(a.id);
      expect(found.id.value).toBe(a.id.value);
    });

    it('throws AppointmentNotFoundError when missing', async () => {
      await expect(
        service.findById(AppointmentId.from(randomUUID())),
      ).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe('list', () => {
    it('filters by customerId and dealershipId', async () => {
      const customerId = CustomerId.from(randomUUID());
      const dealershipId = DealershipId.from(randomUUID());
      const otherDealership = DealershipId.from(randomUUID());
      const match = sampleAppointment();
      repository.place(
        new Appointment(
          match.id,
          customerId,
          match.vehicleVin,
          dealershipId,
          match.bayId,
          match.technicianId,
          match.serviceTypeId,
          match.slot,
          match.status,
          match.createdAt,
          match.updatedAt,
        ),
      );
      repository.place(
        new Appointment(
          AppointmentId.from(randomUUID()),
          CustomerId.from(randomUUID()),
          match.vehicleVin,
          otherDealership,
          match.bayId,
          match.technicianId,
          match.serviceTypeId,
          match.slot,
          match.status,
          match.createdAt,
          match.updatedAt,
        ),
      );
      const byCustomer = await service.list({
        limit: 10,
        offset: 0,
        customerId,
      });
      expect(byCustomer.total).toBe(1);
      const byDealership = await service.list({
        limit: 10,
        offset: 0,
        dealershipId,
      });
      expect(byDealership.total).toBe(1);
    });
  });

  describe('update', () => {
    it('updates status', async () => {
      const a = sampleAppointment({ status: 'CONFIRMED' });
      repository.place(a);
      const updated = await service.update(a.id, { status: 'CANCELLED' });
      expect(updated.status).toBe('CANCELLED');
    });

    it('updates slot when both bounds provided', async () => {
      const a = sampleAppointment();
      repository.place(a);
      const start = new Date('2026-07-01T12:00:00.000Z');
      const end = new Date('2026-07-01T14:00:00.000Z');
      const updated = await service.update(a.id, {
        slotStart: start,
        slotEnd: end,
      });
      expect(updated.slot.start.toISOString()).toBe(start.toISOString());
      expect(updated.slot.end.toISOString()).toBe(end.toISOString());
    });

    it('throws EmptyUpdateError when nothing to update', async () => {
      const a = sampleAppointment();
      repository.place(a);
      await expect(service.update(a.id, {})).rejects.toBeInstanceOf(
        EmptyUpdateError,
      );
    });

    it('throws InvalidSlotWindowError when slot is invalid', async () => {
      const a = sampleAppointment();
      repository.place(a);
      const badEnd = new Date(a.slot.start.getTime() - 60_000);
      await expect(
        service.update(a.id, {
          slotStart: a.slot.start,
          slotEnd: badEnd,
        }),
      ).rejects.toBeInstanceOf(InvalidSlotWindowError);
    });

    it('throws AppointmentNotFoundError when missing', async () => {
      await expect(
        service.update(AppointmentId.from(randomUUID()), {
          status: 'CANCELLED',
        }),
      ).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });
  });

  describe('delete', () => {
    it('removes the appointment', async () => {
      const a = sampleAppointment();
      repository.place(a);
      await service.delete(a.id);
      await expect(service.findById(a.id)).rejects.toBeInstanceOf(
        AppointmentNotFoundError,
      );
    });

    it('throws AppointmentNotFoundError when missing', async () => {
      await expect(
        service.delete(AppointmentId.from(randomUUID())),
      ).rejects.toBeInstanceOf(AppointmentNotFoundError);
    });
  });
});
