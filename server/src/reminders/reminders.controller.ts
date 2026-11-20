import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  @ApiOperation({ summary: '提醒列表(最近 30 天,含即将扣款与已提醒)' })
  list(@CurrentUser() user: { id: number }) {
    return this.reminders.list(user.id);
  }

  @Post('scan')
  @ApiOperation({ summary: '手动触发一次扫描:追平逾期 + 生成到期提醒(幂等)' })
  scan() {
    return this.reminders.scanOnce();
  }
}
