import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CHANNEL_TYPES = ['feishu', 'webhook', 'email'] as const;

export class SmtpDto {
  @IsString()
  @Length(1, 200)
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsString()
  @Length(1, 200)
  user!: string;

  @IsString()
  @Length(1, 300)
  pass!: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  from?: string;
}

export class CreateChannelDto {
  @IsIn(CHANNEL_TYPES, { message: '渠道类型应为 feishu / webhook / email' })
  type!: (typeof CHANNEL_TYPES)[number];

  @IsString()
  @Length(1, 40)
  label!: string;

  /** feishu/webhook:目标 URL;email:收件地址 */
  @IsString()
  @Length(1, 500)
  target!: string;

  /** 飞书机器人开启「签名校验」时填写 */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  secret?: string;

  /** email 渠道必填 */
  @IsOptional()
  @ValidateNested()
  @Type(() => SmtpDto)
  smtp?: SmtpDto;
}

export class ToggleChannelDto {
  @IsBoolean()
  enabled!: boolean;
}

/** 邮箱地址格式校验(供 service 复用) */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** URL 校验 */
export const URL_PATTERN = /^https?:\/\//;