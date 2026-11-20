import { IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class AddPaymentDto {
  @IsISO8601({}, { message: '扣款日期格式不正确' })
  paidAt!: string;

  /** 不填则使用订阅当前金额 */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000)
  amount?: number;
}
