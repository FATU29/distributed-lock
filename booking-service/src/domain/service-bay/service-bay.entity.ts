import { BayId } from '../identifiers/bay-id.vo';
import { DealershipId } from '../identifiers/dealership-id.vo';

export class ServiceBay {
  constructor(
    readonly id: BayId,
    readonly dealershipId: DealershipId,
    readonly label: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
