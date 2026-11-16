import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { basename, join } from 'path';
import { Permission } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { streamUploadedFile } from '../common/upload-file-response';

@Controller('uploads/payment-receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentReceiptFilesController {
  @Get(':filename')
  @RequirePermissions(Permission.RENTAL_PAYMENTS_READ)
  download(
    @Param('filename') filename: string,
    @Query('inline') inline?: string,
  ) {
    if (
      !/^[A-Za-z0-9._-]+$/.test(filename) ||
      filename !== basename(filename) ||
      filename === '.' ||
      filename === '..'
    )
      throw new NotFoundException();
    const file = join(process.cwd(), 'uploads', 'payment-receipts', filename);
    if (!existsSync(file)) throw new NotFoundException('Receipt file not found');
    return streamUploadedFile(file, filename, inline === '1' || inline === 'true');
  }
}
