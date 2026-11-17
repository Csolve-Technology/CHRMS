/** Security deposit collected at lease start — not counted toward monthly rent. */
export const SECURITY_DEPOSIT_METHOD = 'security_deposit';

export const RENTAL_STATUSES = [
  'active',
  'completed',
  'cancelled',
  'expired',
] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

/** Tenant no longer on an active lease — history is preserved. */
export const TENANT_STATUS_FORMER = 'former';
export const TENANT_STATUS_ACTIVE = 'active';

export function isSecurityDepositPayment(method: string): boolean {
  return method === SECURITY_DEPOSIT_METHOD;
}
