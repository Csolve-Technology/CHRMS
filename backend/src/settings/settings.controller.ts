import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Permission } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions(Permission.SETTINGS_READ)
  get() {
    return this.settings.get();
  }

  @Put()
  @RequirePermissions(Permission.SETTINGS_WRITE)
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
