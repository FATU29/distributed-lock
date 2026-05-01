import { Module } from '@nestjs/common';

import { DealershipScheduleService } from '../../../application/schedule/dealership-schedule.service';
import { HolidaysModule } from '../holidays/holidays.module';
import { WorkingHoursModule } from '../working-hours/working-hours.module';
import { AvailabilityController } from './availability.controller';

@Module({
  imports: [WorkingHoursModule, HolidaysModule],
  controllers: [AvailabilityController],
  providers: [DealershipScheduleService],
  exports: [DealershipScheduleService],
})
export class AvailabilityModule {}
