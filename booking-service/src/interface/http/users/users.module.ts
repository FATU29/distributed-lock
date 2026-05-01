import { Module } from '@nestjs/common';

import { UsersService } from '../../../application/users/users.service';
import { USER_REPOSITORY } from '../../../domain/ports';
import { PrismaUserRepository } from '../../../infrastructure/persistence/user.repository';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
})
export class UsersModule {}
