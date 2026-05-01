import { Module } from '@nestjs/common';

import { ServiceBaysService } from '../../../application/service-bays/service-bays.service';
import { SERVICE_BAY_REPOSITORY } from '../../../domain/ports';
import { PrismaServiceBayRepository } from '../../../infrastructure/persistence/service-bay.repository';
import { ServiceBaysController } from './service-bays.controller';

@Module({
  controllers: [ServiceBaysController],
  providers: [
    ServiceBaysService,
    { provide: SERVICE_BAY_REPOSITORY, useClass: PrismaServiceBayRepository },
  ],
})
export class ServiceBaysModule {}
