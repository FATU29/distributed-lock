import { assertUuid } from './assert-uuid';

export class HolidayId {
  private constructor(readonly value: string) {}

  static from(raw: string): HolidayId {
    assertUuid(raw, 'holiday id');
    return new HolidayId(raw);
  }
}
