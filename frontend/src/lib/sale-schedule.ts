export type SaleScheduleRow = {
  installment: number;
  dueDate: string;
  amount: number;
};

export type SaleScheduleSummary = {
  remainingBalance: number;
  monthlyPayment: number;
  schedule: SaleScheduleRow[];
  paymentMode: "full" | "partial";
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build installment schedule after an initial payment (down payment). */
export function buildSalePaymentSchedule(opts: {
  totalPrice: number;
  downPayment: number;
  durationMonths: number;
  startDate?: string;
}): SaleScheduleSummary {
  const total = Number(opts.totalPrice) || 0;
  const initial = Number(opts.downPayment) || 0;
  const months = Math.max(0, Math.floor(Number(opts.durationMonths) || 0));
  const remainingBalance = roundMoney(Math.max(0, total - initial));

  if (remainingBalance <= 0 || months === 0) {
    return {
      remainingBalance: 0,
      monthlyPayment: 0,
      schedule: [],
      paymentMode: "full",
    };
  }

  const baseMonthly = roundMoney(remainingBalance / months);
  const start = opts.startDate ? new Date(opts.startDate) : new Date();
  const schedule: SaleScheduleRow[] = [];
  let allocated = 0;

  for (let i = 0; i < months; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i + 1);
    const amount =
      i === months - 1
        ? roundMoney(remainingBalance - allocated)
        : baseMonthly;
    if (i < months - 1) allocated = roundMoney(allocated + amount);
    schedule.push({
      installment: i + 1,
      dueDate: due.toISOString().slice(0, 10),
      amount,
    });
  }

  return {
    remainingBalance,
    monthlyPayment: baseMonthly,
    schedule,
    paymentMode: "partial",
  };
}
