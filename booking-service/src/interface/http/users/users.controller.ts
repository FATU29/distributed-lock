import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { UsersService } from '../../../application/users/users.service';
import { UserId } from '../../../domain/identifiers/user-id.vo';
import { CreateUserDto } from './dtos/create-user.dto';
import { ListUsersQueryDto } from './dtos/list-users.query.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import {
  toUserListResponse,
  toUserResponse,
  type UserListResponse,
  type UserResponse,
} from './dtos/user.response';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto): Promise<UserResponse> {
    const profile = await this.users.create({
      email: dto.email,
      displayName: dto.displayName ?? null,
    });
    return toUserResponse(profile);
  }

  @Get()
  async list(@Query() query: ListUsersQueryDto): Promise<UserListResponse> {
    const page = await this.users.list({
      limit: query.limit,
      offset: query.offset,
    });
    return toUserListResponse(page);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<UserResponse> {
    const profile = await this.users.findById(UserId.from(id));
    return toUserResponse(profile);
  }

  @Get('by-email/:email')
  async findByEmail(@Param('email') email: string): Promise<UserResponse> {
    const profile = await this.users.findByEmail(email);
    return toUserResponse(profile);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    const profile = await this.users.update(UserId.from(id), {
      displayName: dto.displayName,
    });
    return toUserResponse(profile);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.users.delete(UserId.from(id));
  }
}
