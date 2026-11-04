import { Decimal } from '@prisma/client/runtime/library';
import { isSecurityDepositPayment } from './rental-payment.constants';

type PaymentLike = {
  paidAt: Date;
  amount: Decimal | number;
  method?: string;
};

/** Cap due day so shorter months still work. */
export function dueDateForMonth(year: number, monthIndex: number, dueDay: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, dueDay), Math.min(28, lastDay));
  return new Date(year, monthIndex, day, 23, 59, 59, 999);
}

function isRentPayment(p: PaymentLike): boolean {
  return !p.method || !isSecurityDepositPayment(p.method);
}

/** Amount paid toward rent in a calendar month (excludes security deposit). */
export function paidInMonth(
  payments: PaymentLike[],
  year: number,
  monthIndex: number,
): number {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return payments
    .filter(
      (p) => isRentPayment(p) && p.paidAt >= start && p.paidAt <= end,
    )
    .reduce((s, p) => s + Number(p.amount), 0);
}

/**
 * Whether this month's rent cycle applies for a rental that started on `startDate`.
 * If the lease starts after this month's due day, the first due is next month.
 */
export function isRentExpectedThisMonth(
  startDate: Date | string | null | undefined,
  dueDay: number,
  asOf: Date = new Date(),
): boolean {
  if (!startDate) return true;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const y = asOf.getFullYear();
  const m = asOf.getMonth();

  if (start.getFullYear() > y) return false;
  if (start.getFullYear() === y && start.getMonth() > m) return false;

  const due = dueDateForMonth(y, m, dueDay);
  if (start.getFullYear() === y && start.getMonth() === m && start > due) {
    return false;
  }
  return true;
}

export type MonthRentStatus =
  | 'not_due'
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overdue';

/**
 * Current-month rent payment status for an active rental.
 * Deposit payments are ignored.
 */
