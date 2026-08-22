import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../common/permissions.service';
import { EmailService } from '../email/email.service';
import { uniqueSlug } from '../common/slug';
import { mapOrganization } from '../common/mappers';
import { OrgRole, Prisma } from '@prisma/client';

// Full nested shape the frontend's Organization type expects — a single
// fetch hydrates orgs/projects/issues/sprints/store in one round trip.
const fullOrgInclude = {
  members: true,
  invites: true,
  subscription: true,
  projects: {
    include: {
      members: true,
      taskFields: true,
      statuses: { orderBy: { position: 'asc' as const } },
      sprints: true,
      storeItems: {
        include: { history: { orderBy: { at: 'desc' as const } } },
      },
      issues: {
        include: {
          comments: { orderBy: { createdAt: 'asc' as const } },
          activity: { orderBy: { createdAt: 'desc' as const } },
          cc: true,
        },
      },
    },
  },
};

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly email: EmailService,
  ) {}

  async listMine(userId: string) {
    const orgs = await this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      include: fullOrgInclude,
    });
    return orgs.map(mapOrganization);
  }

  async listAll() {
    const orgs = await this.prisma.organization.findMany({
      include: fullOrgInclude,
    });
    return orgs.map(mapOrganization);
  }

  async listDiscoverable(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { none: { userId } } },
      select: { id: true, name: true, slug: true, initial: true },
    });
  }

  async findOneOrThrow(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: fullOrgInclude,
    });
    if (!org) throw new NotFoundException('Organization not found');
    return mapOrganization(org);
  }

  // Called by BillingService inside the checkout-finalize transaction — kept
  // separate from `create` so the same slug/membership logic can run against
  // a `tx` client instead of `this.prisma`.
  async createWithinTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    name: string,
  ) {
    const existingSlugs = (
      await tx.organization.findMany({ select: { slug: true } })
    ).map((o) => o.slug);
    const slug = uniqueSlug(name, existingSlugs);
    return tx.organization.create({
      data: {
        name,
        slug,
        initial: name.trim()[0]?.toUpperCase() ?? '?',
        members: { create: { userId, role: 'ORG_ADMIN' } },
      },
    });
  }

  async create(userId: string, name: string) {
    const org = await this.createWithinTransaction(this.prisma, userId, name);
    return this.findOneOrThrow(org.id);
  }

  async join(userId: string, orgId: string) {
    const already = await this.permissions.orgRole(orgId, userId);
    if (already) throw new ForbiddenException('Already a member');
    await this.prisma.membership.create({
      data: { orgId, userId, role: 'MEMBER' },
    });
    return this.findOneOrThrow(orgId);
  }

  async toggleSuspend(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { status: org.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' },
    });
    return this.findOneOrThrow(orgId);
  }

  async updateCapacity(orgId: string, hours: number) {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { capacityHoursPerWeek: Math.max(1, hours) },
    });
    return this.findOneOrThrow(orgId);
  }

  async inviteMember(
    orgId: string,
    email: string,
    role: OrgRole,
    inviterName: string,
  ) {
    const [invite, org] = await Promise.all([
      this.prisma.invite.create({ data: { orgId, email, role } }),
      this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
    ]);
    await this.email.sendOrgInvite({
      to: email,
      orgName: org.name,
      inviterName,
      role,
      token: invite.token,
    });
    return { invite, org: await this.findOneOrThrow(orgId) };
  }

  async revokeInvite(orgId: string, inviteId: string) {
    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, orgId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    await this.prisma.invite.delete({ where: { id: inviteId } });
    return this.findOneOrThrow(orgId);
  }

  async previewInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: { org: true },
    });
    if (!invite)
      throw new NotFoundException('Invite not found or already used');
    return {
      orgName: invite.org.name,
      orgSlug: invite.org.slug,
      orgInitial: invite.org.initial,
      role: invite.role,
      email: invite.email,
    };
  }

  async acceptInvite(userId: string, userEmail: string, token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite)
      throw new NotFoundException('Invite not found or already used');
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This invite was sent to a different email address',
      );
    }
    await this.prisma.membership.upsert({
      where: { orgId_userId: { orgId: invite.orgId, userId } },
      update: { role: invite.role },
      create: { orgId: invite.orgId, userId, role: invite.role },
    });
    await this.prisma.invite.delete({ where: { id: invite.id } });
    return this.findOneOrThrow(invite.orgId);
  }

  async updateMemberRole(orgId: string, userId: string, role: OrgRole) {
    await this.prisma.membership.update({
      where: { orgId_userId: { orgId, userId } },
      data: { role },
    });
    return this.findOneOrThrow(orgId);
  }

  async removeMember(orgId: string, userId: string) {
    await this.prisma.$transaction([
      this.prisma.projectMembership.deleteMany({
        where: { userId, project: { orgId } },
      }),
      this.prisma.membership.delete({
        where: { orgId_userId: { orgId, userId } },
      }),
    ]);
    return this.findOneOrThrow(orgId);
  }
}
