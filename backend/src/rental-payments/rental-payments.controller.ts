import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Permission } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateRentalPaymentDto } from './dto/create-rental-payment.dto';
import { RentalPaymentsService } from './rental-payments.service';

const receiptUpload = FileInterceptor('receiptFile', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, RentalPaymentsService.receiptsDir());
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${extname(file.originalname) || '.pdf'}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /pdf|msword|officedocument|image\//i.test(file.mimetype) ||
      /\.(pdf|doc|docx|png|jpe?g)$/i.test(file.originalname);
    cb(null, ok);
  },
});

@Controller('rental-payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RentalPaymentsController {
  constructor(private readonly payments: RentalPaymentsService) {}

  @Get()
  @RequirePermissions(Permission.RENTAL_PAYMENTS_READ)
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('rentalId') rentalId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.payments.findAll({ from, to, rentalId, page, pageSize });
  }

  @Post()
  @RequirePermissions(Permission.RENTAL_PAYMENTS_WRITE)
  @UseInterceptors(receiptUpload)
  create(
    @Body() dto: CreateRentalPaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.payments.create(dto, file);
  }
}
