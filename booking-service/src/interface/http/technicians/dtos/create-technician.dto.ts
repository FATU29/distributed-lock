import {
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTechnicianDto {
  @IsUUID('4')
  dealershipId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  qualifiedServiceTypeIds!: string[];
}
