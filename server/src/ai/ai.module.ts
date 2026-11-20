import { Module } from '@nestjs/common';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { AiExtractController } from './extract.controller';
import { AiExtractService } from './extract.service';
import { UsageController } from './usage.controller';

@Module({
  controllers: [AiSettingsController, AiExtractController, UsageController],
  providers: [AiSettingsService, AiExtractService],
})
export class AiModule {}
