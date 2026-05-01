import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { WorkingHoursService } from '../../../application/working-hours/working-hours.service';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { WorkingHoursId } from '../../../domain/identifiers/working-hours-id.vo';
import { assertDayOfWeek } from '../../../domain/schedule/day-of-week.vo';
import { CreateWorkingHoursDto } from './dtos/create-working-hours.dto';
import { UpdateWorkingHoursDto } from './dtos/update-working-hours.dto';
import {
  toWorkingHoursResponse,
  type WorkingHoursResponse,
} from './dtos/working-hours.response';

@Controller('working-hours')
export class WorkingHoursController {
  constructor(private readonly service: WorkingHoursService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateWorkingHoursDto,
  ): Promise<WorkingHoursResponse> {
    const wh = await this.service.create({
      dealershipId: DealershipId.from(dto.dealershipId),
      dayOfWeek: assertDayOfWeek(dto.dayOfWeek),
      openMinutes: dto.openMinutes,
      closeMinutes: dto.closeMinutes,
      isClosed: dto.isClosed ?? false,
    });
    return toWorkingHoursResponse(wh);
  }

  @Get()
  async list(
    @Query('dealershipId') dealershipId: string,
  ): Promise<WorkingHoursResponse[]> {
    const rows = await this.service.list(DealershipId.from(dealershipId));
    return rows.map(toWorkingHoursResponse);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<WorkingHoursResponse> {
    const wh = await this.service.findById(WorkingHoursId.from(id));
    return toWorkingHoursResponse(wh);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkingHoursDto,
  ): Promise<WorkingHoursResponse> {
    const wh = await this.service.update(WorkingHoursId.from(id), {
      openMinutes: dto.openMinutes,
      closeMinutes: dto.closeMinutes,
      isClosed: dto.isClosed,
    });
    return toWorkingHoursResponse(wh);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.service.delete(WorkingHoursId.from(id));
  }
}
