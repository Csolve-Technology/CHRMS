import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyDocumentFilesController } from './property-document-files.controller';

@Module({
  controllers: [PropertiesController, PropertyDocumentFilesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
