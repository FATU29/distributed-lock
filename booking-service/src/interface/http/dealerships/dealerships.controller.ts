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

import { DealershipsService } from '../../../application/dealerships/dealerships.service';
import { DealershipId } from '../../../domain/identifiers/dealership-id.vo';
import { ListPageQueryDto } from '../common/list-page.query.dto';
import { CreateDealershipDto } from './dtos/create-dealership.dto';
import {
  toDealershipListResponse,
  toDealershipResponse,
  type DealershipListResponse,
  type DealershipResponse,
} from './dtos/dealership.response';
import { UpdateDealershipDto } from './dtos/update-dealership.dto';

@Controller('dealerships')
export class DealershipsController {
  constructor(private readonly dealerships: DealershipsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDealershipDto): Promise<DealershipResponse> {
    const row = await this.dealerships.create({
      code: dto.code,
      name: dto.name,
    });
    return toDealershipResponse(row);
  }

  @Get()
  async list(
    @Query() query: ListPageQueryDto,
  ): Promise<DealershipListResponse> {
    const page = await this.dealerships.list({
      limit: query.limit,
      offset: query.offset,
    });
    return toDealershipListResponse(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<DealershipResponse> {
    const row = await this.dealerships.findById(DealershipId.from(id));
    return toDealershipResponse(row);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDealershipDto,
  ): Promise<DealershipResponse> {
    const patch: { code?: string; name?: string } = {};
    if (dto.code !== undefined) {
      patch.code = dto.code;
    }
    if (dto.name !== undefined) {
      patch.name = dto.name;
    }
    const row = await this.dealerships.update(DealershipId.from(id), patch);
    return toDealershipResponse(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.dealerships.delete(DealershipId.from(id));
  }
}
