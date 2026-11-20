import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiSettingsService } from './ai-settings.service';
import { SaveAiSettingsDto } from './dto/save-ai-settings.dto';

@ApiTags('ai-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings/ai')
export class AiSettingsController {
  constructor(private readonly settings: AiSettingsService) {}

  @Get()
  @ApiOperation({ summary: '读取 AI 配置(Key 只返回掩码)' })
  get(@CurrentUser() user: { id: number }) {
    return this.settings.getMasked(user.id);
  }

  @Put()
  @ApiOperation({ summary: '保存 AI 配置(Key 加密落库;apiKey 留空表示沿用)' })
  save(@CurrentUser() user: { id: number }, @Body() dto: SaveAiSettingsDto) {
    return this.settings.save(user.id, dto);
  }

  @Post('test')
  @ApiOperation({ summary: '连通性测试:发一条极小请求并计时' })
  test(@CurrentUser() user: { id: number }) {
    return this.settings.test(user.id);
  }
}
