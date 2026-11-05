import { AgreementFilesController } from '../rentals/agreement-files.controller';
import {
  INestApplication,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request = require('supertest');
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  Permission,
  permissionsForRole,
} from '../common/constants/permissions';
import { KeycloakAdmin } from '../auth/keycloak-admin';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';

const pick = (value: any, select: any) =>
  !select
    ? value
    : Object.fromEntries(
        Object.keys(select)
          .filter((key) => select[key])
          .map((key) => [key, value[key]]),
      );
describe('CHRMS dynamic role and user API', () => {
  let app: INestApplication,
    actor: JwtUserPayload,
    roles: Map<string, any>,
    users: Map<string, any>;
  const prisma: any = { role: {}, user: {} };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController, AgreementFilesController],
      providers: [
        UsersService,
        PermissionsGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService({ AUTH_MODE: 'keycloak' }),
        },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          context.switchToHttp().getRequest().user = actor;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest
      .spyOn(KeycloakAdmin.prototype, 'ensureRole')
      .mockResolvedValue(undefined);
    roles = new Map([
      ['ADMIN', { name: 'ADMIN', permissions: Object.values(Permission) }],
      [
        'HOUSING_OFFICER',
        {
          name: 'HOUSING_OFFICER',
          permissions: permissionsForRole('HOUSING_OFFICER' as any),
        },
      ],
      ['REVIEWER', { name: 'REVIEWER', permissions: ['properties.read'] }],
    ]);
    users = new Map([
      [
        'admin',
        {
          id: 'admin',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'ADMIN',
          roleNames: ['ADMIN'],
          isActive: true,
          keycloakSub: 'admin-sub',
          keycloakIssuer: 'https://auth.chirocity.gov.et/realms/chirocity',
        },
      ],
      [
        'target',
        {
          id: 'target',
          email: 'target@example.com',
          fullName: 'Target',
          role: 'HOUSING_OFFICER',
          roleNames: ['HOUSING_OFFICER'],
          isActive: true,
          keycloakSub: 'target-sub',
          keycloakIssuer: 'https://auth.chirocity.gov.et/realms/chirocity',
        },
      ],
    ]);
    actor = {
      sub: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      roles: ['ADMIN'],
      permissions: Object.values(Permission),
    };
    prisma.role.findMany = jest.fn(async ({ where }: any = {}) =>
      [...roles.values()].filter(
        (role) => !where || where.name.in.includes(role.name),
      ),
    );
    prisma.role.findUnique = jest.fn(
      async ({ where }: any) => roles.get(where.name) ?? null,
    );
    prisma.role.upsert = jest.fn(async ({ where, create }: any) => {
      if (!roles.has(where.name)) roles.set(where.name, create);
      return roles.get(where.name);
    });
    prisma.role.create = jest.fn(async ({ data }: any) => {
      roles.set(data.name, data);
      return data;
    });
    prisma.role.update = jest.fn(async ({ where, data }: any) => {
      const value = { ...roles.get(where.name), ...data };
      roles.set(where.name, value);
      return value;
    });
    prisma.user.findUnique = jest.fn(async ({ where, select }: any) => {
      const user = where.id
        ? users.get(where.id)
        : [...users.values()].find((user) => user.email === where.email);
      return user ? pick({ ...user }, select) : null;
    });
    prisma.user.count = jest.fn(async () => 1);
    prisma.user.findMany = jest.fn(async () => [...users.values()]);
    prisma.user.create = jest.fn(async ({ data, select }: any) => {
      const value = { id: 'new-user', isActive: true, ...data };
      users.set(value.id, value);
      return pick(value, select);
    });
    prisma.user.update = jest.fn(async ({ where, data, select }: any) => {
      const value = { ...users.get(where.id), ...data };
      users.set(where.id, value);
      return pick(value, select);
    });
    prisma.$transaction = jest.fn(async (callback) => callback(prisma));
  });
  afterEach(() => jest.restoreAllMocks());
  it('denies role APIs without granted permissions regardless of ADMIN name', async () => {
    actor.permissions = [];
    await request(app.getHttpServer()).get('/users/roles/overview').expect(403);
    await request(app.getHttpServer()).post('/users/roles/sync').expect(403);
    await request(app.getHttpServer())
      .patch('/users/target')
      .send({ roles: ['REVIEWER'] })
      .expect(403);
  });
  it('allows custom role readers without write access', async () => {
    actor.role = 'AUDITOR';
    actor.permissions = ['roles.read'];
    await request(app.getHttpServer()).get('/users/roles/overview').expect(200);
    await request(app.getHttpServer())
      .post('/users/roles')
      .send({ name: 'NEW', permissions: [] })
      .expect(403);
  });
  it('imports custom roles with no permissions while retaining existing grants', async () => {
    jest.spyOn(KeycloakAdmin.prototype, 'roles').mockResolvedValue([
      { id: 'reviewer', name: 'REVIEWER' },
      { id: 'new', name: 'CLERK' },
    ]);
    await request(app.getHttpServer()).post('/users/roles/sync').expect(201);
    expect(roles.get('REVIEWER').permissions).toEqual(['properties.read']);
    expect(roles.get('CLERK').permissions).toEqual([]);
  });
  it('creates a Keycloak role and local permissions together', async () => {
    const ensure = jest
      .spyOn(KeycloakAdmin.prototype, 'ensureRole')
      .mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .post('/users/roles')
      .send({ name: 'CUSTOM', permissions: ['properties.read'] })
      .expect(201);
    expect(ensure).toHaveBeenCalledWith('CUSTOM');
    expect(roles.get('CUSTOM').permissions).toEqual(['properties.read']);
  });
  it('rejects unknown permission keys', async () => {
    await request(app.getHttpServer())
      .post('/users/roles')
      .send({ name: 'BAD', permissions: ['realm.admin'] })
      .expect(400);
  });
  it('does not let delegated role managers manufacture permissions', async () => {
    actor.permissions = ['roles.write', 'roles.read'];
    await request(app.getHttpServer())
      .post('/users/roles')
      .send({ name: 'BAD', permissions: ['users.write'] })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/users/roles/REVIEWER')
      .send({ permissions: [] })
      .expect(403);
  });
  it('protects core ADMIN permissions against lockout', async () => {
    await request(app.getHttpServer())
      .patch('/users/roles/ADMIN')
      .send({ permissions: [] })
      .expect(400);
  });
  it('a user creator cannot assign permissions beyond their own grants', async () => {
    actor.permissions = ['users.write'];
    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: 'new@example.com',
        fullName: 'New',
        password: 'Example-temp-839!',
        roles: ['ADMIN'],
      })
      .expect(403);
  });
  it('creates an email-verified identity disabled until roles and local profile exist', async () => {
    const create = jest
      .spyOn(KeycloakAdmin.prototype, 'createIdentity')
      .mockResolvedValue('new-sub');
    const replace = jest
      .spyOn(KeycloakAdmin.prototype, 'replaceRoles')
      .mockResolvedValue(undefined);
    const management = jest
      .spyOn(KeycloakAdmin.prototype, 'request')
      .mockResolvedValue(undefined);
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({
        email: 'new@example.com',
        fullName: 'New User',
        password: 'Example-temp-839!',
        roles: ['REVIEWER', 'HOUSING_OFFICER'],
      })
      .expect(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
      }),
    );
    expect(replace).toHaveBeenCalledWith('new-sub', [
      'HOUSING_OFFICER',
      'REVIEWER',
    ]);
    expect(management).toHaveBeenCalledWith('/users/new-sub', 'PUT', {
      enabled: true,
    });
    expect(users.get('new-user').passwordHash).toBeNull();
    expect(response.body).not.toHaveProperty('passwordHash');
  });
  it('cleans up a failed newly created identity instead of enabling it', async () => {
    jest
      .spyOn(KeycloakAdmin.prototype, 'createIdentity')
      .mockResolvedValue('failed-sub');
    jest
      .spyOn(KeycloakAdmin.prototype, 'replaceRoles')
      .mockRejectedValue(
        new ServiceUnavailableException('simulated management failure'),
      );
    const management = jest
      .spyOn(KeycloakAdmin.prototype, 'request')
      .mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: 'new@example.com',
        fullName: 'New User',
        password: 'Example-temp-839!',
        roles: ['REVIEWER'],
      })
      .expect(503);
    expect(management).toHaveBeenCalledWith('/users/failed-sub', 'DELETE');
    expect(users.has('new-user')).toBe(false);
  });
  it('synchronizes the full selected multi-role set and sets a stale-token barrier first', async () => {
    const replace = jest
      .spyOn(KeycloakAdmin.prototype, 'replaceRoles')
      .mockImplementation(async () => {
        expect(users.get('target').rolesValidAfter).toBeGreaterThan(0n);
      });
    const response = await request(app.getHttpServer())
      .patch('/users/target')
      .send({ roles: ['REVIEWER', 'HOUSING_OFFICER'] })
      .expect(200);
    expect(replace).toHaveBeenCalledWith('target-sub', [
      'HOUSING_OFFICER',
      'REVIEWER',
    ]);
    expect(response.body.roles).toEqual(['HOUSING_OFFICER', 'REVIEWER']);
  });
  it('can revoke all direct roles without giving a fallback Housing Officer grant', async () => {
    jest
      .spyOn(KeycloakAdmin.prototype, 'replaceRoles')
      .mockResolvedValue(undefined);
    const response = await request(app.getHttpServer())
      .patch('/users/target')
      .send({ roles: [] })
      .expect(200);
    expect(response.body.roles).toEqual([]);
    expect(response.body.role).toBe('');
  });
  it('does not auto-link by email or allow linked password changes', async () => {
    await request(app.getHttpServer())
      .patch('/users/target')
      .send({ password: 'Example-temp-839!' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: 'target@example.com',
        fullName: 'Target',
        password: 'Example-temp-839!',
        roles: ['REVIEWER'],
      })
      .expect(409);
  });
  it('disables only local app access without deleting the shared identity', async () => {
    const remote = jest.spyOn(KeycloakAdmin.prototype, 'request');
    await request(app.getHttpServer()).delete('/users/target').expect(200);
    expect(users.get('target').isActive).toBe(false);
    expect(remote).not.toHaveBeenCalled();
  });
  it('protects the last administrator and self-disable', async () => {
    await request(app.getHttpServer())
      .patch('/users/admin')
      .send({ roles: ['REVIEWER'] })
      .expect(400);
    await request(app.getHttpServer()).delete('/users/admin').expect(400);
  });
  it('requires an email and valid temporary password before provisioning', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ fullName: 'New', password: '123', roles: ['REVIEWER'] })
      .expect(400);
  });
  it('protects agreement downloads with rentals.read instead of a public static route', async () => {
    actor.permissions = [];
    await request(app.getHttpServer())
      .get('/uploads/agreements/missing.pdf')
      .expect(403);
    actor.permissions = ['rentals.read'];
    await request(app.getHttpServer())
      .get('/uploads/agreements/missing.pdf')
      .expect(404);
  });
});
