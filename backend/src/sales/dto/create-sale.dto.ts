import {
  IsDateString,
  IsInt,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class CreateSaleDto {
  @IsString()
  propertyId: string;

  @IsString()
  buyerId: string;

  @IsNumber()
  @Min(0)
  totalPrice: number;

  /** Initial amount paid (full price when fully paid). */
  @IsNumber()
  @Min(0)
  downPayment: number;

  /**
   * Months to pay the remaining balance after the initial payment.
   * Use 0 when the sale is fully paid up front.
   */
  @IsInt()
  @Min(0)
  durationMonths: number;

  @IsDateString()
  startDate: string;
}
