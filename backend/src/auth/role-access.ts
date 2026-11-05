import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function rolePermissions(prisma: PrismaService, names: string[]) {
  const roles = await prisma.role.findMany({ where: { name: { in: names } } });
  return {
    names: roles
      .map((role) => role.name)
      .sort((a, b) =>
        a === 'ADMIN' ? -1 : b === 'ADMIN' ? 1 : a.localeCompare(b),
      ),
    permissions: [...new Set(roles.flatMap((role) => role.permissions))].sort(),
  };
}

export function assertDelegation(owned: string[], granted: string[]) {
  if (granted.some((permission) => !owned.includes(permission)))
    throw new ForbiddenException(
      'You cannot grant or manage permissions beyond your own access.',
    );
}
