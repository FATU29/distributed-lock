import { Module } from '@nestjs/common';

import { HolidaysService } from '../../../application/holidays/holidays.service';
import { HOLIDAY_REPOSITORY } from '../../../domain/ports';
import { PrismaHolidayRepository } from '../../../infrastructure/persistence/holiday.repository';
import { HolidaysController } from './holidays.controller';

@Module({
  controllers: [HolidaysController],
  providers: [
    HolidaysService,
    {
      provide: HOLIDAY_REPOSITORY,
      useClass: PrismaHolidayRepository,
    },
  ],
  exports: [HolidaysService, HOLIDAY_REPOSITORY],
})
export class HolidaysModule {}
