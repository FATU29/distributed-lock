import { DealershipId } from '../identifiers/dealership-id.vo';
import { ServiceTypeId } from '../identifiers/service-type-id.vo';
import { TechnicianId } from '../identifiers/technician-id.vo';

export class Technician {
  constructor(
    readonly id: TechnicianId,
    readonly dealershipId: DealershipId,
    readonly name: string,
    readonly qualifiedServiceTypeIds: readonly ServiceTypeId[],
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
