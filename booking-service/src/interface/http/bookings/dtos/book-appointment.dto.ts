import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BookAppointmentDto {
  @IsUUID()
  customerId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(32)
  vehicleVin!: string;

  @IsUUID()
  dealershipId!: string;

  @IsUUID()
  bayId!: string;

  @IsUUID()
  technicianId!: string;

  @IsUUID()
  serviceTypeId!: string;

  @IsDateString()
  slotStart!: string;

  @IsDateString()
  slotEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
