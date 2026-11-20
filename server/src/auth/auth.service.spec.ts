import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

/**
 * 说明:vitest 用 esbuild 转译,不产出 NestJS DI 所需的 decorator metadata,
 * 所以这里直接 new AuthService(...) 注入 mock,不走 Test.createTestingModule。
 * bcryptjs 是纯 JS 实现,直接跑真实哈希/比对,顺带验证加密链路本身。
 */
function makeService() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  const jwt = { sign: vi.fn().mockReturnValue('jwt-token') };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
  );
  return { service, prisma, jwt };
}

const registerDto: RegisterDto = {
  email: 'new@subradar.app',
  password: 'password123',
  displayName: '新用户',
};

const loginDto: LoginDto = { email: 'demo@subradar.app', password: 'demo1234' };

describe('AuthService.register', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('注册成功:创建用户并自动写入 9 个默认分类', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(null);
    ctx.prisma.user.create.mockResolvedValue({ id: 1, email: registerDto.email });

    const result = await ctx.service.register(registerDto);

    expect(result).toEqual({ token: 'jwt-token' });
    expect(ctx.prisma.user.create).toHaveBeenCalledTimes(1);
    const data = ctx.prisma.user.create.mock.calls[0][0].data;
    expect(data.email).toBe(registerDto.email);
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/); // 存的是 bcrypt 哈希,不是明文
    expect(data.categories.create).toHaveLength(9);
  });

  it('邮箱已注册:抛出 ConflictException,且不写库', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue({ id: 1, email: registerDto.email });

    await expect(ctx.service.register(registerDto)).rejects.toThrow(ConflictException);
    expect(ctx.prisma.user.create).not.toHaveBeenCalled();
  });

  it('未填 displayName 时用邮箱前缀兜底', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(null);
    ctx.prisma.user.create.mockResolvedValue({ id: 1 });

    await ctx.service.register({ ...registerDto, displayName: undefined });

    const data = ctx.prisma.user.create.mock.calls[0][0].data;
    expect(data.displayName).toBe('new');
  });
});

describe('AuthService.login', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('账号密码正确:返回 token', async () => {
    const passwordHash = await hash('demo1234', 4);
    ctx.prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: loginDto.email,
      passwordHash,
    });

    const result = await ctx.service.login(loginDto);

    expect(result).toEqual({ token: 'jwt-token' });
    expect(ctx.jwt.sign).toHaveBeenCalledWith({ sub: 1, email: loginDto.email });
  });

  it('密码错误:抛出 UnauthorizedException', async () => {
    const passwordHash = await hash('wrong-password', 4);
    ctx.prisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: loginDto.email,
      passwordHash,
    });

    await expect(ctx.service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    expect(ctx.jwt.sign).not.toHaveBeenCalled();
  });

  it('邮箱不存在:同样抛出 UnauthorizedException(不泄露账号是否存在)', async () => {
    ctx.prisma.user.findUnique.mockResolvedValue(null);

    await expect(ctx.service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    expect(ctx.jwt.sign).not.toHaveBeenCalled();
  });
});
