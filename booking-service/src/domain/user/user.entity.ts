import { UserId } from '../identifiers/user-id.vo';

export class User {
  constructor(
    readonly id: UserId,
    readonly email: string,
    readonly displayName: string | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
