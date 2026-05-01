import { Module } from '@nestjs/common';

import { ServiceTypesService } from '../../../application/service-types/service-types.service';
import { SERVICE_TYPE_REPOSITORY } from '../../../domain/ports';
import { PrismaServiceTypeRepository } from '../../../infrastructure/persistence/service-type.repository';
import { ServiceTypesController } from './service-types.controller';

@Module({
  controllers: [ServiceTypesController],
  providers: [
    ServiceTypesService,
    {
      provide: SERVICE_TYPE_REPOSITORY,
      useClass: PrismaServiceTypeRepository,
    },
  ],
})
export class ServiceTypesModule {}
