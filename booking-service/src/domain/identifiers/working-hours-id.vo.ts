import { assertUuid } from './assert-uuid';

export class WorkingHoursId {
  private constructor(readonly value: string) {}

  static from(raw: string): WorkingHoursId {
    assertUuid(raw, 'working hours id');
    return new WorkingHoursId(raw);
  }
}
