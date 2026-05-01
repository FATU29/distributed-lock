import { Module } from '@nestjs/common';

import { VehiclesService } from '../../../application/vehicles/vehicles.service';
import { VEHICLE_REPOSITORY } from '../../../domain/ports';
import { PrismaVehicleRepository } from '../../../infrastructure/persistence/vehicle.repository';
import { VehiclesController } from './vehicles.controller';

@Module({
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    { provide: VEHICLE_REPOSITORY, useClass: PrismaVehicleRepository },
  ],
})
export class VehiclesModule {}
