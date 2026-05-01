import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

import { MINUTES_PER_DAY } from '../../../../domain/schedule/minute-of-day.vo';

export class UpdateWorkingHoursDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  openMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  closeMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}
