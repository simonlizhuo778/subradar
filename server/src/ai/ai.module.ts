import { Module } from '@nestjs/common';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { AiExtractController } from './extract.controller';
import { AiExtractService } from './extract.service';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { UsageController } from './usage.controller';

@Module({
  controllers: [AiSettingsController, AiExtractController, SuggestionsController, UsageController],
  providers: [AiSettingsService, AiExtractService, SuggestionsService],
})
export class AiModule {}
