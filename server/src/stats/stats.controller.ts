import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StatsService } from './stats.service';

@ApiTags('stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('summary')
  @ApiOperation({ summary: '概览:订阅数 / 年度成本(分币种)/ 近期待扣款' })
  summary(@CurrentUser() user: { id: number }) {
    return this.stats.summary(user.id);
  }

  @Get('category')
  @ApiOperation({ summary: '分类统计:各分类订阅数与年度成本' })
  category(@CurrentUser() user: { id: number }) {
    return this.stats.byCategory(user.id);
  }
}
