import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateServiceBayDto {
  @IsOptional()
  @IsUUID('4')
  dealershipId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  label?: string;
}
