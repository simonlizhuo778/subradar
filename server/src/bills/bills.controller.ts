import { BadRequestException, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BillsService } from './bills.service';

interface CsvFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

const MAX_CSV_SIZE = 10 * 1024 * 1024;

@ApiTags('bills')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('import/bills')
export class BillsController {
  constructor(private readonly bills: BillsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_SIZE } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传支付宝/微信账单 CSV:解析入库 + 周期识别 + 生成候选' })
  async upload(
    @CurrentUser() user: { id: number },
    @Query('source') source = 'alipay',
    @UploadedFile() file?: CsvFile,
  ) {
    if (!file) {
      throw new BadRequestException('请上传 CSV 文件');
    }
    return this.bills.importCsv(user.id, source, file);
  }

  @Get()
  @ApiOperation({ summary: '导入历史' })
  history(@CurrentUser() user: { id: number }) {
    return this.bills.history(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '导入详情:流水明细 + 本次识别出的候选' })
  detail(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.bills.detail(user.id, id);
  }
}
