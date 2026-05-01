import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';

import { FakeBookingRepository } from '../../../test/fakes/fake-booking.repository';
import {
  FakeDistributedLock,
  redisReleasePartitionError,
} from '../../../test/fakes/fake-distributed-lock';
import { FakeHolidayRepository } from '../../../test/fakes/fake-holiday.repository';
import { FakePaymentGateway } from '../../../test/fakes/fake-payment.gateway';
import { FakeWorkingHoursRepository } from '../../../test/fakes/fake-working-hours.repository';
import { SlotAlreadyBookedError } from '../../domain/appointment/errors';
import { SlotWindow } from '../../domain/appointment/slot-window.vo';
import { BayId } from '../../domain/identifiers/bay-id.vo';
import { CustomerId } from '../../domain/identifiers/customer-id.vo';
import { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import { ServiceTypeId } from '../../domain/identifiers/service-type-id.vo';
import { TechnicianId } from '../../domain/identifiers/technician-id.vo';
import { Vin } from '../../domain/identifiers/vin.vo';
import { LockNotAcquiredError } from '../../domain/locking/lock-not-acquired.error';
import { PaymentDeclinedError } from '../../domain/payment/errors';
import {
  DealershipClosedOnHolidayError,
  OutsideWorkingHoursError,
} from '../../domain/schedule/errors';
import { DealershipScheduleService } from '../schedule/dealership-schedule.service';
import { BookAppointmentUseCase } from './book-appointment.use-case';

const SLOT_START = new Date('2026-06-01T10:00:00.000Z'); // Monday
const SLOT_END = new Date('2026-06-01T11:00:00.000Z');

function buildInput(
  dealershipId: DealershipId,
  overrides: { idempotencyKey?: string } = {},
) {
  return {
    customerId: CustomerId.from(randomUUID()),
    vehicleVin: Vin.from('1HGBH41JXMN109186'),
    dealershipId,
    bayId: BayId.from(randomUUID()),
    technicianId: TechnicianId.from(randomUUID()),
    serviceTypeId: ServiceTypeId.from(randomUUID()),
    slot: SlotWindow.fromStartEnd(SLOT_START, SLOT_END),
    idempotencyKey: overrides.idempotencyKey ?? randomUUID(),
  };
}

describe('BookAppointmentUseCase', () => {
  let lock: FakeDistributedLock;
  let bookings: FakeBookingRepository;
  let payments: FakePaymentGateway;
  let workingHours: FakeWorkingHoursRepository;
  let holidays: FakeHolidayRepository;
  let schedule: DealershipScheduleService;
  let useCase: BookAppointmentUseCase;
  let dealershipId: DealershipId;

  beforeEach(async () => {
    lock = new FakeDistributedLock();
    bookings = new FakeBookingRepository();
    payments = new FakePaymentGateway();
    workingHours = new FakeWorkingHoursRepository();
    holidays = new FakeHolidayRepository();
    schedule = new DealershipScheduleService(workingHours, holidays);
    useCase = new BookAppointmentUseCase(lock, bookings, payments, schedule);
    dealershipId = DealershipId.from(randomUUID());

    // Mon–Sat 09:00–17:00; Sunday closed.
    for (const dow of [1, 2, 3, 4, 5, 6] as const) {
      await workingHours.create({
        dealershipId,
        dayOfWeek: dow,
        openMinutes: 9 * 60,
        closeMinutes: 17 * 60,
        isClosed: false,
      });
    }
    await workingHours.create({
      dealershipId,
      dayOfWeek: 0,
      openMinutes: 0,
      closeMinutes: 0,
      isClosed: true,
    });
  });

  it('confirms the appointment, charges payment, writes outbox, releases the lock', async () => {
    const input = buildInput(dealershipId);
    const appointment = await useCase.execute(input);

    expect(appointment.status).toBe('CONFIRMED');
    expect(appointment.bayId.value).toBe(input.bayId.value);

    expect(lock.acquireCalls).toHaveLength(1);
    const acquireCall = lock.acquireCalls[0];
    expect(acquireCall.ttlMs).toBe(15_000);
    expect(acquireCall.keys).toEqual([
      `lock:bay:${input.bayId.value}:${SLOT_START.toISOString()}`,
      `lock:tech:${input.technicianId.value}:${SLOT_START.toISOString()}`,
    ]);

    expect(payments.calls).toHaveLength(1);
    expect(payments.calls[0]?.idempotencyKey).toBe(input.idempotencyKey);

    expect(bookings.appointments).toHaveLength(1);
    expect(bookings.outbox).toHaveLength(1);
    expect(bookings.outbox[0]?.payload.paymentReference).toBe(
      `fake_${input.idempotencyKey}`,
    );

    expect(lock.releaseCalls).toHaveLength(1);
  });

  it('throws LockNotAcquiredError without touching DB or payment when quorum fails', async () => {
    lock.setMode('deny');
    const input = buildInput(dealershipId);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      LockNotAcquiredError,
    );

    expect(payments.calls).toHaveLength(0);
    expect(bookings.appointments).toHaveLength(0);
    expect(lock.releaseCalls).toHaveLength(0);
  });

  it('throws SlotAlreadyBookedError when re-check finds a conflict and releases the lock', async () => {
    const first = buildInput(dealershipId);
    await useCase.execute(first);

    const second = {
      ...buildInput(dealershipId),
      bayId: first.bayId,
      technicianId: first.technicianId,
    };

    await expect(useCase.execute(second)).rejects.toBeInstanceOf(
      SlotAlreadyBookedError,
    );

    expect(payments.calls).toHaveLength(1); // only the first succeeded
    expect(bookings.appointments).toHaveLength(1);
    expect(lock.releaseCalls).toHaveLength(2); // both attempts released
  });

  it('propagates payment decline, leaves no DB row, still releases the lock', async () => {
    payments.failWith(new PaymentDeclinedError('insufficient funds'));
    const input = buildInput(dealershipId);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      PaymentDeclinedError,
    );

    expect(bookings.appointments).toHaveLength(0);
    expect(bookings.outbox).toHaveLength(0);
    expect(lock.releaseCalls).toHaveLength(1);
  });

  it('releases the lock even when persistence throws after a successful charge', async () => {
    const input = buildInput(dealershipId);
    const boom = new Error('db down');
    jest.spyOn(bookings, 'confirm').mockRejectedValueOnce(boom);

    await expect(useCase.execute(input)).rejects.toBe(boom);

    expect(payments.calls).toHaveLength(1);
    expect(lock.releaseCalls).toHaveLength(1);
  });

  it('swallows lock release failures so the booking still resolves', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    lock.failNextRelease(redisReleasePartitionError());
    const input = buildInput(dealershipId);

    try {
      const appointment = await useCase.execute(input);
      expect(appointment.status).toBe('CONFIRMED');
      expect(lock.releaseCalls).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lock release failed; relying on TTL'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('throws OutsideWorkingHoursError before touching the lock when the slot falls on a closed day', async () => {
    const input = {
      ...buildInput(dealershipId),
      slot: SlotWindow.fromStartEnd(
        new Date('2026-05-31T10:00:00.000Z'), // Sunday
        new Date('2026-05-31T11:00:00.000Z'),
      ),
    };

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      OutsideWorkingHoursError,
    );

    expect(lock.acquireCalls).toHaveLength(0);
    expect(payments.calls).toHaveLength(0);
    expect(bookings.appointments).toHaveLength(0);
  });

  it('throws DealershipClosedOnHolidayError when the slot day matches a configured holiday', async () => {
    await holidays.create({
      dealershipId,
      date: new Date('2026-06-01T00:00:00.000Z'),
      name: 'Reunification Day',
      isRecurring: false,
    });
    const input = buildInput(dealershipId);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      DealershipClosedOnHolidayError,
    );

    expect(lock.acquireCalls).toHaveLength(0);
    expect(payments.calls).toHaveLength(0);
    expect(bookings.appointments).toHaveLength(0);
  });
});
