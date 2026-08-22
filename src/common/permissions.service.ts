import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole, ProjectRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async orgRole(orgId: string, userId: string): Promise<OrgRole | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    return membership?.role ?? null;
  }

  async isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
    return (await this.orgRole(orgId, userId)) === 'ORG_ADMIN';
  }

  async requireOrgMember(orgId: string, userId: string): Promise<OrgRole> {
    const role = await this.orgRole(orgId, userId);
    if (!role) throw new ForbiddenException('Not a member of this organization');
    return role;
  }

  async requireOrgAdmin(orgId: string, userId: string): Promise<void> {
    if (!(await this.isOrgAdmin(orgId, userId))) {
      throw new ForbiddenException('Requires organization admin');
    }
  }

  // Org admins act as an implicit project LEAD, matching the frontend's projectRole().
  async projectRole(orgId: string, projectId: string, userId: string): Promise<ProjectRole | null> {
    if (await this.isOrgAdmin(orgId, userId)) return 'LEAD';
    const membership = await this.prisma.projectMembership.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return membership?.role ?? null;
  }

  async canEditProject(orgId: string, projectId: string, userId: string): Promise<boolean> {
    const role = await this.projectRole(orgId, projectId, userId);
    return role === 'LEAD' || role === 'CONTRIBUTOR';
  }

  async isProjectManager(orgId: string, projectId: string, userId: string): Promise<boolean> {
    return (await this.projectRole(orgId, projectId, userId)) === 'LEAD';
  }

  async requireProjectRead(orgId: string, projectId: string, userId: string): Promise<void> {
    const role = await this.projectRole(orgId, projectId, userId);
    if (!role) throw new ForbiddenException('Not a member of this project');
  }

  async requireProjectEdit(orgId: string, projectId: string, userId: string): Promise<void> {
    if (!(await this.canEditProject(orgId, projectId, userId))) {
      throw new ForbiddenException('Requires project lead or contributor');
    }
  }

  async requireProjectManager(orgId: string, projectId: string, userId: string): Promise<void> {
    if (!(await this.isProjectManager(orgId, projectId, userId))) {
      throw new ForbiddenException('Requires project lead');
    }
  }
}
