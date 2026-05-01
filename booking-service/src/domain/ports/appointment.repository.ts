import type { AppointmentStatus } from '../appointment/appointment-status.vo';
import type { Appointment } from '../appointment/appointment.entity';
import type { AppointmentId } from '../identifiers/appointment-id.vo';
import type { CustomerId } from '../identifiers/customer-id.vo';
import type { DealershipId } from '../identifiers/dealership-id.vo';

export type UpdateAppointmentInput = {
  status?: AppointmentStatus;
  slotStart?: Date;
  slotEnd?: Date;
};

export type ListAppointmentsQuery = {
  limit: number;
  offset: number;
  customerId?: CustomerId;
  dealershipId?: DealershipId;
};

export type AppointmentPage = {
  items: Appointment[];
  total: number;
};

export interface AppointmentRepository {
  findById(id: AppointmentId): Promise<Appointment | null>;
  list(query: ListAppointmentsQuery): Promise<AppointmentPage>;
  update(
    id: AppointmentId,
    input: UpdateAppointmentInput,
  ): Promise<Appointment>;
  delete(id: AppointmentId): Promise<void>;
}

export const APPOINTMENT_REPOSITORY = Symbol('APPOINTMENT_REPOSITORY');
