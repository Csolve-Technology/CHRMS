import { Decimal } from '@prisma/client/runtime/library';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Core sale math: total paid from installment rows, remaining balance, completion %.
 * Spec: total_paid = SUM(sale_payments.amount)
 */
export function saleTotals(totalPrice: Decimal, payments: { amount: Decimal }[]) {
  const totalPriceNum = Number(totalPrice);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, totalPriceNum - totalPaid);
  const completionPercentage =
    totalPriceNum > 0 ? Math.min(100, (totalPaid / totalPriceNum) * 100) : 0;
  return {
    totalPrice: totalPriceNum,
    totalPaid,
    remaining,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    isCompleted: remaining <= 0,
  };
}

/** Planned installment schedule after the initial/down payment. */
export function buildSalePaymentSchedule(opts: {
  totalPrice: number;
  downPayment: number;
  durationMonths: number;
  startDate: Date;
}) {
  const total = Number(opts.totalPrice) || 0;
  const initial = Number(opts.downPayment) || 0;
  const months = Math.max(0, Math.floor(Number(opts.durationMonths) || 0));
  const remainingBalance = roundMoney(Math.max(0, total - initial));

  if (remainingBalance <= 0 || months === 0) {
    return {
      remainingBalance: 0,
      monthlyPayment: 0,
      schedule: [] as {
        installment: number;
        dueDate: Date;
        amount: number;
      }[],
      paymentMode: 'full' as const,
    };
  }

  const baseMonthly = roundMoney(remainingBalance / months);
  const schedule: {
    installment: number;
    dueDate: Date;
    amount: number;
  }[] = [];
  let allocated = 0;

  for (let i = 0; i < months; i++) {
    const due = new Date(opts.startDate);
    due.setMonth(due.getMonth() + i + 1);
    const amount =
      i === months - 1
        ? roundMoney(remainingBalance - allocated)
        : baseMonthly;
    if (i < months - 1) allocated = roundMoney(allocated + amount);
    schedule.push({ installment: i + 1, dueDate: due, amount });
  }

  return {
    remainingBalance,
    monthlyPayment: baseMonthly,
    schedule,
    paymentMode: 'partial' as const,
  };
}
