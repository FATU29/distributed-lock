import { FakeUserRepository } from '../../../test/fakes/fake-user.repository';
import {
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../../domain/user/errors';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let repository: FakeUserRepository;
  let service: UsersService;

  beforeEach(() => {
    repository = new FakeUserRepository();
    service = new UsersService(repository);
  });

  describe('create', () => {
    it('returns the server-assigned profile', async () => {
      const profile = await service.create({
        email: 'alice@example.test',
        displayName: 'Alice',
      });
      expect(profile.user.email).toBe('alice@example.test');
      expect(profile.user.id.value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('throws UserAlreadyExistsError on duplicate email', async () => {
      await service.create({ email: 'a@b.test', displayName: null });
      await expect(
        service.create({ email: 'A@B.test', displayName: null }),
      ).rejects.toBeInstanceOf(UserAlreadyExistsError);
    });
  });

  describe('findById / findByEmail', () => {
    it('returns the profile when present', async () => {
      const created = await service.create({
        email: 'a@b.test',
        displayName: null,
      });
      expect((await service.findById(created.user.id)).user.id.value).toBe(
        created.user.id.value,
      );
      expect((await service.findByEmail('A@B.test')).user.email).toBe(
        'a@b.test',
      );
    });

    it('throws UserNotFoundError when missing', async () => {
      const created = await service.create({
        email: 'a@b.test',
        displayName: null,
      });
      await repository.delete(created.user.id);
      await expect(service.findById(created.user.id)).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
      await expect(service.findByEmail('nope@b.test')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });

  describe('list', () => {
    it('respects limit/offset and returns total', async () => {
      for (let i = 0; i < 5; i++) {
        await service.create({ email: `u${i}@b.test`, displayName: null });
      }
      const page = await service.list({ limit: 2, offset: 1 });
      expect(page.total).toBe(5);
      expect(page.items).toHaveLength(2);
      expect(page.items[0]?.user.email).toBe('u1@b.test');
      expect(page.items[1]?.user.email).toBe('u2@b.test');
    });
  });

  describe('update', () => {
    it('changes displayName and bumps updatedAt', async () => {
      const created = await service.create({
        email: 'a@b.test',
        displayName: 'Old',
      });
      const updated = await service.update(created.user.id, {
        displayName: 'New',
      });
      expect(updated.user.displayName).toBe('New');
      expect(updated.user.updatedAt.getTime()).toBeGreaterThan(
        created.user.updatedAt.getTime(),
      );
    });

    it('throws UserNotFoundError when the user is missing', async () => {
      const created = await service.create({
        email: 'a@b.test',
        displayName: null,
      });
      await service.delete(created.user.id);
      await expect(
        service.update(created.user.id, { displayName: 'x' }),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe('delete', () => {
    it('removes the user', async () => {
      const created = await service.create({
        email: 'a@b.test',
        displayName: null,
      });
      await service.delete(created.user.id);
      await expect(service.findById(created.user.id)).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });

    it('throws UserNotFoundError when the user is missing', async () => {
      const created = await service.create({
        email: 'a@b.test',
        displayName: null,
      });
      await service.delete(created.user.id);
      await expect(service.delete(created.user.id)).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });
});
