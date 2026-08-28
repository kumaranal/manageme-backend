import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectReposService } from './project-repos.service';
import { PermissionsService } from '../common/permissions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { LinkRepoDto } from './dto/link-repo.dto';

@ApiTags('git-integration')
@ApiBearerAuth('bearer')
@Controller('organizations/:orgId/projects/:projectId/git/repo')
export class ProjectReposController {
  constructor(
    private readonly projectRepos: ProjectReposService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  async get(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectRead(orgId, projectId, user.id);
    return this.projectRepos.getRepo(orgId, projectId);
  }

  @Put()
  async link(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() dto: LinkRepoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    return this.projectRepos.linkRepo(orgId, projectId, user.id, dto.repoId);
  }

  @Delete()
  async unlink(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireProjectManager(orgId, projectId, user.id);
    await this.projectRepos.unlinkRepo(orgId, projectId);
    return { ok: true };
  }
}
