import { assertUuid } from './assert-uuid';

export class BayId {
  private constructor(readonly value: string) {}

  static from(raw: string): BayId {
    assertUuid(raw, 'bay id');
    return new BayId(raw);
  }
}
