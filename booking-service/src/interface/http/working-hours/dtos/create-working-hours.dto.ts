import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { MINUTES_PER_DAY } from '../../../../domain/schedule/minute-of-day.vo';

export class CreateWorkingHoursDto {
  @IsUUID()
  dealershipId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  openMinutes!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  closeMinutes!: number;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}
