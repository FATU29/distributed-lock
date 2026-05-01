import { IsOptional, IsUUID } from 'class-validator';

import { ListPageQueryDto } from '../../common/list-page.query.dto';

export class ListServiceBaysQueryDto extends ListPageQueryDto {
  @IsOptional()
  @IsUUID('4')
  dealershipId?: string;
}
