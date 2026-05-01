import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  AppointmentNotFoundError,
  InvalidSlotWindowError,
} from '../../../domain/appointment/errors';
import {
  DealershipCodeAlreadyExistsError,
  DealershipNotFoundError,
} from '../../../domain/dealership/errors';
import {
  EmptyUpdateError,
  ForeignKeyReferenceError,
} from '../../../domain/reference.errors';
import { ServiceBayNotFoundError } from '../../../domain/service-bay/errors';
import {
  ServiceTypeCodeAlreadyExistsError,
  ServiceTypeNotFoundError,
} from '../../../domain/service-type/errors';
import { TechnicianNotFoundError } from '../../../domain/technician/errors';
import {
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../../domain/user/errors';
import {
  VehicleNotFoundError,
  VehicleVinAlreadyExistsError,
} from '../../../domain/vehicle/errors';

type DomainErrorMapping = {
  status: HttpStatus;
  code: string;
};

const MAPPINGS: ReadonlyArray<{
  type: new (...args: never[]) => Error;
  mapping: DomainErrorMapping;
}> = [
  {
    type: UserAlreadyExistsError,
    mapping: { status: HttpStatus.CONFLICT, code: 'USER_ALREADY_EXISTS' },
  },
  {
    type: UserNotFoundError,
    mapping: { status: HttpStatus.NOT_FOUND, code: 'USER_NOT_FOUND' },
  },
  {
    type: DealershipNotFoundError,
    mapping: { status: HttpStatus.NOT_FOUND, code: 'DEALERSHIP_NOT_FOUND' },
  },
  {
    type: DealershipCodeAlreadyExistsError,
    mapping: {
      status: HttpStatus.CONFLICT,
      code: 'DEALERSHIP_CODE_ALREADY_EXISTS',
    },
  },
  {
    type: ServiceTypeNotFoundError,
    mapping: { status: HttpStatus.NOT_FOUND, code: 'SERVICE_TYPE_NOT_FOUND' },
  },
  {
    type: ServiceTypeCodeAlreadyExistsError,
    mapping: {
      status: HttpStatus.CONFLICT,
      code: 'SERVICE_TYPE_CODE_ALREADY_EXISTS',
    },
  },
  {
    type: ServiceBayNotFoundError,
    mapping: { status: HttpStatus.NOT_FOUND, code: 'SERVICE_BAY_NOT_FOUND' },
  },
  {
    type: TechnicianNotFoundError,
    mapping: { status: HttpStatus.NOT_FOUND, code: 'TECHNICIAN_NOT_FOUND' },
  },
  {
    type: VehicleNotFoundError,
    mapping: { status: HttpStatus.NOT_FOUND, code: 'VEHICLE_NOT_FOUND' },
  },
  {
    type: VehicleVinAlreadyExistsError,
    mapping: {
      status: HttpStatus.CONFLICT,
      code: 'VEHICLE_VIN_ALREADY_EXISTS',
    },
  },
  {
    type: AppointmentNotFoundError,
    mapping: { status: HttpStatus.NOT_FOUND, code: 'APPOINTMENT_NOT_FOUND' },
  },
  {
    type: InvalidSlotWindowError,
    mapping: { status: HttpStatus.BAD_REQUEST, code: 'INVALID_SLOT_WINDOW' },
  },
  {
    type: ForeignKeyReferenceError,
    mapping: { status: HttpStatus.BAD_REQUEST, code: 'FOREIGN_KEY_REFERENCE' },
  },
  {
    type: EmptyUpdateError,
    mapping: { status: HttpStatus.BAD_REQUEST, code: 'EMPTY_UPDATE' },
  },
];

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(err: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse();
      res
        .status(status)
        .json(typeof body === 'string' ? { message: body } : body);
      return;
    }

    if (err instanceof Error) {
      for (const { type, mapping } of MAPPINGS) {
        if (err instanceof type) {
          res.status(mapping.status).json({
            statusCode: mapping.status,
            error: mapping.code,
            message: err.message,
          });
          return;
        }
      }
    }

    this.logger.error('Unhandled exception', err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  }
}
