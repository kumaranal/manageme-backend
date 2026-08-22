import { Module } from '@nestjs/common';
import { AdminPlansController } from './admin-plans.controller';
import { AdminPlansService } from './admin-plans.service';
import { AdminCouponsController } from './admin-coupons.controller';
import { AdminCouponsService } from './admin-coupons.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminAnalyticsService } from './admin-analytics.service';

@Module({
  controllers: [
    AdminPlansController,
    AdminCouponsController,
    AdminAnalyticsController,
    AdminPaymentsController,
  ],
  providers: [AdminPlansService, AdminCouponsService, AdminAnalyticsService],
})
export class AdminModule {}
