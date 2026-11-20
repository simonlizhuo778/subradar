import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: '健康检查' })
  health() {
    return { status: 'ok', service: 'subradar-server', time: new Date().toISOString() };
  }
}
