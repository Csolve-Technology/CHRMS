import { UserRole } from '@prisma/client';

/** Fine-grained permissions; roles map to these for guards */
export enum Permission {
  ROLES_READ = 'roles.read',
  ROLES_WRITE = 'roles.write',
  SETTINGS_READ = 'settings.read',
  SETTINGS_WRITE = 'settings.write',
  PROFILE_READ = 'profile.read',
  DASHBOARD_READ = 'dashboard.read',
  PROPERTIES_READ = 'properties.read',
  PROPERTIES_WRITE = 'properties.write',
  TENANTS_READ = 'tenants.read',
  TENANTS_WRITE = 'tenants.write',
  RENTALS_READ = 'rentals.read',
  RENTALS_WRITE = 'rentals.write',
  RENTAL_PAYMENTS_READ = 'rental_payments.read',
  RENTAL_PAYMENTS_WRITE = 'rental_payments.write',
  SALES_READ = 'sales.read',
  SALES_WRITE = 'sales.write',
  SALE_PAYMENTS_READ = 'sale_payments.read',
  SALE_PAYMENTS_WRITE = 'sale_payments.write',
  REPORTS_READ = 'reports.read',
  USERS_READ = 'users.read',
  USERS_WRITE = 'users.write',
  AUDIT_READ = 'audit.read',
}

const HOUSING_OFFICER_PERMISSIONS: Permission[] = [
  Permission.PROFILE_READ,
  Permission.DASHBOARD_READ,
  Permission.PROPERTIES_READ,
  Permission.PROPERTIES_WRITE,
  Permission.TENANTS_READ,
  Permission.TENANTS_WRITE,
  Permission.RENTALS_READ,
  Permission.RENTALS_WRITE,
  Permission.RENTAL_PAYMENTS_READ,
  Permission.RENTAL_PAYMENTS_WRITE,
  Permission.SALES_READ,
  Permission.SALES_WRITE,
  Permission.SALE_PAYMENTS_READ,
  Permission.SALE_PAYMENTS_WRITE,
  Permission.REPORTS_READ,
];

const ALL_PERMISSIONS = Object.values(Permission);

export function permissionsForRole(role: UserRole): Permission[] {
  if (role === UserRole.ADMIN) return ALL_PERMISSIONS;
  if (role === UserRole.HOUSING_OFFICER) return HOUSING_OFFICER_PERMISSIONS;
  return [];
}
