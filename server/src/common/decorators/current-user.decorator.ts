import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  id: number;
  email: string;
  displayName: string | null;
}

/** 从请求上取回 JwtStrategy.validate() 的返回值 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestUser => ctx.switchToHttp().getRequest().user,
);
