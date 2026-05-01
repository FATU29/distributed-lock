import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  // displayName is the only mutable field — email is identity and is not
  // changed via PATCH.
  @ValidateIf((_o, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;
}
