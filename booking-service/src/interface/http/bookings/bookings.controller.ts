import { randomUUID } from 'node:crypto';

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { BookAppointmentUseCase } from '../../../application/book-appointment/book-appointment.use-case';
import { SlotWindow } from '../../../domain/appointment/slot-window.vo';
import { InvalidSlotWindowError } from '../../../domain/appointment/errors';
import { BayId } from '../../../domain/identifiers/bay-id.vo';
import { CustomerId } from '../../../domain/identifiers/customer-id.vo';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { ServiceTypeId } from '../../../domain/identifiers/service-type-id.vo';
import { TechnicianId } from '../../../domain/identifiers/technician-id.vo';
import { Vin } from '../../../domain/identifiers/vin.vo';
import { BookAppointmentDto } from './dtos/book-appointment.dto';
import {
  toBookingResponse,
  type BookingResponse,
} from './dtos/booking.response';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookAppointment: BookAppointmentUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async confirm(@Body() dto: BookAppointmentDto): Promise<BookingResponse> {
    let slot: SlotWindow;
    try {
      slot = SlotWindow.fromStartEnd(
        new Date(dto.slotStart),
        new Date(dto.slotEnd),
      );
    } catch {
      throw new InvalidSlotWindowError(
        'slotStart and slotEnd must form a valid half-open window (start < end)',
      );
    }

    const appointment = await this.bookAppointment.execute({
      customerId: CustomerId.from(dto.customerId),
      vehicleVin: Vin.from(dto.vehicleVin),
      dealershipId: DealershipId.from(dto.dealershipId),
      bayId: BayId.from(dto.bayId),
      technicianId: TechnicianId.from(dto.technicianId),
      serviceTypeId: ServiceTypeId.from(dto.serviceTypeId),
      slot,
      idempotencyKey: dto.idempotencyKey ?? randomUUID(),
    });
    return toBookingResponse(appointment);
  }
}
