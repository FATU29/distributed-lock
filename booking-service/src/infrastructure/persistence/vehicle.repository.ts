import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { Vin } from '../../domain/identifiers/vin.vo';
import type { VehicleId } from '../../domain/identifiers/vehicle-id.vo';
import type {
  CreateVehicleInput,
  ListVehiclesQuery,
  UpdateVehicleInput,
  VehiclePage,
  VehicleRepository,
} from '../../domain/ports';
import { ForeignKeyReferenceError } from '../../domain/reference.errors';
import {
  VehicleNotFoundError,
  VehicleVinAlreadyExistsError,
} from '../../domain/vehicle/errors';
import { Vehicle } from '../../domain/vehicle/vehicle.entity';
import { PrismaService } from '../prisma/prisma.service';
import { mapVehicleRowToDomain } from './mappers/vehicle.mapper';

@Injectable()
export class PrismaVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: VehicleId): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({
      where: { id: id.value },
    });
    return row ? mapVehicleRowToDomain(row) : null;
  }

  async create(input: CreateVehicleInput): Promise<Vehicle> {
    const vinValue = Vin.from(input.vin).value;
    try {
      const row = await this.prisma.vehicle.create({
        data: {
          vin: vinValue,
          customerId: input.customerId.value,
          label: input.label,
        },
      });
      return mapVehicleRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new VehicleVinAlreadyExistsError(vinValue);
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ForeignKeyReferenceError(
          `customer_id=${input.customerId.value}`,
        );
      }
      throw e;
    }
  }

  async list(query: ListVehiclesQuery): Promise<VehiclePage> {
    const where: Prisma.VehicleWhereInput = {};
    if (query.customerId) {
      where.customerId = query.customerId.value;
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return {
      items: rows.map(mapVehicleRowToDomain),
      total,
    };
  }

  async update(id: VehicleId, input: UpdateVehicleInput): Promise<Vehicle> {
    const data: Prisma.VehicleUpdateInput = {};
    if (input.customerId) {
      data.customer = { connect: { id: input.customerId.value } };
    }
    if (
      Object.prototype.hasOwnProperty.call(input, 'vin') &&
      input.vin !== undefined
    ) {
      data.vin = Vin.from(input.vin).value;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'label')) {
      data.label = input.label;
    }
    try {
      const row = await this.prisma.vehicle.update({
        where: { id: id.value },
        data,
      });
      return mapVehicleRowToDomain(row);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new VehicleNotFoundError(`id=${id.value}`);
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const vinRaw =
          Object.prototype.hasOwnProperty.call(input, 'vin') &&
          input.vin !== undefined
            ? input.vin
            : '';
        throw new VehicleVinAlreadyExistsError(Vin.from(vinRaw).value);
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new ForeignKeyReferenceError(
          'vehicle update referenced missing row',
        );
      }
      throw e;
    }
  }

  async delete(id: VehicleId): Promise<void> {
    try {
      await this.prisma.vehicle.delete({
        where: { id: id.value },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new VehicleNotFoundError(`id=${id.value}`);
      }
      throw e;
    }
  }
}
