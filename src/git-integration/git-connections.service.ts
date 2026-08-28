import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GithubAppProvider } from './providers/github-app.provider';
import { mapGitConnection } from '../common/mappers';

@Injectable()
export class GitConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubAppProvider,
    private readonly config: ConfigService,
  ) {}

  async getConnection(orgId: string) {
    const connection = await this.prisma.gitConnection.findUnique({
      where: { orgId },
    });
    return connection ? mapGitConnection(connection) : null;
  }

  async getInstallUrl(orgId: string, userId: string) {
    const state = await this.github.signState({ orgId, userId });
    return { url: this.github.installUrl(state) };
  }

  // Called from the public GitHub callback redirect — resolves which org
  // initiated the install via the signed `state` param rather than trusting
  // anything else in the query string.
  async handleCallback(installationId: string, state: string) {
    const { orgId, userId } = await this.github.verifyState(state);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const installation = await this.github.getInstallation(installationId);

    await this.prisma.gitConnection.upsert({
      where: { orgId },
      update: {
        installationId,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        connectedById: userId,
      },
      create: {
        orgId,
        installationId,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        connectedById: userId,
      },
    });
    return org.slug;
  }

  async disconnect(orgId: string) {
    const connection = await this.prisma.gitConnection.findUnique({
      where: { orgId },
    });
    if (!connection) throw new NotFoundException('No GitHub connection');
    await this.prisma.gitConnection.delete({ where: { orgId } });
  }

  async listRepos(orgId: string) {
    const connection = await this.prisma.gitConnection.findUnique({
      where: { orgId },
    });
    if (!connection) {
      throw new BadRequestException('Organization has no GitHub connection');
    }
    return this.github.listInstallationRepos(connection.installationId);
  }

  frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
  }
}
