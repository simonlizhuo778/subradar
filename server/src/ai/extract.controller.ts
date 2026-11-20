import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiExtractService } from './extract.service';
import { ExtractTextDto } from './dto/extract-text.dto';

/** 不依赖 @types/multer 的最小文件类型 */
interface MulterImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiExtractController {
  constructor(private readonly extract: AiExtractService) {}

  @Post('extract/image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_SIZE } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '截图/照片识别 → 生成待确认候选(消耗模型额度)' })
  async image(@CurrentUser() user: { id: number }, @UploadedFile() file?: MulterImageFile) {
    if (!file) {
      throw new BadRequestException('请上传图片文件');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('只支持图片文件(截图/照片)');
    }
    return this.extract.extractFromImage(user.id, file);
  }

  @Post('extract/text')
  @ApiOperation({ summary: '文本抽取(账单短信/口述文本)→ 待确认候选(消耗模型额度)' })
  text(@CurrentUser() user: { id: number }, @Body() dto: ExtractTextDto) {
    return this.extract.extractFromText(user.id, dto.text.trim());
  }
}
