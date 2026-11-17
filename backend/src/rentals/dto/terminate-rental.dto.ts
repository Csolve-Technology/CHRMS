import { IsDateString, IsOptional } from 'class-validator';

export class TerminateRentalDto {
  /** Actual early termination date (defaults to today). */
  @IsOptional()
  @IsDateString()
  terminatedAt?: string;
}
