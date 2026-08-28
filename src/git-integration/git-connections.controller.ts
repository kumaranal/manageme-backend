import { Controller, Delete, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GitConnectionsService } from './git-connections.service';
import { PermissionsService } from '../common/permissions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';

@ApiTags('git-integration')
@ApiBearerAuth('bearer')
@Controller()
export class GitConnectionsController {
  constructor(
    private readonly connections: GitConnectionsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('organizations/:orgId/git/connection')
  async getConnection(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgMember(orgId, user.id);
    return this.connections.getConnection(orgId);
  }

  @Get('organizations/:orgId/git/install-url')
  async getInstallUrl(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgAdmin(orgId, user.id);
    return this.connections.getInstallUrl(orgId, user.id);
  }

  @Get('organizations/:orgId/git/repos')
  async listRepos(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgMember(orgId, user.id);
    return this.connections.listRepos(orgId);
  }

  @Delete('organizations/:orgId/git/connection')
  async disconnect(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgAdmin(orgId, user.id);
    await this.connections.disconnect(orgId);
    return { ok: true };
  }

  // GitHub redirects the browser here after the app is installed — this must
  // stay public (no bearer token available on a plain browser redirect); the
  // signed `state` param is what proves which org/user initiated it.
  @Public()
  @Get('git/callback')
  async callback(
    @Query('installation_id') installationId: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const orgSlug = await this.connections.handleCallback(
      installationId,
      state,
    );
    res.redirect(
      `${this.connections.frontendUrl()}/o/${orgSlug}/settings?git=connected`,
    );
  }
}
