import {
  IsArray,
  ArrayUnique,
  ArrayMaxSize,
  MaxLength,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  roles?: string[];
}
