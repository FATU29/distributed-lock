import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDealershipDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name?: string;
}
