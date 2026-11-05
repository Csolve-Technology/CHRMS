import { AgreementFilesController } from './agreement-files.controller';
import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';

@Module({
  imports: [SettingsModule],
  controllers: [RentalsController, AgreementFilesController],
  providers: [RentalsService],
})
export class RentalsModule {}