export function getMonthRentStatus(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  dueDay: number,
  asOf: Date = new Date(),
  startDate?: Date | string | null,
): MonthRentStatus {
  if (!isRentExpectedThisMonth(startDate, dueDay, asOf)) return 'not_due';

  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const rent = Number(monthlyRent);
  const paid = paidInMonth(payments, y, m);
  const due = dueDateForMonth(y, m, dueDay);

  if (paid >= rent) return 'paid';
  if (asOf > due) return 'overdue';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

/** Rent coverage for a specific calendar month (no overdue — use for payment rows). */
export function getMonthCoverageStatus(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  year: number,
  monthIndex: number,
): 'unpaid' | 'partial' | 'paid' {
  const rent = Number(monthlyRent);
  const paid = paidInMonth(payments, year, monthIndex);
  if (paid >= rent) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

/**
 * Overdue = this month's rent is expected, today is after the due day,
 * and rent payments this month are still short of monthly rent.
 * (Security deposit does not count.)
 */
export function isRentalOverdue(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  dueDay: number,
  asOf: Date = new Date(),
  startDate?: Date | string | null,
): boolean {
  return (
    getMonthRentStatus(monthlyRent, payments, dueDay, asOf, startDate) ===
    'overdue'
  );
}

/** True when today is exactly `reminderDaysBefore` days before this month's due date. */
export function isReminderDay(
  dueDay: number,
  reminderDaysBefore: number,
  asOf: Date = new Date(),
): boolean {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const due = dueDateForMonth(y, m, dueDay);
  const reminder = new Date(due);
  reminder.setDate(reminder.getDate() - reminderDaysBefore);
  reminder.setHours(0, 0, 0, 0);
  const today = new Date(asOf);
  today.setHours(0, 0, 0, 0);
  return today.getTime() === reminder.getTime();
}

export type PeriodMonthStatus =
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'overdue'
  | 'upcoming';

export type RentalPeriodMonth = {
  year: number;
  month: number; // 1–12
  label: string;
  dueDate: string;
  expected: number;
  paid: number;
  balance: number;
  status: PeriodMonthStatus;
};

export type RentalPeriodSummary = {
  rentalDueDay: number;
  periodStart: string;
  periodEnd: string | null;
  monthsExpected: number;
  monthsPaid: number;
  monthsPartial: number;
  monthsUnpaid: number;
  monthsOverdue: number;
  monthsUpcoming: number;
  totalExpected: number;
  totalPaid: number;
  outstandingBalance: number;
  months: RentalPeriodMonth[];
};

function monthKey(year: number, monthIndex: number) {
  return year * 12 + monthIndex;
}

function firstBillableMonth(
  startDate: Date,
  dueDay: number,
): { year: number; monthIndex: number } {
  let year = startDate.getFullYear();
  let monthIndex = startDate.getMonth();
  const due = dueDateForMonth(year, monthIndex, dueDay);
  if (startDate > due) {
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }
  return { year, monthIndex };
}

/**
 * Month-by-month rent coverage from lease start through end (or asOf if open-ended),
 * driven by actual rental payment records (security deposits excluded).
 */
export function buildRentalPeriodSummary(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  startDate: Date | string,
  endDate: Date | string | null | undefined,
  dueDay: number,
  asOf: Date = new Date(),
): RentalPeriodSummary {
  const rent = Number(monthlyRent);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = endDate ? new Date(endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  const { year: startY, monthIndex: startM } = firstBillableMonth(start, dueDay);
  // Include contracted future months through lease end (marked upcoming).
  const contractEnd = end ?? asOf;
  const lastY = contractEnd.getFullYear();
  const lastM = contractEnd.getMonth();

  const months: RentalPeriodMonth[] = [];
  let y = startY;
  let m = startM;
  const lastKey = monthKey(lastY, lastM);
  const nowKey = monthKey(asOf.getFullYear(), asOf.getMonth());

  while (monthKey(y, m) <= lastKey) {
    const paid = Math.round(paidInMonth(payments, y, m) * 100) / 100;
    const due = dueDateForMonth(y, m, dueDay);
    const expected = rent;
    const balance = Math.max(0, Math.round((expected - paid) * 100) / 100);
    const key = monthKey(y, m);

    let status: PeriodMonthStatus;
    if (paid >= expected) {
      status = 'paid';
    } else if (key > nowKey) {
      status = 'upcoming';
    } else if (asOf > due && balance > 0) {
      status = 'overdue';
    } else if (paid > 0) {
      status = 'partial';
    } else {
      status = 'unpaid';
    }

    months.push({
      year: y,
      month: m + 1,
      label: due.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      dueDate: due.toISOString(),
      expected,
      paid,
      balance,
      status,
    });

    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    // safety against runaway loops
    if (months.length > 600) break;
  }

  const billed = months.filter((row) => row.status !== 'upcoming');
  const monthsPaid = billed.filter((row) => row.status === 'paid').length;
  const monthsPartial = billed.filter((row) => row.status === 'partial').length;
  const monthsUnpaid = billed.filter(
    (row) => row.status === 'unpaid' || row.status === 'partial',
  ).length;
  const monthsOverdue = billed.filter((row) => row.status === 'overdue').length;
  const monthsUpcoming = months.filter((row) => row.status === 'upcoming').length;

  // Full lease: Total Expected = Monthly Rent × Number of Months (incl. upcoming)
  const monthsExpected = months.length;
  const totalExpected = Math.round(rent * monthsExpected * 100) / 100;
  const totalPaid =
    Math.round(months.reduce((s, row) => s + row.paid, 0) * 100) / 100;
  const outstandingBalance =
    Math.round(Math.max(0, totalExpected - totalPaid) * 100) / 100;

  return {
    rentalDueDay: dueDay,
    periodStart: start.toISOString(),
    periodEnd: end ? end.toISOString() : null,
    monthsExpected,
    monthsPaid,
    monthsPartial,
    monthsUnpaid,
    monthsOverdue,
    monthsUpcoming,
    totalExpected,
    totalPaid,
    outstandingBalance,
    months,
  };
}
