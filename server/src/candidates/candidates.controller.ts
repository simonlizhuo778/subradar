import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSubscriptionDto } from '../subscriptions/dto/create-subscription.dto';
import { CandidatesService } from './candidates.service';

@ApiTags('candidates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get()
  @ApiOperation({ summary: '待确认队列(默认 pending,可传 confirmed/dismissed 查历史)' })
  list(@CurrentUser() user: { id: number }, @Query('status') status?: string) {
    const allowed = ['pending', 'confirmed', 'dismissed'];
    return this.candidates.list(user.id, allowed.includes(status ?? '') ? status : 'pending');
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: '确认候选:创建订阅并回填扣款历史' })
  confirm(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.candidates.confirm(user.id, id, dto);
  }

  @Post(':id/dismiss')
  @ApiOperation({ summary: '忽略候选' })
  dismiss(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.candidates.dismiss(user.id, id);
  }
}
