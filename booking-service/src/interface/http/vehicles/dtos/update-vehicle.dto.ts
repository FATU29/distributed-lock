import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  vin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string | null;
}
