import {
  IsArray,
  ArrayUnique,
  ArrayMaxSize,
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Permission } from '../../common/constants/permissions';
export class RolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
export class CreateRoleDto extends RolePermissionsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
