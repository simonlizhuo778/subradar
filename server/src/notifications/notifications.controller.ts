import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateChannelDto, ToggleChannelDto } from './dto/channel.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('channels')
  @ApiOperation({ summary: '推送渠道列表(目标只返回掩码)' })
  channels(@CurrentUser() user: { id: number }) {
    return this.notifications.list(user.id);
  }

  @Post('channels')
  @ApiOperation({ summary: '添加推送渠道:飞书机器人 / 通用 webhook / 邮件' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateChannelDto) {
    return this.notifications.create(user.id, dto);
  }

  @Patch('channels/:id')
  @ApiOperation({ summary: '启用 / 停用某个渠道' })
  toggle(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleChannelDto,
  ) {
    return this.notifications.setEnabled(user.id, id, dto.enabled);
  }

  @Delete('channels/:id')
  @ApiOperation({ summary: '删除推送渠道' })
  remove(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.remove(user.id, id);
  }

  @Post('channels/:id/test')
  @ApiOperation({ summary: '发送测试消息,立即反馈是否可达' })
  test(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.notifications.test(user.id, id);
  }

  @Get('logs')
  @ApiOperation({ summary: '推送记录(最近 50 条)' })
  logs(@CurrentUser() user: { id: number }) {
    return this.notifications.logs(user.id);
  }
}