import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { PermissionsService } from '../common/permissions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateCapacityDto } from './dto/update-capacity.dto';

@ApiTags('organizations')
@ApiBearerAuth('bearer')
@Controller()
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('organizations')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.listMine(user.id);
  }

  @Get('organizations/all')
  listAll(@CurrentUser() user: AuthenticatedUser) {
    this.requireSuperadmin(user);
    return this.organizations.listAll();
  }

  @Get('organizations/discoverable')
  listDiscoverable(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.listDiscoverable(user.id);
  }

  @Get('organizations/:orgId')
  async findOne(@Param('orgId') orgId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.permissions.requireOrgMember(orgId, user.id);
    return this.organizations.findOneOrThrow(orgId);
  }

  @Post('organizations')
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.organizations.create(user.id, dto.name);
  }

  @Post('organizations/:orgId/join')
  join(@Param('orgId') orgId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizations.join(user.id, orgId);
  }

  @Patch('organizations/:orgId/suspend')
  toggleSuspend(@Param('orgId') orgId: string, @CurrentUser() user: AuthenticatedUser) {
    this.requireSuperadmin(user);
    return this.organizations.toggleSuspend(orgId);
  }

  @Patch('organizations/:orgId/capacity')
  async updateCapacity(
    @Param('orgId') orgId: string,
    @Body() dto: UpdateCapacityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgAdmin(orgId, user.id);
    return this.organizations.updateCapacity(orgId, dto.hours);
  }

  @Post('organizations/:orgId/invites')
  async invite(
    @Param('orgId') orgId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgAdmin(orgId, user.id);
    return this.organizations.inviteMember(orgId, dto.email, dto.role, user.name);
  }

  @Delete('organizations/:orgId/invites/:inviteId')
  async revokeInvite(
    @Param('orgId') orgId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgAdmin(orgId, user.id);
    return this.organizations.revokeInvite(orgId, inviteId);
  }

  @Public()
  @ApiOperation({ summary: 'Preview an org invite (no auth required)' })
  @Get('invites/:token')
  previewInvite(@Param('token') token: string) {
    return this.organizations.previewInvite(token);
  }

  @Post('invites/:token/accept')
  acceptInvite(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizations.acceptInvite(user.id, user.email, token);
  }

  @Patch('organizations/:orgId/members/:userId')
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgAdmin(orgId, user.id);
    return this.organizations.updateMemberRole(orgId, userId, dto.role);
  }

  @Delete('organizations/:orgId/members/:userId')
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.permissions.requireOrgAdmin(orgId, user.id);
    return this.organizations.removeMember(orgId, userId);
  }

  private requireSuperadmin(user: AuthenticatedUser) {
    if (!user.isSuperadmin) throw new ForbiddenException('Requires superadmin');
  }
}
