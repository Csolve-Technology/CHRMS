import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { PaymentReceiptFilesController } from './payment-receipt-files.controller';
import { RentalPaymentsController } from './rental-payments.controller';
import { RentalPaymentsService } from './rental-payments.service';

@Module({
  imports: [SettingsModule],
  controllers: [RentalPaymentsController, PaymentReceiptFilesController],
  providers: [RentalPaymentsService],
})
export class RentalPaymentsModule {}
