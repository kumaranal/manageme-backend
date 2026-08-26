import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { BillingCurrency } from '@prisma/client';

export class RenewCheckoutDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsIn(['INR', 'USD'])
  currency!: BillingCurrency;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}
