import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { CreateRentalDto } from './dto/create-rental.dto';
import { RenewRentalDto } from './dto/renew-rental.dto';
import { TerminateRentalDto } from './dto/terminate-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';
import { RentalsService } from './rentals.service';

const agreementUpload = FileInterceptor('agreementFile', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, RentalsService.agreementsDir());
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

@Controller('rentals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  @Get()
  @RequirePermissions(Permission.RENTALS_READ)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rentals.findAll({ page, pageSize });
  }

  @Post('expire-due')
  @RequirePermissions(Permission.RENTALS_WRITE)
  expireDue() {
    return this.rentals.expireDueRentals();
  }

  @Get(':id')
  @RequirePermissions(Permission.RENTALS_READ)
  findOne(@Param('id') id: string) {
    return this.rentals.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.RENTALS_WRITE)
  @UseInterceptors(agreementUpload)
  create(
    @Body() dto: CreateRentalDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.rentals.create(dto, file);
  }

  @Put(':id')
  @RequirePermissions(Permission.RENTALS_WRITE)
  @UseInterceptors(agreementUpload)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRentalDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.rentals.update(id, dto, file);
  }

  @Post(':id/terminate')
  @RequirePermissions(Permission.RENTALS_WRITE)
  terminate(@Param('id') id: string, @Body() dto: TerminateRentalDto) {
    return this.rentals.terminate(id, dto);
  }

  @Post(':id/renew')
  @RequirePermissions(Permission.RENTALS_WRITE)
  @UseInterceptors(agreementUpload)
  renew(
    @Param('id') id: string,
    @Body() dto: RenewRentalDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.rentals.renew(id, dto, file);
  }

  @Delete(':id')
  @RequirePermissions(Permission.RENTALS_WRITE)
  remove(@Param('id') id: string) {
    return this.rentals.remove(id);
  }
}
