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

import { ServiceBaysService } from '../../../application/service-bays/service-bays.service';
import { BayId } from '../../../domain/identifiers/bay-id.vo';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { CreateServiceBayDto } from './dtos/create-service-bay.dto';
import { ListServiceBaysQueryDto } from './dtos/list-service-bays.query.dto';
import {
  toServiceBayListResponse,
  toServiceBayResponse,
  type ServiceBayListResponse,
  type ServiceBayResponse,
} from './dtos/service-bay.response';
import { UpdateServiceBayDto } from './dtos/update-service-bay.dto';

@Controller('service-bays')
export class ServiceBaysController {
  constructor(private readonly bays: ServiceBaysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateServiceBayDto): Promise<ServiceBayResponse> {
    const row = await this.bays.create({
      dealershipId: DealershipId.from(dto.dealershipId),
      label: dto.label,
    });
    return toServiceBayResponse(row);
  }

  @Get()
  async list(
    @Query() query: ListServiceBaysQueryDto,
  ): Promise<ServiceBayListResponse> {
    const page = await this.bays.list({
      limit: query.limit,
      offset: query.offset,
      dealershipId: query.dealershipId
        ? DealershipId.from(query.dealershipId)
        : undefined,
    });
    return toServiceBayListResponse(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<ServiceBayResponse> {
    const row = await this.bays.findById(BayId.from(id));
    return toServiceBayResponse(row);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceBayDto,
  ): Promise<ServiceBayResponse> {
    const patch: {
      dealershipId?: ReturnType<typeof DealershipId.from>;
      label?: string;
    } = {};
    if (dto.dealershipId !== undefined) {
      patch.dealershipId = DealershipId.from(dto.dealershipId);
    }
    if (dto.label !== undefined) {
      patch.label = dto.label;
    }
    const row = await this.bays.update(BayId.from(id), patch);
    return toServiceBayResponse(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.bays.delete(BayId.from(id));
  }
}
