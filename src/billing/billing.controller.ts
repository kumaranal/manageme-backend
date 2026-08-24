import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import Stripe from 'stripe';
import { BillingService } from './billing.service';
import { PlansService } from './plans.service';
import { PermissionsService } from '../common/permissions.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { RenewCheckoutDto } from './dto/renew-checkout.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';

interface RazorpayWebhookEvent {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
  };
}

@ApiTags('billing')
@ApiBearerAuth('bearer')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly plans: PlansService,
    private readonly permissions: PermissionsService,
    private readonly razorpay: RazorpayProvider,
    private readonly stripe: StripeProvider,
  ) {}

  @Public()
  @Get('plans')
  listPlans() {
    return this.plans.listActive();
  }

  @Post('checkout/organizations')
  createOrgCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billing.initiateNewOrgCheckout(user.id, dto);
  }

  @Post('checkout/organizations/:orgId/renew')
  async renewCheckout(
    @Param('orgId') orgId: string,
    @Body() dto: RenewCheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgAdmin(orgId, user.id);
    return this.billing.initiateRenewalCheckout(user.id, orgId, dto);
  }

  @Get('checkout/:id')
  getCheckoutStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billing.getStatus(id, user.id);
  }

  @Post('checkout/razorpay/verify')
  verifyRazorpay(@Body() dto: VerifyRazorpayPaymentDto) {
    return this.billing.verifyRazorpayPayment(dto);
  }

  @Public()
  @Post('webhooks/razorpay')
  async razorpayWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    if (
      !req.rawBody ||
      !signature ||
      !this.razorpay.verifyWebhookSignature(req.rawBody, signature)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = JSON.parse(req.rawBody.toString()) as RazorpayWebhookEvent;
    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      if (orderId && paymentId) {
        const session = await this.billing.findByGatewayOrderId(orderId);
        if (session) await this.billing.finalize(session.id, paymentId);
      }
    } else if (event.event === 'payment.failed') {
      const orderId = event.payload?.payment?.entity?.order_id;
      if (orderId) {
        const session = await this.billing.findByGatewayOrderId(orderId);
        if (session) await this.billing.markFailed(session.id);
      }
    }
    return { ok: true };
  }

  @Public()
  @Post('webhooks/stripe')
  async stripeWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'] as string | undefined;
    if (!req.rawBody || !signature)
      throw new UnauthorizedException('Missing stripe signature');

    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const checkoutSessionId = session.metadata?.checkoutSessionId;
      const paymentIntent = session.payment_intent;
      const paymentIntentId =
        typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;
      if (checkoutSessionId && paymentIntentId) {
        await this.billing.finalize(checkoutSessionId, paymentIntentId);
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const checkoutSessionId = session.metadata?.checkoutSessionId;
      if (checkoutSessionId) await this.billing.markFailed(checkoutSessionId);
    }
    return { received: true };
  }
}
