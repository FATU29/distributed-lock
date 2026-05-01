import { IsOptional, IsUUID } from 'class-validator';

import { ListPageQueryDto } from '../../common/list-page.query.dto';

export class ListVehiclesQueryDto extends ListPageQueryDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;
}
