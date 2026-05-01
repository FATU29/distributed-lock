import { assertUuid } from './assert-uuid';

export class DealershipId {
  private constructor(readonly value: string) {}

  static from(raw: string): DealershipId {
    assertUuid(raw, 'dealership id');
    return new DealershipId(raw);
  }
}
