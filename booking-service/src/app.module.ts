import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ObservabilityModule } from './infrastructure/observability/observability.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisInfrastructureModule } from './infrastructure/redis/redis.module';
import { AppointmentsModule } from './interface/http/appointments/appointments.module';
import { AvailabilityModule } from './interface/http/availability/availability.module';
import { BookingsModule } from './interface/http/bookings/bookings.module';
import { DealershipsModule } from './interface/http/dealerships/dealerships.module';
import { HolidaysModule } from './interface/http/holidays/holidays.module';
import { WorkingHoursModule } from './interface/http/working-hours/working-hours.module';
import { ServiceBaysModule } from './interface/http/service-bays/service-bays.module';
import { ServiceTypesModule } from './interface/http/service-types/service-types.module';
import { TechniciansModule } from './interface/http/technicians/technicians.module';
import { UsersModule } from './interface/http/users/users.module';
import { VehiclesModule } from './interface/http/vehicles/vehicles.module';

@Module({
  imports: [
    PrismaModule,
    RedisInfrastructureModule,
    ObservabilityModule,
    UsersModule,
    DealershipsModule,
    ServiceTypesModule,
    ServiceBaysModule,
    TechniciansModule,
    VehiclesModule,
    AppointmentsModule,
    WorkingHoursModule,
    HolidaysModule,
    AvailabilityModule,
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
