import type { User as UserRow } from '@prisma/client';

import { UserId } from '../../../domain/identifiers/user-id.vo';
import { User } from '../../../domain/user/user.entity';

export function mapUserRowToDomain(row: UserRow): User {
  return new User(
    UserId.from(row.id),
    row.email,
    row.displayName,
    row.createdAt,
    row.updatedAt,
  );
}
