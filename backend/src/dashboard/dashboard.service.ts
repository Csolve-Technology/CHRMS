import { Injectable } from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  allocatedPaidForMonth,
  isRentExpectedThisMonth,
} from '../rentals/rental-overdue.util';
import { SettingsService } from '../settings/settings.service';
import { saleTotals } from '../sales/sale-calculations.util';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async getSummary() {
    const [totalProperties, byStatus, rentalPayAgg, sales, appSettings] =
      await Promise.all([
        this.prisma.property.count(),
        this.prisma.property.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.rentalPayment.aggregate({ _sum: { amount: true } }),
        this.prisma.sale.findMany({ include: { payments: true } }),
        this.settings.get(),
      ]);

    const statusMap = Object.fromEntries(
      byStatus.map((r) => [r.status, r._count._all]),
    ) as Record<string, number>;

    const rented = statusMap[PropertyStatus.rented] ?? 0;
    const sold = statusMap[PropertyStatus.sold] ?? 0;

    let salePaymentsTotal = 0;
    let outstandingSales = 0;
    for (const s of sales) {
      const t = saleTotals(s.totalPrice, s.payments);
      salePaymentsTotal += t.totalPaid;
      if (!t.isCompleted) outstandingSales += t.remaining;
    }

    const totalRentalRevenue = Number(rentalPayAgg._sum.amount ?? 0);
    const totalRevenue = totalRentalRevenue + salePaymentsTotal;

    const activeRentals = await this.prisma.rental.findMany({
      where: { status: 'active' },
      include: { payments: true },
    });

    let outstandingRent = 0;
    const now = new Date();
    for (const r of activeRentals) {
      if (!isRentExpectedThisMonth(r.startDate, appSettings.rentalDueDay, now)) {
        continue;
      }
      const y = now.getFullYear();
      const m = now.getMonth();
      const paidThisMonth = allocatedPaidForMonth(
        r.monthlyRent,
        r.payments,
        r.startDate,
        r.endDate,
        appSettings.rentalDueDay,
        y,
        m,
        now,
      );
      const due = Number(r.monthlyRent);
      if (paidThisMonth < due) outstandingRent += due - paidThisMonth;
    }

    const outstanding_balance = outstandingSales + outstandingRent;

    return {
      total_properties: totalProperties,
      available: statusMap[PropertyStatus.available] ?? 0,
      rented,
      sold,
      maintenance: statusMap[PropertyStatus.maintenance] ?? 0,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      outstanding_balance: Math.round(outstanding_balance * 100) / 100,
    };
  }

  /** Last 12 months: rental vs sale cash-in for charts */
  async getTrends() {
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const [rentalPayments, salePayments] = await Promise.all([
      this.prisma.rentalPayment.findMany({
        where: { paidAt: { gte: start } },
        select: { amount: true, paidAt: true },
      }),
      this.prisma.salePayment.findMany({
        where: { paidAt: { gte: start } },
        select: { amount: true, paidAt: true },
      }),
    ]);

    const months: { key: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key,
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
      });
    }

    const rentalByMonth: Record<string, number> = {};
    const saleByMonth: Record<string, number> = {};
    for (const m of months) {
      rentalByMonth[m.key] = 0;
      saleByMonth[m.key] = 0;
    }

    const bucket = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    for (const p of rentalPayments) {
      const k = bucket(p.paidAt);
      if (rentalByMonth[k] !== undefined) rentalByMonth[k] += Number(p.amount);
    }
    for (const p of salePayments) {
      const k = bucket(p.paidAt);
      if (saleByMonth[k] !== undefined) saleByMonth[k] += Number(p.amount);
    }

    const monthly_revenue = months.map((m) => ({
      month: m.label,
      rental: Math.round(rentalByMonth[m.key] * 100) / 100,
      sale: Math.round(saleByMonth[m.key] * 100) / 100,
      total: Math.round((rentalByMonth[m.key] + saleByMonth[m.key]) * 100) / 100,
    }));

    const payment_trends = monthly_revenue.map((row) => ({
      month: row.month,
      total: row.total,
    }));

    return { monthly_revenue, payment_trends };
  }
}
