import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
  }

  async mustGetOwned(userId: number, categoryId: number) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException('分类不存在');
    }
    return category;
  }
}
