import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddPaymentDto } from './dto/add-payment.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: '订阅列表(支持状态/分类/搜索/排序筛选)' })
  list(@CurrentUser() user: { id: number }, @Query() query: ListSubscriptionsDto) {
    return this.subs.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: '新建订阅(自动推算下次扣款日)' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateSubscriptionDto) {
    return this.subs.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '订阅详情(含最近扣款历史)' })
  detail(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.subs.detail(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新订阅(改周期/首次扣款日/恢复暂停时重算下次扣款日)' })
  update(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subs.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除订阅(连带扣款历史)' })
  remove(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.subs.remove(user.id, id);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: '手动补记一笔扣款(金额不填则用订阅当前金额)' })
  addPayment(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPaymentDto,
  ) {
    return this.subs.addPayment(user.id, id, dto);
  }
}
