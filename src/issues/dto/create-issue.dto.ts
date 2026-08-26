import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IssueType, Priority } from '@prisma/client';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsIn(['Task', 'Story', 'Bug'])
  type!: IssueType;

  @IsString()
  statusId!: string;

  @IsIn(['Urgent', 'High', 'Medium', 'Low'])
  priority!: Priority;

  @IsOptional()
  @IsString()
  assignee?: string | null;

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
}
