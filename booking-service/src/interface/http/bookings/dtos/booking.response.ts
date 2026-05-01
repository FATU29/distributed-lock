import type { Appointment } from '../../../../domain/appointment/appointment.entity';

export type BookingResponse = {
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

export function toBookingResponse(a: Appointment): BookingResponse {
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
