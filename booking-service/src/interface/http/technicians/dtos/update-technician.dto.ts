import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTechnicianDto {
  @IsOptional()
  @IsUUID('4')
  dealershipId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  qualifiedServiceTypeIds?: string[];
}
