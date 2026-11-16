import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRentalPaymentDto {
  @IsString()
  rentalId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  paidAt: string;

  @IsString()
  method: string;

  /** Kept for legacy/security-deposit rows; optional for new payments. */
  @IsOptional()
  @IsString()
  receiptNo?: string;
}
