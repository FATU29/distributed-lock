import { assertUuid } from './assert-uuid';

export class ServiceTypeId {
  private constructor(readonly value: string) {}

  static from(raw: string): ServiceTypeId {
    assertUuid(raw, 'service type id');
    return new ServiceTypeId(raw);
  }
}
