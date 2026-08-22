import { IsIn } from 'class-validator';
import { OrgRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsIn(['ORG_ADMIN', 'MEMBER'])
  role!: OrgRole;
}
