import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { Permission, permissionsForRole } from '../constants/permissions';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtUserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUserPayload | undefined;
    if (!user) throw new ForbiddenException();

    const allowed = new Set(user.permissions ?? []);
    const ok = required.every((p) => allowed.has(p));
    if (!ok) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
