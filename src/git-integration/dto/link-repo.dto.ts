import { IsInt, Min } from 'class-validator';

export class LinkRepoDto {
  @IsInt()
  @Min(1)
  repoId!: number;
}
