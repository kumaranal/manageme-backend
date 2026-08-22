import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  }

  async sendOrgInvite(params: {
    to: string;
    orgName: string;
    inviterName: string;
    role: string;
    token: string;
  }): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`RESEND_API_KEY not set — skipping invite email to ${params.to}`);
      return;
    }

    const link = `${this.frontendUrl}/invite/${params.token}`;
    const roleLabel = params.role === 'ORG_ADMIN' ? 'an admin' : 'a member';
    const inviterName = escapeHtml(params.inviterName);
    const orgName = escapeHtml(params.orgName);

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: `${params.inviterName} invited you to join ${params.orgName} on manage-me`,
        html: `
          <p>${inviterName} invited you to join <strong>${orgName}</strong> as ${roleLabel} on manage-me.</p>
          <p><a href="${link}">Accept the invitation</a></p>
          <p style="color:#666;font-size:13px">Or paste this link into your browser: ${link}</p>
        `,
      });
      if (error) this.logger.error(`Resend rejected invite email to ${params.to}: ${error.message}`);
    } catch (e) {
      this.logger.error(`Failed to send invite email to ${params.to}`, e as Error);
    }
  }
}
