import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GithubAppProvider } from './providers/github-app.provider';
import { mapProjectRepo } from '../common/mappers';

@Injectable()
export class ProjectReposService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubAppProvider,
  ) {}

  private async requireProject(orgId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, orgId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async getRepo(orgId: string, projectId: string) {
    await this.requireProject(orgId, projectId);
    const repo = await this.prisma.projectRepo.findUnique({
      where: { projectId },
    });
    return repo ? mapProjectRepo(repo) : null;
  }

  async linkRepo(
    orgId: string,
    projectId: string,
    userId: string,
    repoId: number,
  ) {
    await this.requireProject(orgId, projectId);
    const connection = await this.prisma.gitConnection.findUnique({
      where: { orgId },
    });
    if (!connection) {
      throw new BadRequestException('Organization has no GitHub connection');
    }

    const repos = await this.github.listInstallationRepos(
      connection.installationId,
    );
    const repo = repos.find((r) => r.repoId === repoId);
    if (!repo) {
      throw new BadRequestException(
        'Repository is not accessible to the connected GitHub App',
      );
    }

    const saved = await this.prisma.projectRepo.upsert({
      where: { projectId },
      update: {
        gitConnectionId: connection.id,
        repoId: repo.repoId,
        repoFullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        linkedById: userId,
      },
      create: {
        projectId,
        gitConnectionId: connection.id,
        repoId: repo.repoId,
        repoFullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        linkedById: userId,
      },
    });
    return mapProjectRepo(saved);
  }

  async unlinkRepo(orgId: string, projectId: string) {
    await this.requireProject(orgId, projectId);
    const repo = await this.prisma.projectRepo.findUnique({
      where: { projectId },
    });
    if (!repo) throw new NotFoundException('No repository linked');
    await this.prisma.projectRepo.delete({ where: { projectId } });
  }
}
