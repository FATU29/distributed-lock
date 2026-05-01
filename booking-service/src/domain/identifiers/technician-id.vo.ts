import { assertUuid } from './assert-uuid';

export class TechnicianId {
  private constructor(readonly value: string) {}

  static from(raw: string): TechnicianId {
    assertUuid(raw, 'technician id');
    return new TechnicianId(raw);
  }
}
