import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StoreKind } from '@prisma/client';

export class CreateStoreItemDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsIn(['DOC', 'ENV', 'LINK', 'NOTE'])
  kind!: StoreKind;

  @IsString()
  content!: string;
}

export class UpdateStoreItemDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(['DOC', 'ENV', 'LINK', 'NOTE'])
  kind?: StoreKind;

  @IsOptional()
  @IsString()
  historyText?: string;
}
