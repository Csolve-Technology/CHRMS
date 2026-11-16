import { Decimal } from '@prisma/client/runtime/library';
import { isSecurityDepositPayment } from './rental-payment.constants';

type PaymentLike = {
  paidAt: Date;
  amount: Decimal | number;
  method?: string;
  id?: string;
  createdAt?: Date;
};

/** Cap due day so shorter months still work. */
export function dueDateForMonth(
  year: number,
  monthIndex: number,
  dueDay: number,
): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, dueDay), Math.min(28, lastDay));
  return new Date(year, monthIndex, day, 23, 59, 59, 999);
}

function isRentPayment(p: PaymentLike): boolean {
  return !p.method || !isSecurityDepositPayment(p.method);
}

/** Sum of rent payments (excludes security deposit). */
export function totalRentPaid(payments: PaymentLike[]): number {
  return (
    Math.round(
      payments
        .filter(isRentPayment)
        .reduce((s, p) => s + Number(p.amount), 0) * 100,
    ) / 100
  );
}

/**
 * Cash received in a calendar month (by paidAt). Used for revenue charts.
 * For month coverage / balances use FIFO allocation instead.
 */
export function paidInMonth(
  payments: PaymentLike[],
  year: number,
  monthIndex: number,
): number {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return (
    Math.round(
      payments
        .filter(
          (p) => isRentPayment(p) && p.paidAt >= start && p.paidAt <= end,
        )
        .reduce((s, p) => s + Number(p.amount), 0) * 100,
    ) / 100
  );
}

function monthKey(year: number, monthIndex: number) {
  return year * 12 + monthIndex;
}

function addMonths(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } {
  const key = monthKey(year, monthIndex) + delta;
  return { year: Math.floor(key / 12), monthIndex: ((key % 12) + 12) % 12 };
}

function firstBillableMonth(
  startDate: Date,
  dueDay: number,
): { year: number; monthIndex: number } {
  let year = startDate.getFullYear();
  let monthIndex = startDate.getMonth();
  const due = dueDateForMonth(year, monthIndex, dueDay);
  if (startDate > due) {
    ({ year, monthIndex } = addMonths(year, monthIndex, 1));
  }
  return { year, monthIndex };
}

/** How far ahead open-ended leases can be prepaid (months from today). */
export const OPEN_ENDED_PREPAY_MONTHS = 24;

/**
 * Build the list of billable months from first due through lease end,
 * or through asOf (+ prepaid / horizon months for open-ended leases).
 */
