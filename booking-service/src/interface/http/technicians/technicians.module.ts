import { Module } from '@nestjs/common';

import { TechniciansService } from '../../../application/technicians/technicians.service';
import { TECHNICIAN_REPOSITORY } from '../../../domain/ports';
import { PrismaTechnicianRepository } from '../../../infrastructure/persistence/technician.repository';
import { TechniciansController } from './technicians.controller';

@Module({
  controllers: [TechniciansController],
  providers: [
    TechniciansService,
    { provide: TECHNICIAN_REPOSITORY, useClass: PrismaTechnicianRepository },
  ],
})
export class TechniciansModule {}
