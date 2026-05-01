import { ServiceTypeId } from '../identifiers/service-type-id.vo';

export class ServiceTypeSpec {
  constructor(
    readonly id: ServiceTypeId,
    readonly code: string,
    readonly name: string,
    readonly durationMinutes: number,
    readonly requiredSkillTag: string | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