export function listBillableMonths(
  startDate: Date | string,
  endDate: Date | string | null | undefined,
  dueDay: number,
  asOf: Date = new Date(),
  opts?: { prepaidMonths?: number; openHorizonMonths?: number },
): { year: number; monthIndex: number }[] {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = endDate ? new Date(endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  const { year: startY, monthIndex: startM } = firstBillableMonth(start, dueDay);
  const horizon = opts?.openHorizonMonths ?? OPEN_ENDED_PREPAY_MONTHS;
  const prepaid = opts?.prepaidMonths ?? 0;

  let lastY: number;
  let lastM: number;
  if (end) {
    lastY = end.getFullYear();
    lastM = end.getMonth();
  } else {
    const asOfPlus = addMonths(
      asOf.getFullYear(),
      asOf.getMonth(),
      Math.max(horizon, prepaid),
    );
    lastY = asOfPlus.year;
    lastM = asOfPlus.monthIndex;
  }

  const months: { year: number; monthIndex: number }[] = [];
  let y = startY;
  let m = startM;
  while (monthKey(y, m) <= monthKey(lastY, lastM)) {
    months.push({ year: y, monthIndex: m });
    ({ year: y, monthIndex: m } = addMonths(y, m, 1));
    if (months.length > 600) break;
  }
  return months;
}

/**
 * FIFO: apply total rent paid to billable months in order.
 * Returns allocated amount per month (same length as `months`).
 */
export function allocatePaymentsFifo(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  months: { year: number; monthIndex: number }[],
): number[] {
  const rent = Number(monthlyRent);
  let pool = totalRentPaid(payments);
  return months.map(() => {
    const allocated = Math.min(rent, Math.max(0, pool));
    pool = Math.round((pool - allocated) * 100) / 100;
    return Math.round(allocated * 100) / 100;
  });
}

/**
 * Allocated rent credit for one calendar month (FIFO across the lease).
 */
export function allocatedPaidForMonth(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  startDate: Date | string,
  endDate: Date | string | null | undefined,
  dueDay: number,
  year: number,
  monthIndex: number,
  asOf: Date = new Date(),
): number {
  const months = listBillableMonths(startDate, endDate, dueDay, asOf);
  const allocated = allocatePaymentsFifo(monthlyRent, payments, months);
  const idx = months.findIndex(
    (row) => row.year === year && row.monthIndex === monthIndex,
  );
  return idx >= 0 ? allocated[idx] : 0;
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
 * Current-month rent payment status for an active rental (FIFO allocation).
 */
export function getMonthRentStatus(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  dueDay: number,
  asOf: Date = new Date(),
  startDate?: Date | string | null,
  endDate?: Date | string | null,
): MonthRentStatus {
  if (!isRentExpectedThisMonth(startDate, dueDay, asOf)) return 'not_due';
  if (!startDate) return 'unpaid';

  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const rent = Number(monthlyRent);
  const paid = allocatedPaidForMonth(
    monthlyRent,
    payments,
    startDate,
    endDate,
    dueDay,
    y,
    m,
    asOf,
  );
  const due = dueDateForMonth(y, m, dueDay);

  if (paid >= rent) return 'paid';
  if (asOf > due) return 'overdue';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

/** Rent coverage for a specific calendar month (FIFO). */
export function getMonthCoverageStatus(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  year: number,
  monthIndex: number,
  startDate?: Date | string | null,
  endDate?: Date | string | null,
  dueDay = 1,
  asOf: Date = new Date(),
): 'unpaid' | 'partial' | 'paid' {
  const rent = Number(monthlyRent);
  const paid = startDate
    ? allocatedPaidForMonth(
        monthlyRent,
        payments,
        startDate,
        endDate,
        dueDay,
        year,
        monthIndex,
        asOf,
      )
    : paidInMonth(payments, year, monthIndex);
  if (paid >= rent) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

export function isRentalOverdue(
  monthlyRent: Decimal | number,
  payments: PaymentLike[],
  dueDay: number,
  asOf: Date = new Date(),
  startDate?: Date | string | null,
  endDate?: Date | string | null,
): boolean {
  return (
    getMonthRentStatus(
      monthlyRent,
      payments,
      dueDay,
      asOf,
      startDate,
      endDate,
    ) === 'overdue'
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

export type PaymentCoverageMonth = {
  year: number;
  month: number;
  label: string;
  amountApplied: number;
  statusAfter: 'paid' | 'partial' | 'unpaid';
};

export type PaymentCoverage = {
  monthlyRent: number;
  amount: number;
  monthsFullyCovered: number;
  hasPartial: boolean;
  coverageLabel: string;
  months: PaymentCoverageMonth[];
  outstandingBefore: number;
  outstandingAfter: number;
  maxPayable: number;
};

function monthLabel(year: number, monthIndex: number, dueDay: number) {
  return dueDateForMonth(year, monthIndex, dueDay).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatCoverageLabel(months: PaymentCoverageMonth[]): string {
  if (months.length === 0) return 'No months covered';
  if (months.length === 1) {
    const m = months[0];
    return m.statusAfter === 'partial'
      ? `Partial ${m.label}`
      : m.label;
  }
  const first = months[0].label;
  const last = months[months.length - 1].label;
  const partial = months[months.length - 1].statusAfter === 'partial';
  const fullCount = months.filter((m) => m.statusAfter === 'paid').length;
  if (partial) {
    return `${first} → ${last} (${fullCount} full + partial)`;
  }
  return `${first} → ${last} (${months.length} months)`;
}

/**
 * Preview / describe how a rent amount covers billable months (FIFO).
 */
export function describePaymentCoverage(
  monthlyRent: Decimal | number,
  existingPayments: PaymentLike[],
  amount: number,
  startDate: Date | string,
  endDate: Date | string | null | undefined,
  dueDay: number,
  asOf: Date = new Date(),
): PaymentCoverage {
  const rent = Number(monthlyRent);
  const paidBefore = totalRentPaid(existingPayments);
  const monthsNeeded = Math.max(
    1,
    Math.ceil((paidBefore + Math.max(0, amount)) / Math.max(rent, 1)) + 1,
  );

  const months = listBillableMonths(startDate, endDate, dueDay, asOf, {
    prepaidMonths: endDate ? 0 : monthsNeeded,
    openHorizonMonths: Math.max(OPEN_ENDED_PREPAY_MONTHS, monthsNeeded),
  });
  const before = allocatePaymentsFifo(monthlyRent, existingPayments, months);
  const after = allocatePaymentsFifo(
    monthlyRent,
    [
      ...existingPayments,
      {
        amount,
        paidAt: asOf,
        method: 'cash',
      },
    ],
    months,
  );

  const covered: PaymentCoverageMonth[] = [];
  for (let i = 0; i < months.length; i++) {
    const applied = Math.round((after[i] - before[i]) * 100) / 100;
    if (applied <= 0) continue;
    const statusAfter: 'paid' | 'partial' | 'unpaid' =
      after[i] >= rent ? 'paid' : after[i] > 0 ? 'partial' : 'unpaid';
    covered.push({
      year: months[i].year,
      month: months[i].monthIndex + 1,
      label: monthLabel(months[i].year, months[i].monthIndex, dueDay),
      amountApplied: applied,
      statusAfter,
    });
  }

  // Cap open-ended prepays at a fixed horizon so validation cannot grow with amount.
  const capMonths = listBillableMonths(startDate, endDate, dueDay, asOf, {
    prepaidMonths: 0,
    openHorizonMonths: OPEN_ENDED_PREPAY_MONTHS,
  });
  const capExpected = Math.round(rent * capMonths.length * 100) / 100;
  const maxPayable = Math.max(
    0,
    Math.round((capExpected - paidBefore) * 100) / 100,
  );
  const outstandingBefore = maxPayable;
  const outstandingAfter = Math.max(
    0,
    Math.round((maxPayable - Math.max(0, amount)) * 100) / 100,
  );

  return {
    monthlyRent: rent,
    amount,
    monthsFullyCovered: covered.filter((m) => m.statusAfter === 'paid').length,
    hasPartial: covered.some((m) => m.statusAfter === 'partial'),
    coverageLabel: formatCoverageLabel(covered),
    months: covered,
    outstandingBefore,
    outstandingAfter,
    maxPayable,
  };
}

/**
 * Which months a specific existing payment contributed to (FIFO replay).
 */
export function coverageForExistingPayment(
  monthlyRent: Decimal | number,
  allPayments: PaymentLike[],
  payment: PaymentLike,
  startDate: Date | string,
  endDate: Date | string | null | undefined,
  dueDay: number,
  asOf: Date = new Date(),
): PaymentCoverage {
  if (!isRentPayment(payment)) {
    return {
      monthlyRent: Number(monthlyRent),
      amount: Number(payment.amount),
      monthsFullyCovered: 0,
      hasPartial: false,
      coverageLabel: 'Security deposit',
      months: [],
      outstandingBefore: 0,
      outstandingAfter: 0,
      maxPayable: 0,
    };
  }

  const sorted = [...allPayments]
    .filter(isRentPayment)
    .sort((a, b) => {
      const ta = a.paidAt.getTime() - b.paidAt.getTime();
      if (ta !== 0) return ta;
      const ca = (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
      if (ca !== 0) return ca;
      return String(a.id ?? '').localeCompare(String(b.id ?? ''));
    });

  const idx = sorted.findIndex(
    (p) =>
      (payment.id && p.id === payment.id) ||
      (!payment.id &&
        p.paidAt.getTime() === payment.paidAt.getTime() &&
        Number(p.amount) === Number(payment.amount)),
  );
  const beforePayments = idx >= 0 ? sorted.slice(0, idx) : sorted;
  return describePaymentCoverage(
    monthlyRent,
    beforePayments,
    Number(payment.amount),
    startDate,
    endDate,
    dueDay,
    asOf,
  );
}

/**
 * Month-by-month rent coverage from lease start (FIFO allocation).
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

  const paidTotal = totalRentPaid(payments);
  const prepaidMonths = Math.max(0, Math.ceil(paidTotal / Math.max(rent, 1)));

  // Display through lease end, or through today / prepaid months for open leases.
  const displayMonths = listBillableMonths(startDate, endDate, dueDay, asOf, {
    prepaidMonths: end ? 0 : prepaidMonths,
    openHorizonMonths: end ? 0 : Math.max(0, prepaidMonths - 1),
  });

  // For open-ended with no prepaid, stop at asOf.
  let monthsMeta = displayMonths;
  if (!end) {
    const asOfKey = monthKey(asOf.getFullYear(), asOf.getMonth());
    const neededLast = addMonths(
      firstBillableMonth(start, dueDay).year,
      firstBillableMonth(start, dueDay).monthIndex,
      Math.max(0, prepaidMonths - 1),
    );
    const neededKey = monthKey(neededLast.year, neededLast.monthIndex);
    const lastKey = Math.max(asOfKey, neededKey);
    monthsMeta = displayMonths.filter(
      (row) => monthKey(row.year, row.monthIndex) <= lastKey,
    );
  }

  const allocated = allocatePaymentsFifo(monthlyRent, payments, monthsMeta);
  const nowKey = monthKey(asOf.getFullYear(), asOf.getMonth());

  const months: RentalPeriodMonth[] = monthsMeta.map((row, i) => {
    const paid = allocated[i];
    const due = dueDateForMonth(row.year, row.monthIndex, dueDay);
    const expected = rent;
    const balance = Math.max(0, Math.round((expected - paid) * 100) / 100);
    const key = monthKey(row.year, row.monthIndex);

    let status: PeriodMonthStatus;
    if (paid >= expected) {
      status = 'paid';
    } else if (key > nowKey) {
      status = paid > 0 ? 'partial' : 'upcoming';
    } else if (asOf > due && balance > 0) {
      status = paid > 0 ? (paid >= expected ? 'paid' : 'overdue') : 'overdue';
      // partial overdue still overdue for badge emphasis; keep partial if preferred
      if (paid > 0 && paid < expected) status = 'overdue';
    } else if (paid > 0) {
      status = 'partial';
    } else {
      status = 'unpaid';
    }

    return {
      year: row.year,
      month: row.monthIndex + 1,
      label: due.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      dueDate: due.toISOString(),
      expected,
      paid,
      balance,
      status,
    };
  });

  const billed = months.filter((row) => row.status !== 'upcoming');
  const monthsPaid = billed.filter((row) => row.status === 'paid').length;
  const monthsPartial = billed.filter((row) => row.status === 'partial').length;
  const monthsUnpaid = billed.filter(
    (row) => row.status === 'unpaid' || row.status === 'partial',
  ).length;
  const monthsOverdue = billed.filter((row) => row.status === 'overdue').length;
  const monthsUpcoming = months.filter(
    (row) => row.status === 'upcoming',
  ).length;

  const monthsExpected = months.length;
  const totalExpected = Math.round(rent * monthsExpected * 100) / 100;
  const totalPaid = Math.round(paidTotal * 100) / 100;
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
