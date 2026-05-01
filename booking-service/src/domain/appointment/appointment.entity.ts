import { AppointmentId } from '../identifiers/appointment-id.vo';
import { BayId } from '../identifiers/bay-id.vo';
import { CustomerId } from '../identifiers/customer-id.vo';
import { DealershipId } from '../identifiers/dealership-id.vo';
import { ServiceTypeId } from '../identifiers/service-type-id.vo';
import { TechnicianId } from '../identifiers/technician-id.vo';
import { Vin } from '../identifiers/vin.vo';
import type { AppointmentStatus } from './appointment-status.vo';
import type { SlotWindow } from './slot-window.vo';

export class Appointment {
  constructor(
    readonly id: AppointmentId,
    readonly customerId: CustomerId,
    readonly vehicleVin: Vin,
    readonly dealershipId: DealershipId,
    readonly bayId: BayId,
    readonly technicianId: TechnicianId,
    readonly serviceTypeId: ServiceTypeId,
    readonly slot: SlotWindow,
    readonly status: AppointmentStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
