import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { authConfig } from '../auth/auth.config';
import { KeycloakAdmin } from '../auth/keycloak-admin';
import { assertDelegation, rolePermissions } from '../auth/role-access';
import { Permission } from '../common/constants/permissions';
import { JwtUserPayload } from '../common/decorators/current-user.decorator';
import {
  paginated,
  parsePagination,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const publicSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  roleNames: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;
function profile(user: any) {
  return {
    ...user,
    role: user.roleNames?.[0] ?? '',
    roles: user.roleNames ?? [],
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  private get central() {
    return authConfig(this.config).mode === 'keycloak';
  }
  private manager() {
    return new KeycloakAdmin(this.config);
  }
  private names(dto: { role?: string; roles?: string[] }) {
    if (dto.role !== undefined && dto.roles !== undefined)
      throw new BadRequestException('Send roles or role, not both.');
    return [...new Set(dto.roles ?? (dto.role ? [dto.role] : []))].sort(
      (a, b) => (a === 'ADMIN' ? -1 : b === 'ADMIN' ? 1 : a.localeCompare(b)),
    );
  }
  private async grants(names: string[], actor: JwtUserPayload) {
    const access = await rolePermissions(this.prisma, names);
    if (access.names.length !== names.length)
      throw new BadRequestException(
        'A selected role is not configured. Synchronize roles first.',
      );
    assertDelegation(actor.permissions, access.permissions);
    return access;
  }
  async getProfile(id: string) {
    return this.findOne(id);
  }
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return profile(user);
  }
  async findAll(params: PaginationQuery & { q?: string; role?: string } = {}) {
    const { page, pageSize, skip, take } = parsePagination(params);
    const where: Prisma.UserWhereInput = {};
    if (params.role) where.roleNames = { has: params.role };
    if (params.q?.trim())
      where.OR = [
        { email: { contains: params.q.trim(), mode: 'insensitive' } },
        { fullName: { contains: params.q.trim(), mode: 'insensitive' } },
      ];
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: publicSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(users.map(profile), total, page, pageSize);
  }
  async getRolesOverview() {
    const roles = await this.prisma.role.findMany({ orderBy: { name: 'asc' } });
    return roles.map((role) => ({
      role: role.name,
      label: role.name,
      permissions: role.permissions,
    }));
  }
  async assignableRoles(actor: JwtUserPayload) {
    return (await this.getRolesOverview()).filter((role) =>
      role.permissions.every((p) => actor.permissions.includes(p)),
    );
  }
  async syncRoles() {
    if (!this.central)
      throw new BadRequestException(
        'Chiro Auth synchronization requires AUTH_MODE=keycloak.',
      );
    const roles = await this.manager().roles();
    for (const role of roles)
      await this.prisma.role.upsert({
        where: { name: role.name },
        create: { name: role.name, permissions: [] },
        update: {},
      });
    return { imported: roles.length };
  }
  async createRole(
    name: string,
    permissions: Permission[],
    actor: JwtUserPayload,
  ) {
    if (name !== name.trim() || !name.trim())
      throw new BadRequestException(
        'Role names must not have surrounding whitespace.',
      );
    assertDelegation(actor.permissions, permissions);
    if (await this.prisma.role.findUnique({ where: { name } }))
      throw new ConflictException('Role already exists.');
    if (this.central) await this.manager().ensureRole(name);
    return this.prisma.role.create({ data: { name, permissions } });
  }
  async setRolePermissions(
    name: string,
    permissions: Permission[],
    actor: JwtUserPayload,
  ) {
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) throw new NotFoundException('Role not found');
    assertDelegation(actor.permissions, [...role.permissions, ...permissions]);
    if (
      name === 'ADMIN' &&
      [
        Permission.PROFILE_READ,
        Permission.USERS_READ,
        Permission.USERS_WRITE,
        Permission.ROLES_READ,
        Permission.ROLES_WRITE,
      ].some((p) => !permissions.includes(p))
    )
      throw new BadRequestException(
        'Keep the core administrator management permissions to prevent lockout.',
      );
    return this.prisma.role.update({ where: { name }, data: { permissions } });
  }
  async create(dto: CreateUserDto, actor: JwtUserPayload) {
    const names = this.names(dto);
    if (!names.length)
      throw new BadRequestException('Select at least one role for a new user.');
    await this.grants(names, actor);
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException(
        'Email already registered. Existing identities must be linked explicitly.',
      );
    const data = {
      email,
      fullName: dto.fullName.trim(),
      role: names.includes('ADMIN') ? UserRole.ADMIN : UserRole.HOUSING_OFFICER,
      roleNames: names,
    };
    if (!this.central)
      return profile(
        await this.prisma.user.create({
          data: { ...data, passwordHash: await bcrypt.hash(dto.password, 12) },
          select: publicSelect,
        }),
      );
    const manager = this.manager();
    for (const name of names) await manager.ensureRole(name);
    const [firstName, ...rest] = data.fullName.split(/\s+/);
    const subject = await manager.createIdentity({
      email,
      firstName,
      lastName: rest.join(' '),
      password: dto.password,
    });
    try {
      await manager.replaceRoles(subject, names);
      return await this.prisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              ...data,
              passwordHash: null,
              keycloakSub: subject,
              keycloakIssuer: authConfig(this.config).issuer,
            },
            select: publicSelect,
          });
          await manager.request(
            `/users/${encodeURIComponent(subject)}`,
            'PUT',
            { enabled: true },
          );
          return profile(user);
        },
        { timeout: 25000 },
      );
    } catch (error) {
      try {
        await manager.request(
          `/users/${encodeURIComponent(subject)}`,
          'DELETE',
        );
      } catch {
        /* Identity stays disabled if cleanup is unavailable. */
      }
      throw error;
    }
  }
  private async protectLastAdmin(
    user: any,
    nextRoles: string[],
    disabling = false,
  ) {
    if (
      user.isActive &&
      user.roleNames.includes('ADMIN') &&
      (disabling || !nextRoles.includes('ADMIN')) &&
      (await this.prisma.user.count({
        where: { isActive: true, roleNames: { has: 'ADMIN' } },
      })) <= 1
    )
      throw new BadRequestException(
        'Cannot disable or remove the last administrator.',
      );
  }
  async update(id: string, dto: UpdateUserDto, actor: JwtUserPayload) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.grants(user.roleNames, actor);
    const changingRoles = dto.roles !== undefined || dto.role !== undefined;
    const names = changingRoles ? this.names(dto) : user.roleNames;
    if (changingRoles) await this.grants(names, actor);
    await this.protectLastAdmin(user, names, dto.isActive === false);
    if (id === actor.sub && dto.isActive === false)
      throw new BadRequestException('You cannot disable your own account.');
    if (this.central && (dto.email !== undefined || dto.password !== undefined))
      throw new ForbiddenException('Manage email and passwords in Chiro Auth.');
    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.password !== undefined)
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    if (changingRoles) {
      if (this.central) {
        if (
          !user.keycloakSub ||
          user.keycloakIssuer !== authConfig(this.config).issuer
        )
          throw new BadRequestException(
            'Explicitly link this existing user to Chiro Auth before changing roles.',
          );
        // Persist before remote changes: old JWTs must not restore removed roles.
        await this.prisma.user.update({
          where: { id },
          data: { rolesValidAfter: BigInt(Math.ceil(Date.now() / 1000) + 600) },
        });
        try {
          const manager = this.manager();
          for (const name of names) await manager.ensureRole(name);
          await manager.replaceRoles(user.keycloakSub, names);
        } catch (error) {
          await this.prisma.user.update({
            where: { id },
            data: { rolesValidAfter: BigInt(Math.ceil(Date.now() / 1000)) },
          });
          throw error;
        }
        data.rolesValidAfter = BigInt(Math.ceil(Date.now() / 1000));
      }
      data.roleNames = names;
      data.role = names.includes('ADMIN')
        ? UserRole.ADMIN
        : UserRole.HOUSING_OFFICER;
    }
    return profile(
      await this.prisma.user.update({
        where: { id },
        data,
        select: publicSelect,
      }),
    );
  }
  async remove(id: string, actor: JwtUserPayload) {
    return this.update(id, { isActive: false }, actor);
  }
}
