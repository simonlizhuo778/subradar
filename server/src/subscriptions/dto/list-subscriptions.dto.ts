import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length } from 'class-validator';

const STATUS_FILTER_VALUES = ['active', 'trial', 'paused', 'cancelled', 'all'] as const;
const SORT_FIELDS = ['nextPaymentDate', 'amount', 'name', 'createdAt'] as const;

export class ListSubscriptionsDto {
  @IsOptional()
  @IsIn(STATUS_FILTER_VALUES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  q?: string;

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;
}
