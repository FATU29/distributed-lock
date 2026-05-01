import { Module } from '@nestjs/common';

import { BookAppointmentUseCase } from '../../../application/book-appointment/book-appointment.use-case';
import { BOOKING_REPOSITORY, PAYMENT_GATEWAY } from '../../../domain/ports';
import { MockPaymentGateway } from '../../../infrastructure/payment/mock-payment.gateway';
import { PrismaBookingRepository } from '../../../infrastructure/persistence/booking.repository';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingsController } from './bookings.controller';

@Module({
  imports: [AvailabilityModule],
  controllers: [BookingsController],
  providers: [
    BookAppointmentUseCase,
    {
      provide: BOOKING_REPOSITORY,
      useClass: PrismaBookingRepository,
    },
    {
      provide: PAYMENT_GATEWAY,
      useClass: MockPaymentGateway,
    },
  ],
})
export class BookingsModule {}
