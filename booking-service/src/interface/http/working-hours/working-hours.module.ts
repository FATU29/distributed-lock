import { Module } from '@nestjs/common';

import { WorkingHoursService } from '../../../application/working-hours/working-hours.service';
import { WORKING_HOURS_REPOSITORY } from '../../../domain/ports';
import { PrismaWorkingHoursRepository } from '../../../infrastructure/persistence/working-hours.repository';
import { WorkingHoursController } from './working-hours.controller';

@Module({
  controllers: [WorkingHoursController],
  providers: [
    WorkingHoursService,
    {
      provide: WORKING_HOURS_REPOSITORY,
      useClass: PrismaWorkingHoursRepository,
    },
  ],
  exports: [WorkingHoursService, WORKING_HOURS_REPOSITORY],
})
export class WorkingHoursModule {}
