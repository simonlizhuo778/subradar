import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: '当前用户的分类列表(表单下拉用)' })
  list(@CurrentUser() user: { id: number }) {
    return this.categories.list(user.id);
  }
}
