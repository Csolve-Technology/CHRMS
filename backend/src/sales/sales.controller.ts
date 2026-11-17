import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @RequirePermissions(Permission.SALES_READ)
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.sales.findAll({ page, pageSize });
  }

  @Get(':id')
  @RequirePermissions(Permission.SALES_READ)
  findOne(@Param('id') id: string) {
    return this.sales.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.SALES_WRITE)
  create(@Body() dto: CreateSaleDto) {
    return this.sales.create(dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SALES_WRITE)
  remove(@Param('id') id: string) {
    return this.sales.remove(id);
  }
}
