import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateRoleDto, RolePermissionsDto } from './dto/role.dto';
import { Permission } from '../common/constants/permissions';
import {
  CurrentUser,
  JwtUserPayload,
} from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @RequirePermissions(Permission.PROFILE_READ)
  me(@CurrentUser() jwt: JwtUserPayload) {
    return this.users.getProfile(jwt.sub);
  }

  @Get('roles/overview')
  @RequirePermissions(Permission.ROLES_READ)
  rolesOverview() {
    return this.users.getRolesOverview();
  }

  @Get('assignable-roles')
  @RequirePermissions(Permission.USERS_WRITE)
  assignable(@CurrentUser() actor: JwtUserPayload) {
    return this.users.assignableRoles(actor);
  }

  @Get('roles/catalog')
  @RequirePermissions(Permission.ROLES_READ)
  catalog() {
    return Object.values(Permission);
  }

  @Post('roles/sync')
  @RequirePermissions(Permission.ROLES_WRITE)
  syncRoles() {
    return this.users.syncRoles();
  }

  @Post('roles')
  @RequirePermissions(Permission.ROLES_WRITE)
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() actor: JwtUserPayload) {
    return this.users.createRole(dto.name, dto.permissions, actor);
  }

  @Patch('roles/:name')
  @RequirePermissions(Permission.ROLES_WRITE)
  updateRole(
    @Param('name') name: string,
    @Body() dto: RolePermissionsDto,
    @CurrentUser() actor: JwtUserPayload,
  ) {
    return this.users.setRolePermissions(name, dto.permissions, actor);
  }

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  findAll(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.users.findAll({ q, role, page, pageSize });
  }

  @Get(':id')
  @RequirePermissions(Permission.USERS_READ)
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.USERS_WRITE)
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: JwtUserPayload) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(Permission.USERS_WRITE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: JwtUserPayload,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions(Permission.USERS_WRITE)
  remove(@Param('id') id: string, @CurrentUser() jwt: JwtUserPayload) {
    return this.users.remove(id, jwt);
  }
}
