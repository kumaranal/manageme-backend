import { IsIn, IsOptional } from 'class-validator';
import { BillingCurrency, PaymentGateway } from '@prisma/client';
import { PaginatedQueryDto } from './paginated-query.dto';

export class ListPaymentsQueryDto extends PaginatedQueryDto {
  @IsOptional()
  @IsIn(['RAZORPAY', 'STRIPE'])
  gateway?: PaymentGateway;

  @IsOptional()
  @IsIn(['INR', 'USD'])
  currency?: BillingCurrency;
}
