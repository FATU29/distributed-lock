import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';

import { AppointmentsService } from '../../../application/appointments/appointments.service';
import { AppointmentId } from '../../../domain/identifiers/appointment-id.vo';
import { CustomerId } from '../../../domain/identifiers/customer-id.vo';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import {
  toAppointmentListResponse,
  toAppointmentResponse,
  type AppointmentListResponse,
  type AppointmentResponse,
} from './dtos/appointment.response';
import { ListAppointmentsQueryDto } from './dtos/list-appointments.query.dto';
import { PatchAppointmentDto } from './dtos/patch-appointment.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  async list(
    @Query() query: ListAppointmentsQueryDto,
  ): Promise<AppointmentListResponse> {
    const page = await this.appointments.list({
      limit: query.limit,
      offset: query.offset,
      customerId: query.customerId
        ? CustomerId.from(query.customerId)
        : undefined,
      dealershipId: query.dealershipId
        ? DealershipId.from(query.dealershipId)
        : undefined,
    });
    return toAppointmentListResponse(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<AppointmentResponse> {
    const row = await this.appointments.findById(AppointmentId.from(id));
    return toAppointmentResponse(row);
  }

  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchAppointmentDto,
  ): Promise<AppointmentResponse> {
    const row = await this.appointments.update(AppointmentId.from(id), {
      status: dto.status,
      slotStart:
        dto.slotStart !== undefined ? new Date(dto.slotStart) : undefined,
      slotEnd: dto.slotEnd !== undefined ? new Date(dto.slotEnd) : undefined,
    });
    return toAppointmentResponse(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.appointments.delete(AppointmentId.from(id));
  }
}
