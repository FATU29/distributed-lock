import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDealershipDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;
}
