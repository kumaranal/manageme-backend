import { IsInt, IsString, Min } from 'class-validator';

export class MoveIssueDto {
  @IsString()
  statusId!: string;

  @IsInt()
  @Min(0)
  index!: number;
}
