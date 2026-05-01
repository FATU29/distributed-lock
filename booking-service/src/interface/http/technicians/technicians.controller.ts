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

import { TechniciansService } from '../../../application/technicians/technicians.service';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { ServiceTypeId } from '../../../domain/identifiers/service-type-id.vo';
import { TechnicianId } from '../../../domain/identifiers/technician-id.vo';
import { CreateTechnicianDto } from './dtos/create-technician.dto';
import { ListTechniciansQueryDto } from './dtos/list-technicians.query.dto';
import {
  toTechnicianListResponse,
  toTechnicianResponse,
  type TechnicianListResponse,
  type TechnicianResponse,
} from './dtos/technician.response';
import { UpdateTechnicianDto } from './dtos/update-technician.dto';

@Controller('technicians')
export class TechniciansController {
  constructor(private readonly technicians: TechniciansService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTechnicianDto): Promise<TechnicianResponse> {
    const row = await this.technicians.create({
      dealershipId: DealershipId.from(dto.dealershipId),
      name: dto.name,
      qualifiedServiceTypeIds: dto.qualifiedServiceTypeIds.map((id) =>
        ServiceTypeId.from(id),
      ),
    });
    return toTechnicianResponse(row);
  }

  @Get()
  async list(
    @Query() query: ListTechniciansQueryDto,
  ): Promise<TechnicianListResponse> {
    const page = await this.technicians.list({
      limit: query.limit,
      offset: query.offset,
      dealershipId: query.dealershipId
        ? DealershipId.from(query.dealershipId)
        : undefined,
    });
    return toTechnicianListResponse(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<TechnicianResponse> {
    const row = await this.technicians.findById(TechnicianId.from(id));
    return toTechnicianResponse(row);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianDto,
  ): Promise<TechnicianResponse> {
    const patch: {
      dealershipId?: ReturnType<typeof DealershipId.from>;
      name?: string;
      qualifiedServiceTypeIds?: ReturnType<typeof ServiceTypeId.from>[];
    } = {};
    if (dto.dealershipId !== undefined) {
      patch.dealershipId = DealershipId.from(dto.dealershipId);
    }
    if (dto.name !== undefined) {
      patch.name = dto.name;
    }
    if (dto.qualifiedServiceTypeIds !== undefined) {
      patch.qualifiedServiceTypeIds = dto.qualifiedServiceTypeIds.map((x) =>
        ServiceTypeId.from(x),
      );
    }
    const row = await this.technicians.update(TechnicianId.from(id), patch);
    return toTechnicianResponse(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.technicians.delete(TechnicianId.from(id));
  }
}
