import { Type, Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateRentalDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Pass empty string or null to clear a fixed end date. */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === 'null' ? null : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
