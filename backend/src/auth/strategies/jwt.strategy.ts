import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { passportJwtSecret } from 'jwks-rsa';
import { rolePermissions } from '../role-access';
import { authConfig } from '../auth.config';
import { KeycloakPayload, KeycloakUserService } from '../keycloak-user.service';

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly keycloakMode: boolean;
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly keycloakUsers: KeycloakUserService,
  ) {
    const settings = authConfig(config);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      ...(settings.mode === 'keycloak'
        ? {
            secretOrKeyProvider: passportJwtSecret({
              cache: true,
              rateLimit: true,
              jwksRequestsPerMinute: 10,
              jwksUri: `${settings.issuer}/protocol/openid-connect/certs`,
              timeout: 5000,
            }),
            algorithms: ['RS256' as const],
            issuer: settings.issuer,
            audience: settings.audience,
          }
        : {
            secretOrKey:
              config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
            algorithms: ['HS256' as const],
          }),
    });
    this.keycloakMode = settings.mode === 'keycloak';
  }

  async validate(payload: JwtPayload & KeycloakPayload) {
    if (this.keycloakMode) return this.keycloakUsers.resolve(payload);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();
    const access = await rolePermissions(this.prisma, user.roleNames);
    return {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: access.names[0] ?? '',
      roles: access.names,
      permissions: access.permissions,
    };
  }
}
