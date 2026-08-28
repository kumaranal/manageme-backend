import { Matches, MaxLength } from 'class-validator';

// Only the user-editable suffix is accepted from the client — the
// `type/PROJECTKEY-number-` prefix is always composed server-side so the
// naming convention can't be bypassed by a crafted request.
export class CreateBranchDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers and hyphens only',
  })
  @MaxLength(60)
  slug!: string;
}
