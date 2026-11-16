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
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Permission } from '../common/constants/permissions';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { streamUploadedFile } from '../common/upload-file-response';

@Controller('uploads/agreements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AgreementFilesController {
  @Get(':filename')
  @RequirePermissions(Permission.RENTALS_READ)
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
    const file = join(process.cwd(), 'uploads', 'agreements', filename);
    if (!existsSync(file))
      throw new NotFoundException('Agreement file not found');
    return streamUploadedFile(file, filename, inline === '1' || inline === 'true');
  }
}
