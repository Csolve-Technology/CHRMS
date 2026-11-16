import { Controller, Get, UseGuards } from '@nestjs/common';
import { Permission } from '../common/constants/permissions';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @RequirePermissions(Permission.REPORTS_READ)
  summary() {
    return this.reports.summary();
  }

  @Get('overview')
  @RequirePermissions(Permission.REPORTS_READ)
  overview() {
    return this.reports.overview();
  }
}
