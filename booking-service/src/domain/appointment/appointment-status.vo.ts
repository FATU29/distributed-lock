export const appointmentStatuses = [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export function assertAppointmentStatus(raw: string): AppointmentStatus {
  if (!appointmentStatuses.includes(raw as AppointmentStatus)) {
    throw new Error('Invalid appointment status');
  }
  return raw as AppointmentStatus;
}
