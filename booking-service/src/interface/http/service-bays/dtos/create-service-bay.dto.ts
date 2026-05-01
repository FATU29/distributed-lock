import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateServiceBayDto {
  @IsUUID('4')
  dealershipId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  label!: string;
}
