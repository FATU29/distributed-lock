export class SlotWindow {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static fromStartEnd(start: Date, end: Date): SlotWindow {
    if (!(start instanceof Date) || !(end instanceof Date)) {
      throw new Error('Slot window requires Date instances');
    }
    if (start.getTime() >= end.getTime()) {
      throw new Error('Slot window must be half-open: start < end');
    }
    return new SlotWindow(start, end);
  }
}
