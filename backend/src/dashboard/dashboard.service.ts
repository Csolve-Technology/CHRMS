import { Injectable } from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  allocatedPaidForMonth,
  isRentExpectedThisMonth,
} from '../rentals/rental-overdue.util';
import { isSecurityDepositPayment as isDeposit } from '../rentals/rental-payment.constants';
import { SettingsService } from '../settings/settings.service';
import { saleTotals } from '../sales/sale-calculations.util';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async getSummary() {
    const [
      totalProperties,
      byStatus,
      byCategory,
      byKebele,
      rentalPayments,
      sales,
      appSettings,
      tenantCounts,
      rentalCounts,
      saleCounts,
    ] = await Promise.all([
      this.prisma.property.count(),
      this.prisma.property.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.property.groupBy({
        by: ['category'],
        _count: { _all: true },
      }),
      this.prisma.property.groupBy({
        by: ['kebele'],
        _count: { _all: true },
        orderBy: { kebele: 'asc' },
      }),
      this.prisma.rentalPayment.findMany({
        select: { amount: true, method: true },
      }),
      this.prisma.sale.findMany({ include: { payments: true } }),
      this.settings.get(),
      this.prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.rental.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.sale.groupBy({ by: ['status'], _count: { _all: true } }),
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

    let rentalRevenue = 0;
    let depositHeld = 0;
    for (const p of rentalPayments) {
      const amt = Number(p.amount);
      if (isDeposit(p.method)) depositHeld += amt;
      else rentalRevenue += amt;
    }

    const totalRevenue = rentalRevenue + salePaymentsTotal;

    const activeRentals = await this.prisma.rental.findMany({
      where: { status: 'active' },
      include: { payments: true },
    });

    let outstandingRent = 0;
    let rentExpectedThisMonth = 0;
    let rentPaidThisMonth = 0;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    for (const r of activeRentals) {
      if (!isRentExpectedThisMonth(r.startDate, appSettings.rentalDueDay, now)) {
        continue;
      }
      const monthlyRent = Number(r.monthlyRent);
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
      rentExpectedThisMonth += monthlyRent;
      rentPaidThisMonth += Math.min(paidThisMonth, monthlyRent);
      if (paidThisMonth < monthlyRent) {
        outstandingRent += monthlyRent - paidThisMonth;
      }
    }

    const outstanding_balance = outstandingSales + outstandingRent;
    const tenantsByStatus = Object.fromEntries(
      tenantCounts.map((r) => [r.status, r._count._all]),
    );
    const rentalsByStatus = Object.fromEntries(
      rentalCounts.map((r) => [r.status, r._count._all]),
    );
    const salesByStatus = Object.fromEntries(
      saleCounts.map((r) => [r.status, r._count._all]),
    );

    const properties_by_status = byStatus.map((r) => ({
      name: r.status,
      value: r._count._all,
    }));

    const properties_by_category = byCategory.map((r) => ({
      name: r.category ?? 'uncategorized',
      value: r._count._all,
    }));

    const properties_by_kebele = byKebele.map((r) => ({
      name: r.kebele,
      value: r._count._all,
    }));

    return {
      total_properties: totalProperties,
      available: statusMap[PropertyStatus.available] ?? 0,
      rented,
      sold,
      maintenance: statusMap[PropertyStatus.maintenance] ?? 0,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      rental_revenue: Math.round(rentalRevenue * 100) / 100,
      sale_revenue: Math.round(salePaymentsTotal * 100) / 100,
      deposit_held: Math.round(depositHeld * 100) / 100,
      outstanding_balance: Math.round(outstanding_balance * 100) / 100,
      outstanding_rent: Math.round(outstandingRent * 100) / 100,
      outstanding_sales: Math.round(outstandingSales * 100) / 100,
      rent_expected_this_month:
        Math.round(rentExpectedThisMonth * 100) / 100,
      rent_paid_this_month: Math.round(rentPaidThisMonth * 100) / 100,
      total_tenants: tenantCounts.reduce((s, r) => s + r._count._all, 0),
      active_tenants: tenantsByStatus['active'] ?? 0,
      active_rentals: rentalsByStatus['active'] ?? 0,
      active_sales: salesByStatus['active'] ?? 0,
      properties_by_status,
      properties_by_category,
      properties_by_kebele,
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
        select: { amount: true, paidAt: true, method: true },
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
      if (isDeposit(p.method)) continue;
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
      rental: row.rental,
      sale: row.sale,
    }));

    return { monthly_revenue, payment_trends };
  }
}
