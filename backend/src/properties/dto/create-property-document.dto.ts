import { IsString, MinLength } from 'class-validator';

export class CreatePropertyDocumentDto {
  @IsString()
  @MinLength(1)
  title: string;
}
