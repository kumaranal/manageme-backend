import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GithubAppProvider } from './providers/github-app.provider';
import { mapIssueBranch } from '../common/mappers';

@Injectable()
export class IssueBranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubAppProvider,
  ) {}

  async list(orgId: string, projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId, project: { orgId } },
      include: { branches: { orderBy: { createdAt: 'asc' } } },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue.branches.map(mapIssueBranch);
  }

  async create(
    orgId: string,
    projectId: string,
    issueId: string,
    userId: string,
    slug: string,
  ) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId, project: { orgId } },
      include: { project: true },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    const projectRepo = await this.prisma.projectRepo.findUnique({
      where: { projectId },
      include: { gitConnection: true },
    });
    if (!projectRepo) {
      throw new BadRequestException('This project has no repository linked');
    }

    const branchName = `${issue.type.toLowerCase()}/${issue.project.key}-${issue.number}-${slug}`;
    const existing = await this.prisma.issueBranch.findUnique({
      where: {
        projectRepoId_branchName: { projectRepoId: projectRepo.id, branchName },
      },
    });
    if (existing) {
      throw new BadRequestException(`Branch ${branchName} already exists`);
    }

    const [owner, repo] = projectRepo.repoFullName.split('/');
    await this.github.createBranch(
      projectRepo.gitConnection.installationId,
      owner,
      repo,
      branchName,
      projectRepo.defaultBranch,
    );

    const created = await this.prisma.issueBranch.create({
      data: {
        issueId,
        projectRepoId: projectRepo.id,
        branchName,
        createdById: userId,
      },
    });
    await this.prisma.activityEntry.create({
      data: { issueId, actorId: userId, text: `created branch ${branchName}` },
    });
    return mapIssueBranch(created);
  }
}
