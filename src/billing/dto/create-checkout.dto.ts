import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BillingCurrency } from '@prisma/client';

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  orgName!: string;

  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsIn(['INR', 'USD'])
  currency!: BillingCurrency;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  couponCode?: string;
}
