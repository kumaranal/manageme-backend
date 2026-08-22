import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { IssueType, Priority } from '@prisma/client';

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['Task', 'Story', 'Bug'])
  type?: IssueType;

  @IsOptional()
  @IsIn(['Urgent', 'High', 'Medium', 'Low'])
  priority?: Priority;

  @IsOptional()
  @IsString()
  assignee?: string | null;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsISO8601()
  due?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsNumber()
  estimatedHours?: number | null;

  @IsOptional()
  @IsString()
  sprintId?: string | null;

  @IsOptional()
  @IsString()
  activityText?: string;
}
