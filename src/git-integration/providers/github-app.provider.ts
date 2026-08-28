import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from 'octokit';
import { SignJWT, jwtVerify } from 'jose';
import { createHmac, timingSafeEqual } from 'crypto';

export interface GithubStatePayload {
  orgId: string;
  userId: string;
}

export interface GithubInstallationRepo {
  repoId: number;
  fullName: string;
  defaultBranch: string;
}

@Injectable()
export class GithubAppProvider {
  private readonly appId: string | undefined;
  private readonly privateKey: string | undefined;
  private readonly appSlug: string | undefined;
  private readonly webhookSecret: string | undefined;
  private readonly stateSecret: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.appId = this.config.get<string>('GITHUB_APP_ID');
    // Private keys are stored as env vars with literal "\n" sequences —
    // restore real newlines before handing them to the PEM parser.
    this.privateKey = this.config
      .get<string>('GITHUB_APP_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');
    this.appSlug = this.config.get<string>('GITHUB_APP_SLUG');
    this.webhookSecret = this.config.get<string>('GITHUB_WEBHOOK_SECRET');
    this.stateSecret = this.config.get<string>('GITHUB_STATE_SECRET');
  }

  get configured(): boolean {
    return !!(this.appId && this.privateKey);
  }

  private requireConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException('GitHub App is not configured');
    }
  }

  installUrl(state: string): string {
    this.requireConfigured();
    if (!this.appSlug) {
      throw new ServiceUnavailableException('GITHUB_APP_SLUG is not set');
    }
    return `https://github.com/apps/${this.appSlug}/installations/new?state=${encodeURIComponent(state)}`;
  }

  async signState(payload: GithubStatePayload): Promise<string> {
    if (!this.stateSecret) {
      throw new ServiceUnavailableException('GITHUB_STATE_SECRET is not set');
    }
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(this.stateSecret));
  }

  async verifyState(token: string): Promise<GithubStatePayload> {
    if (!this.stateSecret) {
      throw new ServiceUnavailableException('GITHUB_STATE_SECRET is not set');
    }
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(this.stateSecret),
    );
    return { orgId: payload.orgId as string, userId: payload.userId as string };
  }

  private installationOctokit(installationId: string): Octokit {
    this.requireConfigured();
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId,
        privateKey: this.privateKey,
        installationId,
      },
    });
  }

  // "Get an installation for the authenticated app" only accepts the App's
  // own JWT, not an installation access token — so this needs a separate,
  // app-level (rather than installation-level) authenticated client.
  private async appJwtOctokit(): Promise<Octokit> {
    this.requireConfigured();
    const auth = createAppAuth({ appId: this.appId!, privateKey: this.privateKey! });
    const { token } = await auth({ type: 'app' });
    return new Octokit({ auth: token });
  }

  async getInstallation(installationId: string) {
    const octokit = await this.appJwtOctokit();
    const { data: installation } = await octokit.request(
      'GET /app/installations/{installation_id}',
      { installation_id: Number(installationId) },
    );
    return {
      accountLogin: (installation.account as { login?: string; name?: string })
        ?.login ?? (installation.account as { name?: string })?.name ?? 'unknown',
      accountType:
        (installation.account as { type?: string })?.type ?? 'Organization',
    };
  }

  async listInstallationRepos(
    installationId: string,
  ): Promise<GithubInstallationRepo[]> {
    const octokit = this.installationOctokit(installationId);
    const repos = await octokit.paginate(
      octokit.rest.apps.listReposAccessibleToInstallation,
      { per_page: 100 },
    );
    return repos.map((r) => ({
      repoId: r.id,
      fullName: r.full_name,
      defaultBranch: r.default_branch,
    }));
  }

  async createBranch(
    installationId: string,
    owner: string,
    repo: string,
    branchName: string,
    fromBranch: string,
  ): Promise<void> {
    const octokit = this.installationOctokit(installationId);
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${fromBranch}`,
    });
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });
  }

  // GitHub signs webhook payloads as HMAC-SHA256 of the raw body, sent as
  // "sha256=<hex>" in the X-Hub-Signature-256 header.
  verifyWebhook(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected =
      'sha256=' +
      createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
