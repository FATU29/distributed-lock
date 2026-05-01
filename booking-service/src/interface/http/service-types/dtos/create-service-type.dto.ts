import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(24 * 60)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  requiredSkillTag?: string | null;
}
