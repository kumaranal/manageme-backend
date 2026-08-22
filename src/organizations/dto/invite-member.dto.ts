import { IsEmail, IsIn } from 'class-validator';
import { OrgRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(['ORG_ADMIN', 'MEMBER'])
  role!: OrgRole;
}
