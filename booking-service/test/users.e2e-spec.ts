import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { UsersService } from '../src/application/users/users.service';
import { USER_REPOSITORY } from '../src/domain/ports';
import { DomainErrorFilter } from '../src/interface/http/filters/domain-error.filter';
import type {
  UserListResponse,
  UserResponse,
} from '../src/interface/http/users/dtos/user.response';
import { UsersController } from '../src/interface/http/users/users.controller';
import { FakeUserRepository } from './fakes/fake-user.repository';

type ErrorBody = { error: string; message: string; statusCode: number };

const userBody = (res: request.Response): UserResponse =>
  res.body as UserResponse;
const listBody = (res: request.Response): UserListResponse =>
  res.body as UserListResponse;
const errorBody = (res: request.Response): ErrorBody => res.body as ErrorBody;

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: FakeUserRepository,
    },
  ],
})
class UsersTestModule {}

describe('Users HTTP API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [UsersTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /users', () => {
    it('201 with server-assigned ids', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'alice@example.test', displayName: 'Alice' })
        .expect(201);

      expect(userBody(res)).toEqual(
        expect.objectContaining({
          email: 'alice@example.test',
          displayName: 'Alice',
          vehicles: [],
        }),
      );
      expect(userBody(res).id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('400 when email is invalid', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('400 rejects unexpected id field (server-assigned policy)', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({
          id: 'a1111111-1111-4111-8111-111111111199',
          email: 'rogue@example.test',
        })
        .expect(400);
    });

    it('409 on duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'dup@example.test' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'DUP@example.test' })
        .expect(409)
        .expect((res) => {
          expect(errorBody(res).error).toBe('USER_ALREADY_EXISTS');
        });
    });
  });

  describe('GET /users', () => {
    it('200 with pagination', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/users')
          .send({ email: `u${i}@example.test` })
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .get('/users?limit=2&offset=1')
        .expect(200);
      const page = listBody(res);
      expect(page.total).toBe(3);
      expect(page.items).toHaveLength(2);
      expect(page.items[0]?.email).toBe('u1@example.test');
    });

    it('400 when limit is out of range', async () => {
      await request(app.getHttpServer()).get('/users?limit=999').expect(400);
    });
  });

  describe('GET /users/:id', () => {
    it('200 then 404 for unknown id', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'lookup@example.test' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/users/${userBody(created).id}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/users/00000000-0000-4000-8000-000000000000')
        .expect(404)
        .expect((res) => {
          expect(errorBody(res).error).toBe('USER_NOT_FOUND');
        });
    });
  });

  describe('GET /users/by-email/:email', () => {
    it('200 (case-insensitive)', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'caseinsensitive@example.test' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/users/by-email/CaseInsensitive%40Example.Test')
        .expect(200);
      expect(userBody(res).email).toBe('caseinsensitive@example.test');
    });
  });

  describe('PATCH /users/:id', () => {
    it('200 updates displayName', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'patch@example.test', displayName: 'Old' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/users/${userBody(created).id}`)
        .send({ displayName: 'New' })
        .expect(200);
      expect(userBody(res).displayName).toBe('New');
    });

    it('404 for unknown id', async () => {
      await request(app.getHttpServer())
        .patch('/users/00000000-0000-4000-8000-000000000000')
        .send({ displayName: 'x' })
        .expect(404);
    });

    it('400 rejects email field on update (immutable)', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'patch2@example.test' })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/users/${userBody(created).id}`)
        .send({ email: 'changed@example.test' })
        .expect(400);
    });
  });

  describe('DELETE /users/:id', () => {
    it('204 then subsequent DELETE 404s', async () => {
      const created = await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'del@example.test' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/users/${userBody(created).id}`)
        .expect(204);
      await request(app.getHttpServer())
        .delete(`/users/${userBody(created).id}`)
        .expect(404);
    });
  });
});
