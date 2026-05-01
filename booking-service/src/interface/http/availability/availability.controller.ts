import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsDateString, IsUUID } from 'class-validator';

import {
  DealershipScheduleService,
  type DayAvailability,
} from '../../../application/schedule/dealership-schedule.service';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';

class AvailabilityQueryDto {
  @IsDateString()
  date!: string;
}

class AvailabilityParamsDto {
  @IsUUID()
  dealershipId!: string;
}

@Controller('dealerships/:dealershipId/availability')
export class AvailabilityController {
  constructor(private readonly schedule: DealershipScheduleService) {}

  @Get()
  async getDay(
    @Param() params: AvailabilityParamsDto,
    @Query() query: AvailabilityQueryDto,
  ): Promise<DayAvailability> {
    return this.schedule.getDayAvailability(
      DealershipId.from(params.dealershipId),
      new Date(query.date),
    );
  }
}
