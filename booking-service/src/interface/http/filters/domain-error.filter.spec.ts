import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

import {
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../../domain/user/errors';
import { DomainErrorFilter } from './domain-error.filter';

function makeHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res = { status } as unknown;
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('DomainErrorFilter', () => {
  let filter: DomainErrorFilter;

  beforeEach(() => {
    filter = new DomainErrorFilter();
  });

  it('maps UserAlreadyExistsError to 409', () => {
    const { host, status, json } = makeHost();
    filter.catch(new UserAlreadyExistsError('a@b.test'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'USER_ALREADY_EXISTS' }),
    );
  });

  it('maps UserNotFoundError to 404', () => {
    const { host, status, json } = makeHost();
    filter.catch(new UserNotFoundError('id=x'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'USER_NOT_FOUND' }),
    );
  });

  it('passes HttpException through with its own status', () => {
    const { host, status, json } = makeHost();
    filter.catch(
      new HttpException('bad request', HttpStatus.BAD_REQUEST),
      host,
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalled();
  });

  it('falls back to 500 for unknown errors', () => {
    const { host, status, json } = makeHost();
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
    filter.catch(new Error('boom'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'INTERNAL_SERVER_ERROR' }),
    );
  });
});
