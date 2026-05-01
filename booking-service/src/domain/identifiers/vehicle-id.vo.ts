import { assertUuid } from './assert-uuid';

export class VehicleId {
  private constructor(readonly value: string) {}

  static from(raw: string): VehicleId {
    assertUuid(raw, 'vehicle id');
    return new VehicleId(raw);
  }
}
