import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    if (ctx.getType() === 'ws') {
      return ctx.switchToWs().getClient().data.user;
    }
    return ctx.switchToHttp().getRequest().user;
  },
);
