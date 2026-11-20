import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiSettingsService } from './ai-settings.service';

@ApiTags('usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly settings: AiSettingsService) {}

  @Get()
  @ApiOperation({ summary: '近 7 天 AI 用量:调用数 / 成功率 / token' })
  usage(@CurrentUser() user: { id: number }) {
    return this.settings.usage(user.id);
  }
}
