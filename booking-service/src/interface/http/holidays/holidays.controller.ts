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

import { HolidaysService } from '../../../application/holidays/holidays.service';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { HolidayId } from '../../../domain/identifiers/holiday-id.vo';
import { CreateHolidayDto } from './dtos/create-holiday.dto';
import {
  toHolidayListResponse,
  toHolidayResponse,
  type HolidayListResponse,
  type HolidayResponse,
} from './dtos/holiday.response';
import { ListHolidaysQueryDto } from './dtos/list-holidays.query.dto';
import { UpdateHolidayDto } from './dtos/update-holiday.dto';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateHolidayDto): Promise<HolidayResponse> {
    const holiday = await this.service.create({
      dealershipId: DealershipId.from(dto.dealershipId),
      date: new Date(dto.date),
      name: dto.name,
      isRecurring: dto.isRecurring ?? false,
    });
    return toHolidayResponse(holiday);
  }

  @Get()
  async list(
    @Query() query: ListHolidaysQueryDto,
  ): Promise<HolidayListResponse> {
    const page = await this.service.list({
      dealershipId: DealershipId.from(query.dealershipId),
      limit: query.limit,
      offset: query.offset,
    });
    return toHolidayListResponse(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<HolidayResponse> {
    const h = await this.service.findById(HolidayId.from(id));
    return toHolidayResponse(h);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
  ): Promise<HolidayResponse> {
    const h = await this.service.update(HolidayId.from(id), {
      date: dto.date !== undefined ? new Date(dto.date) : undefined,
      name: dto.name,
      isRecurring: dto.isRecurring,
    });
    return toHolidayResponse(h);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.service.delete(HolidayId.from(id));
  }
}
