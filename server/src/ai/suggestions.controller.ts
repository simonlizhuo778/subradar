import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuggestionsService } from './suggestions.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/suggestions')
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Post()
  @ApiOperation({ summary: 'AI 省钱建议:基于当前生效订阅(消耗模型额度)' })
  generate(@CurrentUser() user: { id: number }) {
    return this.suggestions.generate(user.id);
  }
}
