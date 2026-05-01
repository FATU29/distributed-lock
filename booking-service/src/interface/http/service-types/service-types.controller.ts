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

import { ServiceTypesService } from '../../../application/service-types/service-types.service';
import { ServiceTypeId } from '../../../domain/identifiers/service-type-id.vo';
import { ListPageQueryDto } from '../common/list-page.query.dto';
import { CreateServiceTypeDto } from './dtos/create-service-type.dto';
import {
  toServiceTypeListResponse,
  toServiceTypeResponse,
  type ServiceTypeListResponse,
  type ServiceTypeResponse,
} from './dtos/service-type.response';
import { UpdateServiceTypeDto } from './dtos/update-service-type.dto';

@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly serviceTypes: ServiceTypesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateServiceTypeDto,
  ): Promise<ServiceTypeResponse> {
    const row = await this.serviceTypes.create({
      code: dto.code,
      name: dto.name,
      durationMinutes: dto.durationMinutes,
      requiredSkillTag: dto.requiredSkillTag ?? null,
    });
    return toServiceTypeResponse(row);
  }

  @Get()
  async list(
    @Query() query: ListPageQueryDto,
  ): Promise<ServiceTypeListResponse> {
    const page = await this.serviceTypes.list({
      limit: query.limit,
      offset: query.offset,
    });
    return toServiceTypeListResponse(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<ServiceTypeResponse> {
    const row = await this.serviceTypes.findById(ServiceTypeId.from(id));
    return toServiceTypeResponse(row);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceTypeDto,
  ): Promise<ServiceTypeResponse> {
    const patch: {
      code?: string;
      name?: string;
      durationMinutes?: number;
      requiredSkillTag?: string | null;
    } = {};
    if (dto.code !== undefined) {
      patch.code = dto.code;
    }
    if (dto.name !== undefined) {
      patch.name = dto.name;
    }
    if (dto.durationMinutes !== undefined) {
      patch.durationMinutes = dto.durationMinutes;
    }
    if (dto.requiredSkillTag !== undefined) {
      patch.requiredSkillTag = dto.requiredSkillTag;
    }
    const row = await this.serviceTypes.update(ServiceTypeId.from(id), patch);
    return toServiceTypeResponse(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.serviceTypes.delete(ServiceTypeId.from(id));
  }
}
