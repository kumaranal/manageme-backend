import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlansService } from './plans.service';
import { CouponsService } from './coupons.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    PlansService,
    CouponsService,
    RazorpayProvider,
    StripeProvider,
  ],
})
export class BillingModule {}
