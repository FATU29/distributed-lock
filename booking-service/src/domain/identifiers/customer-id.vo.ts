import { assertUuid } from './assert-uuid';

export class CustomerId {
  private constructor(readonly value: string) {}

  static from(raw: string): CustomerId {
    assertUuid(raw, 'customer id');
    return new CustomerId(raw);
  }
}
