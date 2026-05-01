import { IsDateString, IsIn, IsOptional } from 'class-validator';

import { appointmentStatuses } from '../../../../domain/appointment/appointment-status.vo';

export class PatchAppointmentDto {
  @IsOptional()
  @IsIn([...appointmentStatuses])
  status?: (typeof appointmentStatuses)[number];

  @IsOptional()
  @IsDateString()
  slotStart?: string;

  @IsOptional()
  @IsDateString()
  slotEnd?: string;
}
