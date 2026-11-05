import {
  IsBoolean,
  IsArray,
  ArrayUnique,
  ArrayMaxSize,
  MaxLength,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

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

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
