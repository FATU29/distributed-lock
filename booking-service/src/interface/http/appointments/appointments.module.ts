import { Module } from '@nestjs/common';

import { AppointmentsService } from '../../../application/appointments/appointments.service';
import { APPOINTMENT_REPOSITORY } from '../../../domain/ports';
import { PrismaAppointmentRepository } from '../../../infrastructure/persistence/appointment.repository';
import { AppointmentsController } from './appointments.controller';

@Module({
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    {
      provide: APPOINTMENT_REPOSITORY,
      useClass: PrismaAppointmentRepository,
    },
  ],
})
export class AppointmentsModule {}
