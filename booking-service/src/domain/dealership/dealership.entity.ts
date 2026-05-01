import { DealershipId } from '../identifiers/dealership-id.vo';

export class Dealership {
  constructor(
    readonly id: DealershipId,
    readonly code: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
