import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rolePermissions } from './role-access';
import { authConfig } from './auth.config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(email: string, password: string) {
    if (authConfig(this.config).mode === 'keycloak')
      throw new ForbiddenException('Use Chiro Auth to sign in to CHRMS.');
    const user = await this.validateUser(email, password);
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = await this.jwt.signAsync(payload);
    const access = await rolePermissions(this.prisma, user.roleNames);
    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: access.names[0] ?? '',
        roles: access.names,
        permissions: access.permissions,
      },
    };
  }
}
