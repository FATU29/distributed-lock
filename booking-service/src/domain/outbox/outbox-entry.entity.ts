export class OutboxEntry {
  constructor(
    readonly id: string,
    readonly aggregateType: string,
    readonly aggregateId: string,
    readonly eventType: string,
    readonly payload: unknown,
    readonly createdAt: Date,
    readonly publishedAt: Date | null,
  ) {}
}
