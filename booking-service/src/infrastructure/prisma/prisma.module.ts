import { Global, Module } from '@nestjs/common';
import { loadDatabaseConfig } from '../config/database-config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => new PrismaService(loadDatabaseConfig()),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
