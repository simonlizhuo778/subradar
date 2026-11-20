import { IsIn, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionDto } from './create-subscription.dto';

/** 更新时允许全部四种状态(暂停/恢复/取消都走这里) */
const UPDATE_STATUS_VALUES = ['active', 'trial', 'paused', 'cancelled'] as const;

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {
  @IsOptional()
  @IsIn(UPDATE_STATUS_VALUES, { message: '状态取值不合法' })
  status?: string;
}
