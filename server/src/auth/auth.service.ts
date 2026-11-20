import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/** 新用户注册时自动创建的默认分类(与 seed 保持一致) */
export const DEFAULT_CATEGORIES = [
  { name: '视频', color: '#e11d48', sort: 1 },
  { name: '音乐', color: '#8b5cf6', sort: 2 },
  { name: '云存储', color: '#0ea5e9', sort: 3 },
  { name: 'AI 工具', color: '#10b981', sort: 4 },
  { name: '效率办公', color: '#f59e0b', sort: 5 },
  { name: '阅读学习', color: '#6366f1', sort: 6 },
  { name: '健康健身', color: '#22c55e', sort: 7 },
  { name: '电商购物', color: '#f43f5e', sort: 8 },
  { name: '开发者', color: '#64748b', sort: 9 },
];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('该邮箱已被注册');
    }

    const passwordHash = await hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName?.trim() || dto.email.split('@')[0],
        categories: { create: DEFAULT_CATEGORIES },
      },
    });

    return this.issueToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    const ok = await compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    return this.issueToken(user.id, user.email);
  }

  private issueToken(userId: number, email: string) {
    const token = this.jwt.sign({ sub: userId, email });
    return { token };
  }
}
