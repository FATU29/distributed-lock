import type { Appointment } from '../appointment/appointment.entity';
import type { SlotWindow } from '../appointment/slot-window.vo';
import type { BayId } from '../identifiers/bay-id.vo';
import type { CustomerId } from '../identifiers/customer-id.vo';
import type { DealershipId } from '../identifiers/dealership-id.vo';
import type { ServiceTypeId } from '../identifiers/service-type-id.vo';
import type { TechnicianId } from '../identifiers/technician-id.vo';
import type { Vin } from '../identifiers/vin.vo';

export type AvailabilityProbe = {
  bayId: BayId;
  technicianId: TechnicianId;
  slot: SlotWindow;
};

export type ConfirmBookingInput = {
  customerId: CustomerId;
  vehicleVin: Vin;
  dealershipId: DealershipId;
  bayId: BayId;
  technicianId: TechnicianId;
  serviceTypeId: ServiceTypeId;
  slot: SlotWindow;
  paymentReference: string;
};

export interface BookingRepository {
  /**
   * In-lock re-check against PostgreSQL. Returns true when either the bay
   * or the technician already has an overlapping CONFIRMED/PENDING
   * appointment for the requested window.
   */
  hasConflict(probe: AvailabilityProbe): Promise<boolean>;

  /**
   * Atomically inserts the Appointment row and the matching outbox row
   * inside one transaction. Throws {@link SlotAlreadyBookedError} if a
   * concurrent writer slipped a conflicting row in between the re-check
   * and the insert.
   */
  confirm(input: ConfirmBookingInput): Promise<Appointment>;
}

export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');
