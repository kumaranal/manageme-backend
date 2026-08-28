import { Module } from '@nestjs/common';
import { GitConnectionsController } from './git-connections.controller';
import { GitConnectionsService } from './git-connections.service';
import { ProjectReposController } from './project-repos.controller';
import { ProjectReposService } from './project-repos.service';
import { IssueBranchesController } from './issue-branches.controller';
import { IssueBranchesService } from './issue-branches.service';
import { WebhooksController } from './webhooks.controller';
import { GithubAppProvider } from './providers/github-app.provider';

@Module({
  controllers: [
    GitConnectionsController,
    ProjectReposController,
    IssueBranchesController,
    WebhooksController,
  ],
  providers: [
    GitConnectionsService,
    ProjectReposService,
    IssueBranchesService,
    GithubAppProvider,
  ],
})
export class GitIntegrationModule {}
