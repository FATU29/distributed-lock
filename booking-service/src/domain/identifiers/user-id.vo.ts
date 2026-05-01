import { assertUuid } from './assert-uuid';

export class UserId {
  private constructor(readonly value: string) {}

  static from(raw: string): UserId {
    assertUuid(raw, 'user id');
    return new UserId(raw);
  }
}
