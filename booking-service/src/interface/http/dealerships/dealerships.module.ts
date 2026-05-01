import { Module } from '@nestjs/common';

import { DealershipsService } from '../../../application/dealerships/dealerships.service';
import { DEALERSHIP_REPOSITORY } from '../../../domain/ports';
import { PrismaDealershipRepository } from '../../../infrastructure/persistence/dealership.repository';
import { DealershipsController } from './dealerships.controller';

@Module({
  controllers: [DealershipsController],
  providers: [
    DealershipsService,
    { provide: DEALERSHIP_REPOSITORY, useClass: PrismaDealershipRepository },
  ],
})
export class DealershipsModule {}
