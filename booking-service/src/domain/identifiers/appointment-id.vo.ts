import { assertUuid } from './assert-uuid';

export class AppointmentId {
  private constructor(readonly value: string) {}

  static from(raw: string): AppointmentId {
    assertUuid(raw, 'appointment id');
    return new AppointmentId(raw);
  }
}
