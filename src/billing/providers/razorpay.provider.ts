import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayProvider {
  readonly keyId: string | undefined;
  private readonly client: Razorpay | null;
  private readonly keySecret: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    this.client =
      this.keyId && this.keySecret
        ? new Razorpay({ key_id: this.keyId, key_secret: this.keySecret })
        : null;
  }

  private requireClient(): Razorpay {
    if (!this.client)
      throw new ServiceUnavailableException('Razorpay is not configured');
    return this.client;
  }

  async createOrder(amountPaise: number, receipt: string) {
    return this.requireClient().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
    });
  }

  // Standard Razorpay checkout verification: HMAC-SHA256 of
  // "order_id|payment_id", keyed with the account's key secret.
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    if (!this.keySecret) return false;
    return this.hmacMatches(
      `${orderId}|${paymentId}`,
      signature,
      this.keySecret,
    );
  }

  // Webhook payloads are signed the same way, keyed with the separate
  // per-webhook secret configured in the Razorpay dashboard.
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return this.hmacMatches(rawBody, signature, this.webhookSecret);
  }

  private hmacMatches(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
