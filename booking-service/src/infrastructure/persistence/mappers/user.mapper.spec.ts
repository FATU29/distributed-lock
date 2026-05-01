import type { User as UserRow } from '@prisma/client';

import { UserId } from '../../../domain/identifiers/user-id.vo';
import { User } from '../../../domain/user/user.entity';
import { mapUserRowToDomain } from './user.mapper';

describe('mapUserRowToDomain', () => {
  it('maps persisted row to domain User', () => {
    const row: UserRow = {
      id: 'a1111111-1111-4111-8111-111111111101',
      email: 'alice@example.test',
      displayName: 'Alice Test',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const domain = mapUserRowToDomain(row);
    expect(domain).toBeInstanceOf(User);
    expect(domain.id).toEqual(UserId.from(row.id));
    expect(domain.email).toBe(row.email);
    expect(domain.displayName).toBe(row.displayName);
    expect(domain.createdAt).toEqual(row.createdAt);
    expect(domain.updatedAt).toEqual(row.updatedAt);
  });
});
