import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: '某月扣款日历:展开所有生效订阅在该月的扣款日' })
  month(@CurrentUser() user: { id: number }, @Query('month') month: string) {
    return this.subs.calendar(user.id, month);
  }
}
