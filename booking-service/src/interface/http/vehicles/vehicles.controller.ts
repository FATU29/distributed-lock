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

import { VehiclesService } from '../../../application/vehicles/vehicles.service';
import { CustomerId } from '../../../domain/identifiers/customer-id.vo';
import { VehicleId } from '../../../domain/identifiers/vehicle-id.vo';
import { CreateVehicleDto } from './dtos/create-vehicle.dto';
import { ListVehiclesQueryDto } from './dtos/list-vehicles.query.dto';
import {
  toVehicleListResponse,
  toVehicleResponse,
  type VehicleListResponse,
  type VehicleResponse,
} from './dtos/vehicle.response';
import { UpdateVehicleDto } from './dtos/update-vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateVehicleDto): Promise<VehicleResponse> {
    const row = await this.vehicles.create({
      customerId: CustomerId.from(dto.customerId),
      vin: dto.vin,
      label: dto.label ?? null,
    });
    return toVehicleResponse(row);
  }

  @Get()
  async list(
    @Query() query: ListVehiclesQueryDto,
  ): Promise<VehicleListResponse> {
    const page = await this.vehicles.list({
      limit: query.limit,
      offset: query.offset,
      customerId: query.customerId
        ? CustomerId.from(query.customerId)
        : undefined,
    });
    return toVehicleListResponse(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<VehicleResponse> {
    const row = await this.vehicles.findById(VehicleId.from(id));
    return toVehicleResponse(row);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponse> {
    const patch: {
      customerId?: ReturnType<typeof CustomerId.from>;
      vin?: string;
      label?: string | null;
    } = {};
    if (dto.customerId !== undefined) {
      patch.customerId = CustomerId.from(dto.customerId);
    }
    if (dto.vin !== undefined) {
      patch.vin = dto.vin;
    }
    if (dto.label !== undefined) {
      patch.label = dto.label;
    }
    const row = await this.vehicles.update(VehicleId.from(id), patch);
    return toVehicleResponse(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.vehicles.delete(VehicleId.from(id));
  }
}
