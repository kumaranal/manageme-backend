import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class AddProjectMemberDto {
  @IsString()
  userId!: string;
}

export class UpdateProjectMemberRoleDto {
  @IsIn(['LEAD', 'CONTRIBUTOR', 'VIEWER'])
  role!: ProjectRole;
}

export class UpdateProjectMemberHoursDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  hours!: number | null;
}
