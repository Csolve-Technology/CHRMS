import { PropertyCategory, PropertyStatus, PropertyType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePropertyDto {
  @IsEnum(PropertyType)
  type: PropertyType;

  /** Required for residential; condominium also allowed on commercial */
  @IsOptional()
  @IsEnum(PropertyCategory)
  category?: PropertyCategory;

  @IsString()
  woreda: string;

  @IsString()
  kebele: string;

  @IsString()
  houseNumber: string;

  /** Condominium block number */
  @IsOptional()
  @IsString()
  blockNumber?: string;

  /** Condominium room type: studio | one_bedroom | two_bedroom | three_bedroom */
  @IsOptional()
  @IsString()
  roomType?: string;

  /** Optional for residential; ignored for commercial */
  @IsOptional()
  @IsInt()
  @Min(0)
  rooms?: number;

  @IsNumber()
  @Min(0)
  area: number;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
