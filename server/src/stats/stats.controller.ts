import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

  @Get('monthly')
  @ApiOperation({ summary: '月度扣款序列(默认过去 6 个月 + 未来 6 个月)' })
  monthly(@CurrentUser() user: { id: number }, @Query('months') months?: string) {
    return this.stats.monthly(user.id, months ? Number(months) : 12);
  }

  @Get('top')
  @ApiOperation({ summary: '订阅年成本排行(默认前 8)' })
  top(@CurrentUser() user: { id: number }, @Query('limit') limit?: string) {
    return this.stats.top(user.id, limit ? Number(limit) : 8);
  }
}
