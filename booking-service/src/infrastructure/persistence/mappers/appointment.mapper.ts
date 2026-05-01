import type { Appointment as AppointmentRow } from '@prisma/client';

import { Appointment } from '../../../domain/appointment/appointment.entity';
import { assertAppointmentStatus } from '../../../domain/appointment/appointment-status.vo';
import { SlotWindow } from '../../../domain/appointment/slot-window.vo';
import { AppointmentId } from '../../../domain/identifiers/appointment-id.vo';
import { BayId } from '../../../domain/identifiers/bay-id.vo';
import { CustomerId } from '../../../domain/identifiers/customer-id.vo';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { ServiceTypeId } from '../../../domain/identifiers/service-type-id.vo';
import { TechnicianId } from '../../../domain/identifiers/technician-id.vo';
import { Vin } from '../../../domain/identifiers/vin.vo';

export function mapAppointmentRowToDomain(row: AppointmentRow): Appointment {
  return new Appointment(
    AppointmentId.from(row.id),
    CustomerId.from(row.customerId),
    Vin.from(row.vehicleVin),
    DealershipId.from(row.dealershipId),
    BayId.from(row.bayId),
    TechnicianId.from(row.technicianId),
    ServiceTypeId.from(row.serviceTypeId),
    SlotWindow.fromStartEnd(row.slotStart, row.slotEnd),
    assertAppointmentStatus(row.status),
    row.createdAt,
    row.updatedAt,
  );
}
