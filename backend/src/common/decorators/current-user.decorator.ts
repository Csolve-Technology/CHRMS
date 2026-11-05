import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: string;
  roles: string[];
  permissions: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUserPayload;
  },
);
