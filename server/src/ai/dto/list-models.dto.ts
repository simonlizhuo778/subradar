import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * 获取可用模型列表的入参:
 * - 都留空 = 用已保存的配置
 * - 传了 baseUrl/apiKey = 用这次输入的(方便「还没保存就先试」)
 */
export class ListModelsDto {
  @IsOptional()
  @Matches(/^https?:\/\//, { message: 'Base URL 应以 http(s):// 开头' })
  @MaxLength(300)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;
}