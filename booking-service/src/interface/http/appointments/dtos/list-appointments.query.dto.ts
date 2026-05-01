import { IsOptional, IsUUID } from 'class-validator';

import { ListPageQueryDto } from '../../common/list-page.query.dto';

export class ListAppointmentsQueryDto extends ListPageQueryDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsUUID('4')
  dealershipId?: string;
}
