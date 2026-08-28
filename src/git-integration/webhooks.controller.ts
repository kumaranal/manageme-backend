import {
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { GithubAppProvider } from './providers/github-app.provider';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';
import { PrState } from '@prisma/client';

interface PullRequestWebhookPayload {
  action: string;
  repository: { id: number };
  pull_request: {
    number: number;
    html_url: string;
    title: string;
    draft: boolean;
    merged: boolean;
    head: { ref: string };
  };
}

@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly github: GithubAppProvider,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('github')
  async githubWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const event = req.headers['x-github-event'] as string | undefined;
    if (!req.rawBody || !signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }
    const valid = this.github.verifyWebhook(req.rawBody.toString(), signature);
    if (!valid) throw new UnauthorizedException('Invalid webhook signature');

    if (event === 'pull_request') {
      await this.handlePullRequest(
        JSON.parse(req.rawBody.toString()) as PullRequestWebhookPayload,
      );
    }
    return { ok: true };
  }

  private async handlePullRequest(payload: PullRequestWebhookPayload) {
    const { action, repository, pull_request: pr } = payload;

    const projectRepo = await this.prisma.projectRepo.findFirst({
      where: { repoId: repository.id },
    });
    if (!projectRepo) return;

    const branch = await this.prisma.issueBranch.findUnique({
      where: {
        projectRepoId_branchName: {
          projectRepoId: projectRepo.id,
          branchName: pr.head.ref,
        },
      },
    });
    if (!branch) return;

    let prState: PrState;
    if (action === 'closed') {
      prState = pr.merged ? PrState.MERGED : PrState.CLOSED;
    } else if (action === 'converted_to_draft') {
      prState = PrState.DRAFT;
    } else {
      prState = pr.draft ? PrState.DRAFT : PrState.OPEN;
    }

    await this.prisma.issueBranch.update({
      where: { id: branch.id },
      data: {
        prNumber: pr.number,
        prState,
        prUrl: pr.html_url,
        prTitle: pr.title,
      },
    });
  }
}
