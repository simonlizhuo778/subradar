import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min, Matches } from 'class-validator';

const PROVIDER_KEYS = ['deepseek', 'zhipu', 'openai', 'gemini', 'custom'] as const;

export class SaveAiSettingsDto {
  @IsIn(PROVIDER_KEYS, { message: 'Provider 取值不合法' })
  provider!: string;

  @IsOptional()
  @Matches(/^https?:\/\//, { message: 'Base URL 应以 http(s):// 开头' })
  baseUrl?: string;

  /** 留空表示沿用已保存的 Key(更新场景) */
  @IsOptional()
  @IsString()
  @Length(8, 200)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  model?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  visionModel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  dailyLimit?: number;
}
