import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Min } from 'class-validator';

export class RenewRentalDto {
  /** New lease end date (required). */
  @IsDateString()
  endDate: string;

  /** Optional new monthly rent; defaults to current rent. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent?: number;

  /**
   * For expired/ended leases: start of the new agreement.
   * Defaults to the day after the previous end date (or today).
   */
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
