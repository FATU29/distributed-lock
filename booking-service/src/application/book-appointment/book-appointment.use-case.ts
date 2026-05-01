import { Inject, Injectable, Logger } from '@nestjs/common';

import { Appointment } from '../../domain/appointment/appointment.entity';
import { SlotAlreadyBookedError } from '../../domain/appointment/errors';
import { SlotWindow } from '../../domain/appointment/slot-window.vo';
import type { BayId } from '../../domain/identifiers/bay-id.vo';
import type { CustomerId } from '../../domain/identifiers/customer-id.vo';
import type { DealershipId } from '../../domain/identifiers/dealership-id.vo';
import type { ServiceTypeId } from '../../domain/identifiers/service-type-id.vo';
import type { TechnicianId } from '../../domain/identifiers/technician-id.vo';
import type { Vin } from '../../domain/identifiers/vin.vo';
import { LockNotAcquiredError } from '../../domain/locking/lock-not-acquired.error';
import {
  BOOKING_REPOSITORY,
  DISTRIBUTED_LOCK,
  PAYMENT_GATEWAY,
  type BookingRepository,
  type DistributedLock,
  type PaymentGateway,
} from '../../domain/ports';
import { DealershipScheduleService } from '../schedule/dealership-schedule.service';

export type BookAppointmentInput = {
  customerId: CustomerId;
  vehicleVin: Vin;
  dealershipId: DealershipId;
  bayId: BayId;
  technicianId: TechnicianId;
  serviceTypeId: ServiceTypeId;
  slot: SlotWindow;
  /**
   * Caller-supplied idempotency key for the payment authorisation. Reusing
   * the same key for retries makes the mock (and any real PSP) safe to
   * re-drive without double-charging.
   */
  idempotencyKey: string;
};

const LOCK_TTL_MS = 15_000;

@Injectable()
export class BookAppointmentUseCase {
  private readonly logger = new Logger(BookAppointmentUseCase.name);

  constructor(
    @Inject(DISTRIBUTED_LOCK)
    private readonly lock: DistributedLock,
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly payments: PaymentGateway,
    private readonly schedule: DealershipScheduleService,
  ) {}

  async execute(input: BookAppointmentInput): Promise<Appointment> {
    await this.schedule.assertSlotIsBookable(input.dealershipId, input.slot);

    const lockKeys = buildLockKeys(input.bayId, input.technicianId, input.slot);

    const handle = await this.lock.tryAcquire(lockKeys, LOCK_TTL_MS);
    if (!handle) {
      throw new LockNotAcquiredError(
        `Could not acquire booking lock for bay=${input.bayId.value} technician=${input.technicianId.value} slotStart=${input.slot.start.toISOString()}`,
      );
    }

    try {
      const conflict = await this.bookings.hasConflict({
        bayId: input.bayId,
        technicianId: input.technicianId,
        slot: input.slot,
      });
      if (conflict) {
        throw new SlotAlreadyBookedError(
          `Slot ${input.slot.start.toISOString()}–${input.slot.end.toISOString()} is already booked for bay=${input.bayId.value} or technician=${input.technicianId.value}`,
        );
      }

      const charge = await this.payments.charge({
        customerId: input.customerId,
        serviceTypeId: input.serviceTypeId,
        idempotencyKey: input.idempotencyKey,
      });

      return await this.bookings.confirm({
        customerId: input.customerId,
        vehicleVin: input.vehicleVin,
        dealershipId: input.dealershipId,
        bayId: input.bayId,
        technicianId: input.technicianId,
        serviceTypeId: input.serviceTypeId,
        slot: input.slot,
        paymentReference: charge.reference,
      });
    } finally {
      try {
        await this.lock.release(handle);
      } catch (err) {
        this.logger.warn(
          `Lock release failed; relying on TTL: ${(err as Error).message}`,
        );
      }
    }
  }
}

function buildLockKeys(
  bayId: BayId,
  technicianId: TechnicianId,
  slot: SlotWindow,
): string[] {
  const slotStart = slot.start.toISOString();
  return [
    `lock:bay:${bayId.value}:${slotStart}`,
    `lock:tech:${technicianId.value}:${slotStart}`,
  ];
}
