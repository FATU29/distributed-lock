import type { AppointmentPage } from '../../../../domain/ports';
import type { Appointment } from '../../../../domain/appointment/appointment.entity';

export type AppointmentResponse = {
  id: string;
  customerId: string;
  vehicleVin: string;
  dealershipId: string;
  bayId: string;
  technicianId: string;
  serviceTypeId: string;
  slotStart: string;
  slotEnd: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentListResponse = {
  total: number;
  items: AppointmentResponse[];
};

export function toAppointmentResponse(a: Appointment): AppointmentResponse {
  return {
    id: a.id.value,
    customerId: a.customerId.value,
    vehicleVin: a.vehicleVin.value,
    dealershipId: a.dealershipId.value,
    bayId: a.bayId.value,
    technicianId: a.technicianId.value,
    serviceTypeId: a.serviceTypeId.value,
    slotStart: a.slot.start.toISOString(),
    slotEnd: a.slot.end.toISOString(),
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function toAppointmentListResponse(
  page: AppointmentPage,
): AppointmentListResponse {
  return {
    total: page.total,
    items: page.items.map(toAppointmentResponse),
  };
}
