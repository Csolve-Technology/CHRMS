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
import { PropertyCategory, PropertyStatus, PropertyType } from '@prisma/client';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { Permission } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreatePropertyDocumentDto } from './dto/create-property-document.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

const documentUpload = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, PropertiesService.documentsDir());
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

@Controller('properties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @RequirePermissions(Permission.PROPERTIES_READ)
  findAll(
    @Query('q') q?: string,
    @Query('status') status?: PropertyStatus,
    @Query('woreda') woreda?: string,
    @Query('type') type?: PropertyType,
    @Query('category') category?: PropertyCategory,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.properties.findAll({
      q,
      status,
      woreda,
      type,
      category,
      page,
      pageSize,
    });
  }

  @Get(':id')
  @RequirePermissions(Permission.PROPERTIES_READ)
  findOne(@Param('id') id: string) {
    return this.properties.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.PROPERTIES_WRITE)
  create(@Body() dto: CreatePropertyDto) {
    return this.properties.create(dto);
  }

  @Post(':id/documents')
  @RequirePermissions(Permission.PROPERTIES_WRITE)
  @UseInterceptors(documentUpload)
  addDocument(
    @Param('id') id: string,
    @Body() dto: CreatePropertyDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.properties.addDocument(id, dto, file);
  }

  @Put(':id')
  @RequirePermissions(Permission.PROPERTIES_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.properties.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PROPERTIES_WRITE)
  remove(@Param('id') id: string) {
    return this.properties.remove(id);
  }
}
