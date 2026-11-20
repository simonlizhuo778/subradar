import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const CYCLE_VALUES = ['monthly', 'quarterly', 'yearly', 'weekly', 'custom'] as const;
export const PAYMENT_METHOD_VALUES = ['alipay', 'wechat', 'apple', 'card', 'other'] as const;
/** 新建时只允许这两个状态,暂停/取消属于后续操作 */
export const CREATE_STATUS_VALUES = ['active', 'trial'] as const;

export class CreateSubscriptionDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  logoUrl?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额格式不正确(最多两位小数)' })
  @Min(0)
  amount!: number;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: '币种应为 3 位大写字母,如 CNY / USD' })
  currency?: string;

  @IsIn(CYCLE_VALUES, { message: '周期取值不合法' })
  cycle!: (typeof CYCLE_VALUES)[number];

  /** cycle=custom 时必填,服务层校验 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  customDays?: number;

  @IsISO8601({}, { message: '首次扣款日格式不正确' })
  firstPaymentDate!: string;

  @IsOptional()
  @IsIn(PAYMENT_METHOD_VALUES)
  paymentMethod?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  notes?: string;

  @IsOptional()
  @IsIn(CREATE_STATUS_VALUES)
  status?: string;
}
